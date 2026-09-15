import { AcaoPerigosa } from '@/components/acao-perigosa'
import { excluirDespesa } from '../../actions'

export function ExcluirDespesa({
  despesaId,
  descricao,
  pago,
}: {
  despesaId: string
  descricao: string
  pago: boolean
}) {
  return (
    <AcaoPerigosa
      acao={excluirDespesa}
      id={despesaId}
      rotulo="Excluir esta despesa"
      rotuloConfirmar="Excluir"
      pergunta={
        pago
          ? `"${descricao}" já foi paga. Estorne a baixa antes de excluir — o sistema vai recusar.`
          : `Excluir "${descricao}"? Some da lista e do contas a pagar.`
      }
      destino="/custos/despesas"
    />
  )
}
