import { Prisma, type PrismaClient } from '@prisma/client'
import { arredondar, somarMeses } from '@/lib/calculos'

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Gravação e correção dos custos do menu Custos.
 *
 * Todo custo lançado vira título financeiro na mesma transação — esse é o
 * desenho central do sistema. A consequência, que só apareceu quando alguém
 * usou de verdade, é que **corrigir o custo tem que corrigir o título junto**.
 * Uma manutenção de R$ 3.500 salva como R$ 350 não é só uma linha feia na
 * lista: é uma conta a pagar errada e um resultado errado.
 *
 * Por isso criar e corrigir moram na mesma função. Duas funções fariam a
 * correção esquecer alguma coisa que a criação faz — e a que ela esqueceria
 * primeiro é justamente o título.
 */

type FormaPagamento =
  | 'DINHEIRO'
  | 'PIX'
  | 'CHEQUE'
  | 'BOLETO'
  | 'CARTAO'
  | 'TRANSFERENCIA'

const RECUSA_BAIXA =
  'já tem pagamento registrado. Estorne a baixa antes de corrigir ou excluir.'

/**
 * Os títulos de um custo, só quando ninguém encostou neles.
 *
 * Título com dinheiro recebido ou pago não se apaga para regravar: sumiria do
 * histórico um valor que passou pela conta de verdade. Nesse caso a correção é
 * estorno, e a função diz isso em vez de fazer.
 */
async function titulosParaRegravar(
  tx: Tx,
  where: Prisma.LancamentoWhereInput,
  oQue: string,
): Promise<string[]> {
  const existentes = await tx.lancamento.findMany({
    where,
    select: { id: true, valorPago: true, acertoId: true },
  })
  const mexido = existentes.some((l) => Number(l.valorPago) > 0 || l.acertoId != null)
  if (mexido) throw new Error(`${oQue} ${RECUSA_BAIXA}`)
  return existentes.map((l) => l.id)
}

/**
 * Onde moram os títulos de uma manutenção.
 *
 * O `parcelamentoId` só era gravado quando havia mais de uma parcela, então a
 * manutenção à vista — a maioria delas — não tinha como achar o próprio título
 * de volta a não ser pelo `lancamentoId`. O `OR` cobre as duas formas: a nova,
 * em que toda parcela é carimbada, e as linhas lançadas antes disso.
 */
function ondeEstaoOsTitulos(manutencaoId: string, lancamentoId: string | null) {
  return {
    OR: [
      { parcelamentoId: manutencaoId },
      ...(lancamentoId ? [{ id: lancamentoId }] : []),
    ],
  }
}

export type DadosManutencao = {
  veiculoId: string
  fornecedorId?: string | null
  data: Date
  odometro?: number | null
  tipo: 'PREVENTIVA' | 'CORRETIVA' | 'PNEU' | 'REVISAO'
  descricao: string
  valorPecas?: number | null
  valorServico?: number | null
  formaPagamento: FormaPagamento
  dataVencimento?: Date | null
  parcelas?: number | null
}

/**
 * Cria ou corrige uma manutenção, com as parcelas refeitas do zero.
 *
 * Refazer em vez de remendar é deliberado: mudar de três parcelas para uma, ou
 * o contrário, não é editar valores — é outro conjunto de títulos. Tentar
 * casar parcela a parcela erraria justamente no caso em que a quantidade muda.
 */
export async function gravarManutencao(
  tx: Tx,
  entrada: {
    id?: string
    dados: DadosManutencao
    apelidoVeiculo: string
    categoriaId: string
  },
): Promise<string> {
  const { dados, apelidoVeiculo, categoriaId } = entrada
  const total = arredondar((dados.valorPecas ?? 0) + (dados.valorServico ?? 0))
  const parcelas = Math.max(1, Math.trunc(dados.parcelas ?? 1))
  const primeiroVencimento = dados.dataVencimento ?? dados.data

  const campos = {
    veiculoId: dados.veiculoId,
    fornecedorId: dados.fornecedorId ?? null,
    data: dados.data,
    odometro: dados.odometro ?? null,
    tipo: dados.tipo,
    descricao: dados.descricao,
    valorPecas: new Prisma.Decimal(arredondar(dados.valorPecas ?? 0)),
    valorServico: new Prisma.Decimal(arredondar(dados.valorServico ?? 0)),
  }

  let manutencaoId: string

  if (entrada.id) {
    const atual = await tx.manutencao.findUnique({
      where: { id: entrada.id },
      select: { id: true, lancamentoId: true },
    })
    if (!atual) throw new Error('Manutenção não encontrada.')

    const ids = await titulosParaRegravar(
      tx,
      ondeEstaoOsTitulos(atual.id, atual.lancamentoId),
      'Esta manutenção',
    )
    // A manutenção aponta para o primeiro título por chave única: soltar a
    // referência antes é o que permite apagar o título.
    await tx.manutencao.update({
      where: { id: atual.id },
      data: { ...campos, lancamentoId: null },
    })
    await tx.lancamento.deleteMany({ where: { id: { in: ids } } })
    manutencaoId = atual.id
  } else {
    const criada = await tx.manutencao.create({ data: campos, select: { id: true } })
    manutencaoId = criada.id
  }

  // A última parcela absorve o resíduo do arredondamento, para a soma das
  // parcelas fechar exatamente com o total.
  const valorParcela = arredondar(total / parcelas)
  const residuo = arredondar(total - valorParcela * parcelas)

  for (let i = 0; i < parcelas; i++) {
    const ehUltima = i === parcelas - 1
    const lancamento = await tx.lancamento.create({
      data: {
        tipo: 'DESPESA',
        categoriaId,
        descricao:
          parcelas > 1
            ? `${dados.descricao} — ${apelidoVeiculo} (${i + 1}/${parcelas})`
            : `${dados.descricao} — ${apelidoVeiculo}`,
        valor: new Prisma.Decimal(
          ehUltima ? arredondar(valorParcela + residuo) : valorParcela,
        ),
        dataCompetencia: dados.data,
        dataVencimento: somarMeses(primeiroVencimento, i),
        veiculoId: dados.veiculoId,
        fornecedorId: dados.fornecedorId ?? null,
        formaPagamento: dados.formaPagamento,
        // Carimbado sempre, mesmo à vista: é o que liga o título de volta à
        // manutenção que o gerou, e sem ele a correção não acha o que refazer.
        parcelamentoId: manutencaoId,
        parcelaNumero: parcelas > 1 ? i + 1 : null,
        parcelaTotal: parcelas > 1 ? parcelas : null,
      },
      select: { id: true },
    })

    if (i === 0) {
      await tx.manutencao.update({
        where: { id: manutencaoId },
        data: { lancamentoId: lancamento.id },
      })
    }
  }

  return manutencaoId
}

/** Apaga a manutenção e as contas a pagar que ela criou. */
export async function apagarManutencao(tx: Tx, id: string): Promise<void> {
  const atual = await tx.manutencao.findUnique({
    where: { id },
    select: { id: true, lancamentoId: true },
  })
  if (!atual) throw new Error('Manutenção não encontrada.')

  const ids = await titulosParaRegravar(
    tx,
    ondeEstaoOsTitulos(atual.id, atual.lancamentoId),
    'Esta manutenção',
  )
  await tx.manutencao.update({ where: { id: atual.id }, data: { lancamentoId: null } })
  await tx.lancamento.deleteMany({ where: { id: { in: ids } } })
  await tx.manutencao.delete({ where: { id: atual.id } })
}

export type DadosAbastecimento = {
  veiculoId: string
  motoristaId?: string | null
  fornecedorId: string
  data: Date
  litros: number
  valorTotal: number
  valorLitro: number
  /** Anotação do motorista, que nem sempre chega. */
  odometro?: number | null
  numeroNota?: string | null
  tanqueCheio: boolean
  formaPagamento: FormaPagamento
  dataVencimento?: Date | null
  observacoes?: string | null
}

/** Cria ou corrige um abastecimento, com o título refeito junto. */
export async function gravarAbastecimento(
  tx: Tx,
  entrada: {
    id?: string
    dados: DadosAbastecimento
    veiculo: { apelido: string; tipo: string; odometroAtual: number | null }
    categoriaId: string
  },
): Promise<string> {
  const { dados, veiculo, categoriaId } = entrada

  if (entrada.id) {
    const atual = await tx.abastecimento.findUnique({
      where: { id: entrada.id },
      select: { id: true, lancamentoId: true },
    })
    if (!atual) throw new Error('Abastecimento não encontrado.')
    const ids = await titulosParaRegravar(
      tx,
      { id: atual.lancamentoId ?? '' },
      'Este abastecimento',
    )
    await tx.abastecimento.update({
      where: { id: atual.id },
      data: { lancamentoId: null },
    })
    await tx.lancamento.deleteMany({ where: { id: { in: ids } } })
  }

  const lancamento = await tx.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId,
      descricao: `Abastecimento — ${veiculo.apelido}`,
      valor: new Prisma.Decimal(arredondar(dados.valorTotal)),
      dataCompetencia: dados.data,
      dataVencimento: dados.dataVencimento ?? dados.data,
      veiculoId: dados.veiculoId,
      // Sem viagem, e de propósito: um tanque cheio atende várias viagens, e
      // amarrá-lo a uma delas jogava o diesel inteiro na primeira que o
      // motorista anotou. O custo é do caminhão no mês, valor exato.
      viagemId: null,
      fornecedorId: dados.fornecedorId,
      formaPagamento: dados.formaPagamento,
      observacoes: dados.observacoes ?? null,
    },
    select: { id: true },
  })

  const campos = {
    veiculoId: dados.veiculoId,
    viagemId: null,
    motoristaId: dados.motoristaId ?? null,
    fornecedorId: dados.fornecedorId,
    data: dados.data,
    litros: new Prisma.Decimal(dados.litros),
    valorLitro: new Prisma.Decimal(dados.valorLitro.toFixed(4)),
    valorTotal: new Prisma.Decimal(arredondar(dados.valorTotal)),
    odometro: dados.odometro ?? null,
    numeroNota: dados.numeroNota ?? null,
    tanqueCheio: dados.tanqueCheio,
    lancamentoId: lancamento.id,
  }

  const abastecimentoId = entrada.id
    ? (await tx.abastecimento.update({
        where: { id: entrada.id },
        data: campos,
        select: { id: true },
      })).id
    : (await tx.abastecimento.create({ data: campos, select: { id: true } })).id

  // O odômetro só avança; um abastecimento antigo lançado depois não pode
  // puxar a leitura do veículo para trás. Vale igual na correção: baixar o km
  // aqui não desfaz as leituras que vieram depois desta.
  if (
    veiculo.tipo !== 'CARRETA' &&
    dados.odometro != null &&
    dados.odometro > (veiculo.odometroAtual ?? 0)
  ) {
    await tx.veiculo.update({
      where: { id: dados.veiculoId },
      data: { odometroAtual: dados.odometro },
    })
  }

  return abastecimentoId
}

/** Apaga o abastecimento e a conta a pagar que ele criou. */
export async function apagarAbastecimento(tx: Tx, id: string): Promise<void> {
  const atual = await tx.abastecimento.findUnique({
    where: { id },
    select: { id: true, lancamentoId: true },
  })
  if (!atual) throw new Error('Abastecimento não encontrado.')

  const ids = await titulosParaRegravar(
    tx,
    { id: atual.lancamentoId ?? '' },
    'Este abastecimento',
  )
  await tx.abastecimento.update({ where: { id: atual.id }, data: { lancamentoId: null } })
  await tx.lancamento.deleteMany({ where: { id: { in: ids } } })
  await tx.abastecimento.delete({ where: { id: atual.id } })
}

// ------------------------------------------------------------ Despesa avulsa

/**
 * O filtro que diz o que é uma despesa avulsa.
 *
 * Todo custo do sistema é um `Lancamento`, mas quase nenhum é editável por uma
 * tela genérica: o título de um frete pertence ao frete, o de um abastecimento
 * ao abastecimento, e as parcelas de uma manutenção à manutenção. Abrir
 * qualquer um desses na tela de despesa deixaria dois donos para o mesmo
 * registro — e o segundo a salvar apagaria o trabalho do primeiro.
 *
 * O `parcelamentoId: null` é o detalhe fácil de esquecer: só a primeira parcela
 * de uma manutenção tem a relação `manutencao` preenchida. Da segunda em diante
 * o vínculo é só o carimbo.
 */
export const DESPESA_AVULSA = {
  tipo: 'DESPESA',
  freteId: null,
  parcelamentoId: null,
  acertoId: null,
  recorrenciaId: null,
  abastecimento: { is: null },
  manutencao: { is: null },
  acertoGerado: { is: null },
} satisfies Prisma.LancamentoWhereInput

export type DadosDespesa = {
  categoriaId: string
  descricao: string
  valor: number
  data: Date
  dataVencimento?: Date | null
  viagemId?: string | null
  veiculoId?: string | null
  fornecedorId?: string | null
  formaPagamento: FormaPagamento
  observacoes?: string | null
}

/**
 * Cria ou corrige uma despesa que não é abastecimento nem manutenção.
 *
 * Pedágio, chapa, lavagem, seguro, licenciamento, contador. Sem esta tela a
 * cliente lançava tudo como manutenção — a única porta que o menu Custos
 * abria — e pedágio, que é custo direto da viagem, ia parar na camada de custo
 * do caminhão. O resultado não sumia, mas contava a história errada: o caminhão
 * parecia caro de manter por causa de pedágio.
 *
 * O veículo acompanha a viagem quando há uma: é o que permite a despesa cair no
 * caminhão certo sem a pessoa escolher duas vezes a mesma coisa.
 */
export async function gravarDespesa(
  tx: Tx,
  entrada: { id?: string; dados: DadosDespesa },
): Promise<string> {
  const { dados } = entrada

  const viagem = dados.viagemId
    ? await tx.viagem.findUnique({
        where: { id: dados.viagemId },
        select: { veiculoId: true, excluidaEm: true },
      })
    : null
  if (dados.viagemId && !viagem) throw new Error('Viagem não encontrada.')
  if (viagem?.excluidaEm) {
    throw new Error('Esta viagem foi excluída. Escolha outra ou restaure a viagem.')
  }

  const campos = {
    tipo: 'DESPESA' as const,
    categoriaId: dados.categoriaId,
    descricao: dados.descricao,
    valor: new Prisma.Decimal(arredondar(dados.valor)),
    dataCompetencia: dados.data,
    dataVencimento: dados.dataVencimento ?? dados.data,
    viagemId: dados.viagemId ?? null,
    veiculoId: viagem?.veiculoId ?? dados.veiculoId ?? null,
    fornecedorId: dados.fornecedorId ?? null,
    formaPagamento: dados.formaPagamento,
    observacoes: dados.observacoes ?? null,
  }

  if (!entrada.id) {
    const criada = await tx.lancamento.create({ data: campos, select: { id: true } })
    return criada.id
  }

  // Só edita o que nasceu nesta tela. Um id colado na barra de endereço não
  // pode virar a porta dos fundos para o título de um frete.
  const atual = await tx.lancamento.findFirst({
    where: { id: entrada.id, ...DESPESA_AVULSA },
    select: { id: true, valorPago: true },
  })
  if (!atual) {
    throw new Error(
      'Esta despesa não existe ou pertence a um frete, abastecimento ou manutenção — corrija pela tela dele.',
    )
  }
  if (Number(atual.valorPago) > 0) throw new Error(`Esta despesa ${RECUSA_BAIXA}`)

  await tx.lancamento.update({ where: { id: atual.id }, data: campos })
  return atual.id
}

/** Apaga uma despesa avulsa, se ninguém a pagou. */
export async function apagarDespesa(tx: Tx, id: string): Promise<void> {
  const atual = await tx.lancamento.findFirst({
    where: { id, ...DESPESA_AVULSA },
    select: { id: true, valorPago: true },
  })
  if (!atual) {
    throw new Error(
      'Esta despesa não existe ou pertence a um frete, abastecimento ou manutenção — exclua pela tela dele.',
    )
  }
  if (Number(atual.valorPago) > 0) throw new Error(`Esta despesa ${RECUSA_BAIXA}`)

  await tx.lancamento.delete({ where: { id: atual.id } })
}
