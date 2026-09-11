import { AcaoPerigosa } from '@/components/acao-perigosa'
import { excluirFrete } from '../actions'

/**
 * Cancelar é o único caminho de volta para um frete que já gerou título — e
 * cancelar aqui cancela também o que se cobrava do cliente por ele.
 */
export function CancelarFrete({
  freteId,
  referencia,
}: {
  freteId: string
  referencia: string
}) {
  return (
    <AcaoPerigosa
      acao={excluirFrete}
      id={freteId}
      rotulo="Cancelar este frete"
      rotuloConfirmar="Cancelar o frete"
      pergunta={`Cancelar ${referencia}? Ele sai da receita, da comissão do motorista e do contas a receber. Não tem como voltar atrás — se foi engano, lance o frete de novo.`}
      destino="/fretes"
    />
  )
}
