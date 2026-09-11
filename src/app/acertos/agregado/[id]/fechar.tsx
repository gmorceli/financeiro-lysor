'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { AvisoErro, Button, Campo, Checkbox, Input } from '@/components/ui'
import { ESTADO_INICIAL } from '@/lib/acoes'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { fecharAcertoDoAgregado } from '../../actions'

type Linha = {
  lancamentoId: string
  data: string
  referencia: string
  rota: string
  valorCte: number
  valorCarga: number
  comissao: number
  seguro: number
  valor: number
  tipo: 'DESPESA' | 'RECEITA'
  clientePagou: boolean
}

function BotaoFechar({ quantos, total }: { quantos: number; total: number }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || quantos === 0}>
      {pending
        ? 'Fechando…'
        : quantos === 0
          ? 'Escolha ao menos um CT-e'
          : `Fechar ${quantos} CT-e — ${formatarMoeda(total)}`}
    </Button>
  )
}

/**
 * A escolha é por CT-e, um a um, porque é assim que a cliente acerta: conforme
 * o cliente paga. Vêm marcados só os que já foram pagos; os outros ficam na
 * lista, desmarcados e sinalizados, porque esconder faria ela procurar no
 * extrato do banco por que o CT-e sumiu.
 */
export function FecharAcertoAgregado({
  proprietarioId,
  linhas,
  hoje,
}: {
  proprietarioId: string
  linhas: Linha[]
  hoje: string
}) {
  const [estado, formAction] = useActionState(fecharAcertoDoAgregado, ESTADO_INICIAL)
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(linhas.filter((l) => l.clientePagou).map((l) => l.lancamentoId)),
  )
  const router = useRouter()

  useEffect(() => {
    if (estado.ok) {
      router.push('/acertos')
      router.refresh()
    }
  }, [estado.ok, router])

  function alternar(id: string) {
    setMarcados((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  const escolhidas = linhas.filter((l) => marcados.has(l.lancamentoId))
  const total = escolhidas.reduce((s, l) => s + l.valor, 0)
  const comissao = escolhidas.reduce((s, l) => s + l.comissao, 0)
  const seguro = escolhidas.reduce((s, l) => s + l.seguro, 0)
  const cte = escolhidas.reduce((s, l) => s + l.valorCte, 0)
  const adiantados = escolhidas.filter((l) => !l.clientePagou).length
  const paga = escolhidas.some((l) => l.tipo === 'DESPESA')

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AvisoErro mensagem={estado.erroGeral} />
      <input type="hidden" name="proprietarioId" value={proprietarioId} />

      {/*
        Lista, não tabela. Em 375px uma tabela de sete colunas empurra o
        repasse para fora da tela — e o repasse é o número que decide o
        clique. Aqui cada CT-e é uma linha que cabe inteira, com o valor à
        direita e a conta que o gerou embaixo, em letra miúda.
      */}
      <ul className="flex flex-col divide-y divide-borda border-y border-borda">
        {linhas.map((l) => {
          const marcado = marcados.has(l.lancamentoId)
          return (
            <li key={l.lancamentoId}>
              <label
                className={
                  marcado
                    ? 'flex cursor-pointer items-start gap-3 py-3'
                    : 'flex cursor-pointer items-start gap-3 py-3 opacity-55'
                }
              >
                <span className="flex min-h-11 items-center">
                  <Checkbox
                    name="titulos"
                    value={l.lancamentoId}
                    checked={marcado}
                    onChange={() => alternar(l.lancamentoId)}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0 truncate font-medium text-texto">
                      {l.referencia === '—' ? l.rota : l.referencia}
                    </span>
                    <span className="whitespace-nowrap tabular-nums font-semibold text-texto">
                      {formatarMoeda(l.valor)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-texto-suave">
                    {formatarData(l.data)} · CT-e {formatarMoeda(l.valorCte)} − comissão{' '}
                    {formatarMoeda(l.comissao)} − seguro {formatarMoeda(l.seguro)}
                  </span>
                  {!l.clientePagou && (
                    <span className="mt-1 inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-alerta">
                      cliente ainda não pagou
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="rounded-lg border border-borda bg-fundo px-4 py-3">
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-texto-suave">
              {escolhidas.length} CT-e somando
            </dt>
            <dd className="tabular-nums text-texto">{formatarMoeda(cte)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-texto-suave">Comissão da Lysor</dt>
            <dd className="tabular-nums text-primaria">− {formatarMoeda(comissao)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-texto-suave">Seguro sobre a carga</dt>
            <dd className="tabular-nums text-primaria">− {formatarMoeda(seguro)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-borda pt-2 text-base font-medium">
            <dt className="text-texto">{paga ? 'A repassar ao agregado' : 'A receber do agregado'}</dt>
            <dd className="tabular-nums text-texto">{formatarMoeda(total)}</dd>
          </div>
        </dl>
      </div>

      {adiantados > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-texto">
          <strong className="font-medium text-alerta">
            {adiantados} CT-e que o cliente ainda não pagou
          </strong>{' '}
          estão marcados. Dá para acertar assim — é dinheiro seu saindo antes de entrar.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Data do acerto" erro={estado.errosPorCampo?.dataPagamento} obrigatorio>
          <Input name="dataPagamento" type="date" defaultValue={hoje} required />
        </Campo>
        <Campo label="Observação" erro={estado.errosPorCampo?.observacoes}>
          <Input name="observacoes" placeholder="Opcional" />
        </Campo>
      </div>

      <div className="border-t border-borda pt-4">
        <BotaoFechar quantos={escolhidas.length} total={total} />
        <p className="mt-2 text-xs text-texto-suave">
          Fechar dá baixa nestes títulos. Nenhum título novo é criado — eles já existem desde a
          emissão de cada CT-e.
        </p>
      </div>
    </form>
  )
}
