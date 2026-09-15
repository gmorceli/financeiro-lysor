import { AcaoPerigosa } from '@/components/acao-perigosa'
import { excluirManutencao } from '../../actions'

/**
 * Apagar de verdade, não cancelar.
 *
 * Manutenção não é documento fiscal: se foi lançada por engano — pedágio
 * digitado como manutenção preventiva, por exemplo — o certo é sumir com a
 * linha, e com a conta a pagar que ela criou.
 */
export function ExcluirManutencao({
  manutencaoId,
  descricao,
  parcelas,
  pago,
}: {
  manutencaoId: string
  descricao: string
  parcelas: number
  pago: boolean
}) {
  const conta =
    parcelas > 1 ? `as ${parcelas} parcelas no contas a pagar` : 'a conta a pagar'

  return (
    <AcaoPerigosa
      acao={excluirManutencao}
      id={manutencaoId}
      rotulo="Excluir esta manutenção"
      rotuloConfirmar="Excluir"
      pergunta={
        pago
          ? `"${descricao}" já tem pagamento registrado. Estorne a baixa antes de excluir — o sistema vai recusar.`
          : `Excluir "${descricao}"? Some da lista e leva ${conta} junto.`
      }
      destino="/custos/manutencoes"
    />
  )
}
