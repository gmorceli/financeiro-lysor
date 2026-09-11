import { Prisma, type PrismaClient } from '@prisma/client'
import { arredondar } from '@/lib/calculos'
import { CATEGORIA } from '@/lib/categorias'

type Tx = Prisma.TransactionClient | PrismaClient

/** Sem prazo cadastrado, o título vence na própria emissão. */
function comPrazo(data: Date, dias: number): Date {
  const vencimento = new Date(data)
  vencimento.setDate(vencimento.getDate() + dias)
  return vencimento
}

async function categoriaId(tx: Tx, nome: string): Promise<string> {
  const categoria = await tx.categoria.findUnique({ where: { nome }, select: { id: true } })
  if (!categoria) throw new Error(`Categoria "${nome}" não encontrada. Rode "npm run db:seed".`)
  return categoria.id
}

/**
 * Gera os títulos financeiros de um frete.
 *
 * As três formas que o dinheiro toma nesta operação:
 *
 * 1. **Frota própria** — um recebível contra o cliente, pelo valor real do
 *    frete (que é o que se cobra, mesmo quando o CT-e sai pelo mínimo).
 *
 * 2. **Agregado intermediado** — o cliente paga a Lysor o valor cheio, e a
 *    Lysor repassa ao agregado o que sobra depois da comissão e do seguro.
 *    São dois títulos, e o de repasse tem gatilho `AO_RECEBER`: ele só ganha
 *    vencimento quando o cliente efetivamente pagar. É assim que a cliente
 *    trabalha — "acerta quando o cliente paga" — e é o que impede o fluxo de
 *    caixa de projetar uma saída que ainda não tem lastro.
 *
 * 3. **Agregado direto** — o agregado recebe do cliente e repassa só a
 *    comissão. A Lysor não tem nada a receber do cliente: um recebível só,
 *    contra o agregado.
 *
 * Idempotente: se o frete já tem títulos, não faz nada.
 */
export async function gerarTitulosDoFrete(tx: Tx, freteId: string): Promise<number> {
  const frete = await tx.frete.findUnique({
    where: { id: freteId },
    include: {
      cliente: { select: { razaoSocial: true, nomeFantasia: true, prazoPagamentoDias: true } },
      proprietario: { select: { nome: true } },
    },
  })
  if (!frete) throw new Error('Frete não encontrado')

  const jaTem = await tx.lancamento.count({ where: { freteId, status: { not: 'CANCELADO' } } })
  if (jaTem > 0) return 0

  const nomeCliente = frete.cliente.nomeFantasia || frete.cliente.razaoSocial
  const referencia = frete.numeroCte ? `CT-e ${frete.numeroCte}` : `${frete.origem} → ${frete.destino}`
  const vencimentoCliente = comPrazo(frete.dataEmissao, frete.cliente.prazoPagamentoDias)

  if (frete.modalidade === 'FROTA_PROPRIA') {
    await tx.lancamento.create({
      data: {
        tipo: 'RECEITA',
        categoriaId: await categoriaId(tx, CATEGORIA.RECEITA_FRETE),
        descricao: `Frete ${referencia} — ${nomeCliente}`,
        valor: frete.valorFreteReal,
        dataCompetencia: frete.dataEmissao,
        dataVencimento: vencimentoCliente,
        freteId: frete.id,
        viagemId: frete.viagemId,
        clienteId: frete.clienteId,
      },
    })
    return 1
  }

  // Modalidade agregado
  const comissao = Number(frete.valorComissaoAgregado ?? 0)
  const seguro = Number(frete.valorSeguroAgregado ?? 0)
  const nomeAgregado = frete.proprietario?.nome ?? 'agregado'

  if (frete.fluxoFinanceiro === 'DIRETO') {
    // O agregado recebe do cliente e repassa a comissão e o seguro à Lysor.
    await tx.lancamento.create({
      data: {
        tipo: 'RECEITA',
        categoriaId: await categoriaId(tx, CATEGORIA.COMISSAO_AGREGADO),
        descricao: `Comissão e seguro ${referencia} — ${nomeAgregado}`,
        valor: new Prisma.Decimal(arredondar(comissao + seguro)),
        dataCompetencia: frete.dataEmissao,
        dataVencimento: vencimentoCliente,
        freteId: frete.id,
        proprietarioId: frete.proprietarioId,
      },
    })
    return 1
  }

  // Intermediado: a Lysor recebe o cheio e repassa o líquido ao agregado.
  const receber = await tx.lancamento.create({
    data: {
      tipo: 'RECEITA',
      categoriaId: await categoriaId(tx, CATEGORIA.RECEITA_FRETE),
      descricao: `Frete ${referencia} — ${nomeCliente} (agregado ${nomeAgregado})`,
      valor: frete.valorCte,
      dataCompetencia: frete.dataEmissao,
      dataVencimento: vencimentoCliente,
      freteId: frete.id,
      clienteId: frete.clienteId,
    },
    select: { id: true },
  })

  const repasse = arredondar(Number(frete.valorCte) - comissao - seguro)
  await tx.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: await categoriaId(tx, CATEGORIA.REPASSE_AGREGADO),
      descricao: `Repasse ${referencia} — ${nomeAgregado}`,
      valor: new Prisma.Decimal(repasse),
      dataCompetencia: frete.dataEmissao,
      // Sem data: o vencimento nasce quando o cliente pagar.
      dataVencimento: null,
      gatilhoVencimento: 'AO_RECEBER',
      lancamentoOrigemId: receber.id,
      freteId: frete.id,
      proprietarioId: frete.proprietarioId,
    },
  })

  return 2
}

/**
 * Baixa um título e propaga o efeito para quem dependia dele.
 *
 * Títulos com gatilho `AO_RECEBER` ganham vencimento na data em que o título
 * de origem foi recebido — é o elo entre o contas a receber do cliente e o
 * acerto do agregado.
 */
export async function baixarTitulo(
  tx: Tx,
  lancamentoId: string,
  dados: { data: Date; valor: number; contaBancariaId?: string | null; observacoes?: string | null },
) {
  const lancamento = await tx.lancamento.findUnique({
    where: { id: lancamentoId },
    select: { valor: true, valorPago: true, status: true },
  })
  if (!lancamento) throw new Error('Lançamento não encontrado')
  if (lancamento.status === 'CANCELADO') throw new Error('Lançamento cancelado')

  await tx.baixa.create({
    data: {
      lancamentoId,
      data: dados.data,
      valor: new Prisma.Decimal(arredondar(dados.valor)),
      contaBancariaId: dados.contaBancariaId ?? null,
      observacoes: dados.observacoes ?? null,
    },
  })

  const pago = arredondar(Number(lancamento.valorPago) + dados.valor)
  const total = Number(lancamento.valor)
  // Tolerância de um centavo: diferença de arredondamento não deve deixar um
  // título eternamente "parcial" por R$ 0,01.
  const liquidado = pago >= total - 0.01

  await tx.lancamento.update({
    where: { id: lancamentoId },
    data: {
      valorPago: new Prisma.Decimal(pago),
      status: liquidado ? 'LIQUIDADO' : 'PARCIAL',
      dataPagamento: liquidado ? dados.data : null,
    },
  })

  if (liquidado) {
    const dependentes = await tx.lancamento.findMany({
      where: {
        lancamentoOrigemId: lancamentoId,
        gatilhoVencimento: 'AO_RECEBER',
        dataVencimento: null,
      },
      select: { id: true },
    })
    for (const dependente of dependentes) {
      await tx.lancamento.update({
        where: { id: dependente.id },
        data: { dataVencimento: dados.data },
      })
    }
    return { liquidado, dependentesLiberados: dependentes.length }
  }

  return { liquidado, dependentesLiberados: 0 }
}

/**
 * Refaz os títulos de um frete corrigido.
 *
 * `gerarTitulosDoFrete` é idempotente de propósito: chamado duas vezes, não
 * duplica. O efeito colateral é que corrigir o valor de um frete não mexia no
 * recebível — o CT-e passava a valer R$ 9.564 na tela e continuava sendo
 * cobrado R$ 10.000 do cliente, sem nenhum aviso.
 *
 * Só refaz o que ninguém tocou. Título com baixa registrada ou preso a um
 * acerto representa dinheiro que já andou: apagá-lo para regravar sumiria com
 * um pagamento real do histórico. Nesse caso a correção é estorno, e a função
 * diz isso em vez de fazer.
 */
export async function regerarTitulosDoFrete(tx: Tx, freteId: string): Promise<number> {
  const existentes = await tx.lancamento.findMany({
    where: { freteId, status: { not: 'CANCELADO' } },
    select: { id: true, valorPago: true, acertoId: true, lancamentoOrigemId: true },
  })
  if (existentes.length === 0) return gerarTitulosDoFrete(tx, freteId)

  const intocado = existentes.every((l) => Number(l.valorPago) === 0 && !l.acertoId)
  if (!intocado) {
    throw new Error(
      'Os títulos deste frete já têm baixa ou acerto lançado. Estorne antes de corrigir o valor.',
    )
  }

  // Dependentes primeiro: o repasse ao agregado aponta para o recebível do
  // cliente, e apagar o pai antes do filho viola a referência.
  const dependentes = existentes.filter((l) => l.lancamentoOrigemId)
  await tx.lancamento.deleteMany({ where: { id: { in: dependentes.map((l) => l.id) } } })
  await tx.lancamento.deleteMany({ where: { id: { in: existentes.map((l) => l.id) } } })

  return gerarTitulosDoFrete(tx, freteId)
}
