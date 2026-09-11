import { prisma } from '@/lib/prisma'
import { StatusLancamento, type Prisma } from '@prisma/client'

/** Hoje em UTC, zerado, para comparar com colunas `date`. */
export function hojeUtc(): Date {
  const agora = new Date()
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()))
}

export function emDias(dias: number): Date {
  const data = hojeUtc()
  data.setUTCDate(data.getUTCDate() + dias)
  return data
}

/** Títulos em aberto ou parcialmente pagos. */
export const EM_ABERTO: Prisma.EnumStatusLancamentoFilter = {
  in: [StatusLancamento.ABERTO, StatusLancamento.PARCIAL],
}

export type TituloListado = Prisma.LancamentoGetPayload<{
  include: {
    categoria: { select: { nome: true } }
    cliente: { select: { razaoSocial: true; nomeFantasia: true } }
    fornecedor: { select: { nome: true } }
    proprietario: { select: { nome: true } }
    motorista: { select: { nome: true } }
    veiculo: { select: { apelido: true } }
  }
}>

const INCLUDE_TITULO = {
  categoria: { select: { nome: true } },
  cliente: { select: { razaoSocial: true, nomeFantasia: true } },
  fornecedor: { select: { nome: true } },
  proprietario: { select: { nome: true } },
  motorista: { select: { nome: true } },
  veiculo: { select: { apelido: true } },
} as const

export async function listarTitulos(
  tipo: 'RECEITA' | 'DESPESA',
  opcoes: { apenasAbertos?: boolean } = {},
) {
  return prisma.lancamento.findMany({
    where: {
      tipo,
      status: opcoes.apenasAbertos ? EM_ABERTO : { not: 'CANCELADO' },
    },
    include: INCLUDE_TITULO,
    // Títulos sem vencimento (esperando o gatilho AO_RECEBER) vão para o fim.
    orderBy: [{ dataVencimento: { sort: 'asc', nulls: 'last' } }, { criadoEm: 'asc' }],
    take: 300,
  })
}

/** Nome da outra ponta do título — quem paga ou quem recebe. */
export function contraparte(titulo: TituloListado): string {
  if (titulo.cliente) return titulo.cliente.nomeFantasia || titulo.cliente.razaoSocial
  if (titulo.fornecedor) return titulo.fornecedor.nome
  if (titulo.proprietario) return titulo.proprietario.nome
  if (titulo.motorista) return titulo.motorista.nome
  return '—'
}

/** Totais do painel financeiro. */
export async function resumoFinanceiro() {
  const hoje = hojeUtc()
  const em7 = emDias(7)

  const [aReceber, aPagar, vencidosReceber, vencidosPagar, venceEm7, recebidoMes, pagoMes] =
    await Promise.all([
      prisma.lancamento.aggregate({
        _sum: { valor: true, valorPago: true },
        _count: true,
        where: { tipo: 'RECEITA', status: EM_ABERTO },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true, valorPago: true },
        _count: true,
        where: { tipo: 'DESPESA', status: EM_ABERTO },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true },
        _count: true,
        where: { tipo: 'RECEITA', status: EM_ABERTO, dataVencimento: { lt: hoje } },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true },
        _count: true,
        where: { tipo: 'DESPESA', status: EM_ABERTO, dataVencimento: { lt: hoje } },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true },
        _count: true,
        where: {
          status: EM_ABERTO,
          dataVencimento: { gte: hoje, lte: em7 },
        },
      }),
      prisma.baixa.aggregate({
        _sum: { valor: true },
        where: {
          data: { gte: new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)) },
          lancamento: { tipo: 'RECEITA' },
        },
      }),
      prisma.baixa.aggregate({
        _sum: { valor: true },
        where: {
          data: { gte: new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)) },
          lancamento: { tipo: 'DESPESA' },
        },
      }),
    ])

  const saldoAberto = (a: { _sum: { valor: unknown; valorPago: unknown } }) =>
    Number(a._sum.valor ?? 0) - Number(a._sum.valorPago ?? 0)

  return {
    aReceber: saldoAberto(aReceber),
    aReceberQtd: aReceber._count,
    aPagar: saldoAberto(aPagar),
    aPagarQtd: aPagar._count,
    vencidosReceber: Number(vencidosReceber._sum.valor ?? 0),
    vencidosReceberQtd: vencidosReceber._count,
    vencidosPagar: Number(vencidosPagar._sum.valor ?? 0),
    vencidosPagarQtd: vencidosPagar._count,
    venceEm7: Number(venceEm7._sum.valor ?? 0),
    venceEm7Qtd: venceEm7._count,
    recebidoMes: Number(recebidoMes._sum.valor ?? 0),
    pagoMes: Number(pagoMes._sum.valor ?? 0),
  }
}
