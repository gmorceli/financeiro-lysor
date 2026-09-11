import { calcularResultado, calcularResultadoPorFrete, limitesDoMes, mesAtual } from '@/lib/resultado'
import { montarPlanilhaResultado } from '@/lib/planilhas'
import { responderPlanilha } from '@/lib/planilha'
import { exigirAcessoNaRota } from '@/lib/sessao'

export const dynamic = 'force-dynamic'

export async function GET(requisicao: Request) {
  const { usuario, resposta } = await exigirAcessoNaRota('resultado')
  if (!usuario) return resposta

  const url = new URL(requisicao.url)
  const casa = url.searchParams.get('mes')?.match(/^(\d{4})-(\d{2})$/)
  const { ano, mes } = casa
    ? { ano: Number(casa[1]), mes: Math.min(12, Math.max(1, Number(casa[2]))) }
    : mesAtual()
  const { inicio, fim } = limitesDoMes(ano, mes)

  const [r, porFrete] = await Promise.all([
    calcularResultado(inicio, fim),
    calcularResultadoPorFrete(inicio, fim),
  ])

  return responderPlanilha(
    montarPlanilhaResultado(ano, mes, r, porFrete),
    `resultado-${ano}-${String(mes).padStart(2, '0')}.xlsx`,
  )
}
