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

/** Quantos títulos a tela carrega de uma vez. */
export const LIMITE_TELA = 300

/**
 * Títulos de uma ponta, com o total real do filtro.
 *
 * O total vem de um `aggregate` sobre o filtro inteiro, e não da soma das
 * linhas trazidas: a lista é cortada no limite, o total não. Somar só o que
 * coube na tela fazia o rodapé discordar do painel assim que passasse de 300
 * títulos em aberto — e a discordância seria silenciosa, que é o pior jeito de
 * errar dinheiro.
 */
export async function listarTitulos(
  tipo: 'RECEITA' | 'DESPESA',
  opcoes: { apenasAbertos?: boolean; limite?: number } = {},
) {
  const where = {
    tipo,
    status: opcoes.apenasAbertos ? EM_ABERTO : { not: 'CANCELADO' as const },
  }
  const limite = opcoes.limite ?? LIMITE_TELA

  const [titulos, totais] = await Promise.all([
    prisma.lancamento.findMany({
      where,
      include: INCLUDE_TITULO,
      // Títulos sem vencimento (esperando o gatilho AO_RECEBER) vão para o fim.
      orderBy: [{ dataVencimento: { sort: 'asc', nulls: 'last' } }, { criadoEm: 'asc' }],
      take: limite,
    }),
    prisma.lancamento.aggregate({ _sum: { valor: true, valorPago: true }, _count: true, where }),
  ])

  return {
    titulos,
    quantidade: totais._count,
    total: Number(totais._sum.valor ?? 0) - Number(totais._sum.valorPago ?? 0),
    naoExibidos: Math.max(0, totais._count - titulos.length),
  }
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
        _sum: { valor: true, valorPago: true },
        _count: true,
        where: { tipo: 'RECEITA', status: EM_ABERTO, dataVencimento: { lt: hoje } },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true, valorPago: true },
        _count: true,
        where: { tipo: 'DESPESA', status: EM_ABERTO, dataVencimento: { lt: hoje } },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true, valorPago: true },
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

  /*
    Sempre o saldo, nunca o valor de face. Um título PARCIAL de R$ 10.000 com
    R$ 6.000 já pagos deve R$ 4.000 — mostrar os R$ 10.000 no "vencido" faz o
    painel cobrar dinheiro que já entrou.
  */
  const saldoAberto = (a: { _sum: { valor: unknown; valorPago: unknown } }) =>
    Number(a._sum.valor ?? 0) - Number(a._sum.valorPago ?? 0)

  return {
    aReceber: saldoAberto(aReceber),
    aReceberQtd: aReceber._count,
    aPagar: saldoAberto(aPagar),
    aPagarQtd: aPagar._count,
    vencidosReceber: saldoAberto(vencidosReceber),
    vencidosReceberQtd: vencidosReceber._count,
    vencidosPagar: saldoAberto(vencidosPagar),
    vencidosPagarQtd: vencidosPagar._count,
    venceEm7: saldoAberto(venceEm7),
    venceEm7Qtd: venceEm7._count,
    recebidoMes: Number(recebidoMes._sum.valor ?? 0),
    pagoMes: Number(pagoMes._sum.valor ?? 0),
  }
}
