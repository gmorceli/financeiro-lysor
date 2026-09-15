import { AcaoPerigosa } from '@/components/acao-perigosa'
import { formatarNumero } from '@/lib/utils'
import { excluirAbastecimento } from '../../actions'

export function ExcluirAbastecimento({
  abastecimentoId,
  apelido,
  litros,
  pago,
}: {
  abastecimentoId: string
  apelido: string
  litros: number
  pago: boolean
}) {
  return (
    <AcaoPerigosa
      acao={excluirAbastecimento}
      id={abastecimentoId}
      rotulo="Excluir este abastecimento"
      rotuloConfirmar="Excluir"
      pergunta={
        pago
          ? 'Este abastecimento já foi pago. Estorne a baixa antes de excluir — o sistema vai recusar.'
          : `Excluir os ${formatarNumero(litros, 2)} litros do ${apelido}? Some da lista, do km/l do caminhão e do contas a pagar.`
      }
      destino="/custos/abastecimentos"
    />
  )
}
