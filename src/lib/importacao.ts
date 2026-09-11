import { Prisma, type PrismaClient } from '@prisma/client'
import { arredondar, calcularCobrancaAgregado } from '@/lib/calculos'
import { ehAgregado, lerManifesto, type ManifestoLido } from '@/lib/mdfe'
import { prisma } from '@/lib/prisma'
import { gerarTitulosDoFrete } from '@/lib/titulos'

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Importação de MDF-e.
 *
 * A regra que define o escopo: **a importação não cria cadastro.** Ela cria
 * viagem, frete e título, e só. Criar cliente com prazo de pagamento zero ou
 * motorista com comissão zero seria plantar um erro que ninguém vê — o caixa
 * passaria a projetar dinheiro à vista, e o acerto pagaria a menos. O arquivo
 * fiscal tem o nome e o documento, mas não tem a regra de negócio, e é a regra
 * que faz o número certo.
 *
 * Quando falta cadastro, a linha não importa e a tela diz exatamente o quê.
 */

export type Pendencia =
  | 'JA_IMPORTADO'
  | 'SEM_CTE'
  | 'VARIOS_CTE'
  | 'VEICULO_NAO_CADASTRADO'
  | 'MOTORISTA_NAO_CADASTRADO'
  | 'AGREGADO_NAO_CADASTRADO'
  | 'CLIENTE_NAO_CADASTRADO'
  | 'ESCOLHER_CLIENTE'

export type LinhaConferida = {
  manifesto: ManifestoLido
  agregado: boolean
  pendencias: Pendencia[]
  pronta: boolean
  veiculoId: string | null
  veiculoApelido: string | null
  motoristaId: string | null
  motoristaNome: string | null
  proprietarioId: string | null
  proprietarioNome: string | null
  clienteId: string | null
  clienteNome: string | null
  comissao: number
  seguro: number
}

export const EXPLICACAO: Record<Pendencia, string> = {
  JA_IMPORTADO: 'Este CT-e já está no sistema.',
  SEM_CTE: 'O manifesto não traz nenhum CT-e.',
  VARIOS_CTE: 'O manifesto traz mais de um CT-e. Lance esse frete pela tela.',
  VEICULO_NAO_CADASTRADO: 'A placa não está cadastrada em Veículos.',
  MOTORISTA_NAO_CADASTRADO: 'O CPF do motorista não está cadastrado.',
  AGREGADO_NAO_CADASTRADO: 'O dono do caminhão não está cadastrado em Agregados.',
  CLIENTE_NAO_CADASTRADO: 'Quem paga o frete não está cadastrado em Clientes.',
  ESCOLHER_CLIENTE: 'Escolha o cliente: o manifesto de agregado não diz quem é.',
}

function apenasDigitos(valor: string | null) {
  return valor ? valor.replace(/\D/g, '') : null
}

/**
 * Confere uma lista de manifestos contra os cadastros.
 *
 * Carrega os cadastros de uma vez e casa em memória: são dezenas de arquivos
 * por importação, e uma consulta por linha faria a tela demorar por nada.
 */
export async function conferirManifestos(
  manifestos: ManifestoLido[],
): Promise<LinhaConferida[]> {
  const [veiculos, motoristas, proprietarios, clientes, jaImportados] = await Promise.all([
    prisma.veiculo.findMany({ select: { id: true, apelido: true, placa: true } }),
    prisma.motorista.findMany({ select: { id: true, nome: true, cpf: true } }),
    prisma.proprietario.findMany({
      select: { id: true, nome: true, cpfCnpj: true, regraCobranca: true },
    }),
    prisma.cliente.findMany({ select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } }),
    prisma.frete.findMany({
      where: { chaveCte: { in: manifestos.map((m) => m.chaveCte).filter(Boolean) as string[] } },
      select: { chaveCte: true },
    }),
  ])

  const porPlaca = new Map(veiculos.map((v) => [apenasDigitos(v.placa) ?? v.placa.toUpperCase(), v]))
  const porPlacaTexto = new Map(veiculos.map((v) => [v.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''), v]))
  const porCpf = new Map(motoristas.map((m) => [apenasDigitos(m.cpf), m]))
  const porDoc = new Map(proprietarios.map((p) => [apenasDigitos(p.cpfCnpj), p]))
  const porCnpj = new Map(clientes.map((c) => [apenasDigitos(c.cnpj), c]))
  const importados = new Set(jaImportados.map((f) => f.chaveCte))

  return manifestos.map((m) => {
    const pendencias: Pendencia[] = []
    const agregado = ehAgregado(m)

    if (!m.chaveCte) pendencias.push('SEM_CTE')
    else if (importados.has(m.chaveCte)) pendencias.push('JA_IMPORTADO')
    if (m.quantosCte > 1) pendencias.push('VARIOS_CTE')

    const placa = m.placaTracao.replace(/[^A-Z0-9]/g, '')
    const veiculo = porPlacaTexto.get(placa) ?? porPlaca.get(placa) ?? null
    const motorista = m.motoristaCpf ? (porCpf.get(m.motoristaCpf) ?? null) : null
    const proprietario = m.proprietarioDoc ? (porDoc.get(m.proprietarioDoc) ?? null) : null
    const cliente = m.pagadorDoc ? (porCnpj.get(m.pagadorDoc) ?? null) : null

    if (agregado) {
      if (!proprietario) pendencias.push('AGREGADO_NAO_CADASTRADO')
      // No manifesto de agregado quem consta como pagador é a própria Lysor: é
      // ela que paga o agregado. O cliente do frete não está no arquivo.
      pendencias.push('ESCOLHER_CLIENTE')
    } else {
      if (!veiculo) pendencias.push('VEICULO_NAO_CADASTRADO')
      if (!motorista) pendencias.push('MOTORISTA_NAO_CADASTRADO')
      if (!cliente) pendencias.push('CLIENTE_NAO_CADASTRADO')
    }

    const regra = (proprietario?.regraCobranca ?? {}) as {
      percentualCte?: number
      percentualSeguroCarga?: number
    }
    const cobranca = agregado
      ? calcularCobrancaAgregado(m.valorFrete, m.valorCarga, regra)
      : { comissao: 0, seguro: 0, total: 0 }

    const bloqueia = pendencias.filter((p) => p !== 'ESCOLHER_CLIENTE')

    return {
      manifesto: m,
      agregado,
      pendencias,
      pronta: bloqueia.length === 0,
      veiculoId: veiculo?.id ?? null,
      veiculoApelido: veiculo?.apelido ?? null,
      motoristaId: motorista?.id ?? null,
      motoristaNome: motorista?.nome ?? null,
      proprietarioId: proprietario?.id ?? null,
      proprietarioNome: proprietario?.nome ?? null,
      clienteId: cliente?.id ?? null,
      clienteNome: cliente ? (cliente.nomeFantasia || cliente.razaoSocial) : null,
      comissao: cobranca.comissao,
      seguro: cobranca.seguro,
    }
  })
}

/** Lê os arquivos que forem MDF-e e descarta o resto sem reclamar. */
export function lerArquivos(conteudos: string[]): ManifestoLido[] {
  const lidos = conteudos.map(lerManifesto).filter((m): m is ManifestoLido => m !== null)
  // Mesmo manifesto vindo duas vezes na seleção: vale uma.
  const porChave = new Map(lidos.map((m) => [m.chaveMdfe, m]))
  return [...porChave.values()].sort(
    (a, b) => a.dataViagem.getTime() - b.dataViagem.getTime(),
  )
}

/**
 * Importa uma linha conferida.
 *
 * Frota própria vira **viagem mais frete**: a viagem nasce com a quilometragem
 * atual do veículo, que é o mesmo palpite que a tela de abrir viagem já dá, e
 * fica em andamento para a pessoa fechar com o km real da chegada.
 *
 * Agregado vira **só frete**, sem viagem — é o caminhão do agregado que rodou.
 */
export async function importarLinha(
  tx: Tx,
  linha: LinhaConferida,
  escolhas: { clienteId?: string; valorFreteReal?: number; fluxoFinanceiro?: 'INTERMEDIADO' | 'DIRETO' },
) {
  const m = linha.manifesto
  if (!linha.pronta) throw new Error('Linha com pendência não pode ser importada.')
  if (!m.chaveCte) throw new Error('Manifesto sem CT-e.')

  const clienteId = escolhas.clienteId ?? linha.clienteId
  if (!clienteId) throw new Error('Frete precisa de cliente.')

  const jaTem = await tx.frete.count({ where: { chaveCte: m.chaveCte } })
  if (jaTem > 0) return { criado: false as const }

  const comum = {
    clienteId,
    origem: m.origem,
    destino: m.destino,
    numeroCte: m.numeroCte,
    chaveCte: m.chaveCte,
    valorCte: new Prisma.Decimal(m.valorFrete),
    dataEmissao: m.dataViagem,
    produto: m.produto,
    pesoKg: m.pesoKg,
    observacoes: `Importado do MDF-e ${m.numero}`,
  }

  if (linha.agregado) {
    const frete = await tx.frete.create({
      data: {
        ...comum,
        modalidade: 'AGREGADO',
        proprietarioId: linha.proprietarioId,
        fluxoFinanceiro: escolhas.fluxoFinanceiro ?? 'INTERMEDIADO',
        valorFreteReal: new Prisma.Decimal(m.valorFrete),
        valorCargaNfe: new Prisma.Decimal(m.valorCarga),
        valorComissaoAgregado: new Prisma.Decimal(linha.comissao),
        valorSeguroAgregado: new Prisma.Decimal(linha.seguro),
      },
      select: { id: true },
    })
    await gerarTitulosDoFrete(tx, frete.id)
    return { criado: true as const, freteId: frete.id, viagemId: null }
  }

  const veiculo = await tx.veiculo.findUniqueOrThrow({
    where: { id: linha.veiculoId! },
    select: { odometroAtual: true },
  })

  const viagem = await tx.viagem.create({
    data: {
      veiculoId: linha.veiculoId!,
      motoristaId: linha.motoristaId!,
      dataSaida: m.dataViagem,
      kmInicial: veiculo.odometroAtual ?? 0,
      origem: m.origem,
      destino: m.destino,
      status: 'EM_ANDAMENTO',
      observacoes: `Importada do MDF-e ${m.numero}`,
    },
    select: { id: true },
  })

  const frete = await tx.frete.create({
    data: {
      ...comum,
      viagemId: viagem.id,
      modalidade: 'FROTA_PROPRIA',
      // O CIOT declara o frete contratado. Quando o CT-e sai pelo mínimo, o
      // valor combinado é outro — e é sobre ele que a comissão incide, por isso
      // a tela deixa corrigir antes de importar.
      valorFreteReal: new Prisma.Decimal(
        escolhas.valorFreteReal && escolhas.valorFreteReal > 0
          ? arredondar(escolhas.valorFreteReal)
          : m.valorFrete,
      ),
      valorCargaNfe: new Prisma.Decimal(m.valorCarga),
    },
    select: { id: true },
  })
  await gerarTitulosDoFrete(tx, frete.id)

  return { criado: true as const, freteId: frete.id, viagemId: viagem.id }
}
