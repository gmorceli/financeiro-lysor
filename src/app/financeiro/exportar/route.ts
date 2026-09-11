import { montarPlanilhaFinanceiro } from '@/lib/planilhas'
import { responderPlanilha } from '@/lib/planilha'
import { exigirAcessoNaRota } from '@/lib/sessao'
import { listarTitulos } from '../consultas'

export const dynamic = 'force-dynamic'

export async function GET(requisicao: Request) {
  const { usuario, resposta } = await exigirAcessoNaRota('financeiro')
  if (!usuario) return resposta

  const apenasAbertos = new URL(requisicao.url).searchParams.get('abertos') === 'sim'
  // A planilha existe justamente para ver tudo: o corte de tela não vale aqui.
  const [aPagar, aReceber] = await Promise.all([
    listarTitulos('DESPESA', { apenasAbertos, limite: 20_000 }),
    listarTitulos('RECEITA', { apenasAbertos, limite: 20_000 }),
  ])

  const hoje = new Date().toISOString().slice(0, 10)
  return responderPlanilha(
    montarPlanilhaFinanceiro(aPagar.titulos, aReceber.titulos),
    `financeiro-${apenasAbertos ? 'em-aberto-' : ''}${hoje}.xlsx`,
  )
}
