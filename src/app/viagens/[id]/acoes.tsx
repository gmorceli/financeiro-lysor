import { AcaoPerigosa } from '@/components/acao-perigosa'
import { excluirLancamento } from './despesas/actions'
import { reabrirViagem } from '../actions'

/** Apagar um custo lançado errado, enquanto ninguém o pagou. */
export function ExcluirCusto({
  lancamentoId,
  descricao,
}: {
  lancamentoId: string
  descricao: string
}) {
  return (
    <AcaoPerigosa
      acao={excluirLancamento}
      id={lancamentoId}
      rotulo="Excluir"
      rotuloConfirmar="Excluir o custo"
      pergunta={`Excluir "${descricao}"? Some desta viagem e do contas a pagar.`}
      compacto
    />
  )
}

/** Reabrir para receber o custo que chegou depois do fechamento. */
export function ReabrirViagem({ viagemId, numero }: { viagemId: string; numero: number }) {
  return (
    <AcaoPerigosa
      acao={reabrirViagem}
      id={viagemId}
      rotulo="Reabrir viagem"
      rotuloConfirmar="Reabrir"
      pergunta={`Reabrir a viagem ${numero}? Ela volta para "em andamento" e aceita lançamento de novo.`}
    />
  )
}
