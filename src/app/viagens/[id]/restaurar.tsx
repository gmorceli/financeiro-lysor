import { AcaoPerigosa } from '@/components/acao-perigosa'
import { restaurarViagemExcluida } from '../actions'

/** Desfaz a exclusão — o clique que caiu na linha de cima tem volta. */
export function RestaurarViagem({
  viagemId,
  numero,
  compacto = false,
}: {
  viagemId: string
  numero: number
  compacto?: boolean
}) {
  return (
    <AcaoPerigosa
      acao={restaurarViagemExcluida}
      id={viagemId}
      rotulo="Restaurar"
      rotuloConfirmar="Restaurar a viagem"
      pergunta={`Restaurar a viagem ${numero}? Os CT-e dela voltam, e os recebíveis do cliente são gerados de novo.`}
      compacto={compacto}
    />
  )
}
