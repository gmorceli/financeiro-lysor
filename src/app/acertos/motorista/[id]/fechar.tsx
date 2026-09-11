'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { AvisoErro, Button, Campo, Input } from '@/components/ui'
import { ESTADO_INICIAL } from '@/lib/acoes'
import { formatarMoeda } from '@/lib/utils'
import { fecharAcertoDoMotorista } from '../../actions'

function BotaoFechar({ liquido }: { liquido: number }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Fechando…' : `Fechar acerto de ${formatarMoeda(liquido)}`}
    </Button>
  )
}

/**
 * O líquido é recalculado na tela enquanto a pessoa digita, e recalculado de
 * novo no servidor antes de gravar. O da tela existe para ela ver a conta
 * mudando; o do servidor é o que vale.
 */
export function FecharAcertoMotorista({
  motoristaId,
  inicio,
  fim,
  bruto,
  hoje,
}: {
  motoristaId: string
  inicio: string
  fim: string
  bruto: number
  hoje: string
}) {
  const [estado, formAction] = useActionState(fecharAcertoDoMotorista, ESTADO_INICIAL)
  const [adiantamentos, setAdiantamentos] = useState('')
  const [descontos, setDescontos] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (estado.ok) {
      router.push('/acertos')
      router.refresh()
    }
  }, [estado.ok, router])

  const liquido = bruto - (Number(adiantamentos) || 0) - (Number(descontos) || 0)
  const erros = estado.errosPorCampo ?? {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AvisoErro mensagem={estado.erroGeral} />
      <input type="hidden" name="motoristaId" value={motoristaId} />
      <input type="hidden" name="inicio" value={inicio} />
      <input type="hidden" name="fim" value={fim} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Adiantamentos no período"
          dica="Vale, dinheiro na estrada, qualquer coisa já entregue."
          erro={erros.adiantamentos}
        >
          <Input
            name="adiantamentos"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={adiantamentos}
            onChange={(e) => setAdiantamentos(e.target.value)}
            placeholder="0,00"
          />
        </Campo>

        <Campo label="Descontos" dica="Avaria, multa, o que for combinado." erro={erros.descontos}>
          <Input
            name="descontos"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={descontos}
            onChange={(e) => setDescontos(e.target.value)}
            placeholder="0,00"
          />
        </Campo>
      </div>

      <Campo label="Data do pagamento" erro={erros.dataPagamento} obrigatorio>
        <Input name="dataPagamento" type="date" defaultValue={hoje} required />
      </Campo>

      <Campo label="Observação" erro={erros.observacoes}>
        <Input name="observacoes" placeholder="Opcional" />
      </Campo>

      <div
        className={
          liquido < 0
            ? 'rounded-lg border border-red-200 bg-red-50 px-4 py-3'
            : 'rounded-lg border border-primaria/20 bg-primaria-clara px-4 py-3'
        }
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-texto-suave">Líquido a pagar</span>
          <span
            className={
              liquido < 0
                ? 'text-xl font-semibold tabular-nums text-erro'
                : 'text-xl font-semibold tabular-nums text-primaria'
            }
          >
            {formatarMoeda(liquido)}
          </span>
        </div>
        {liquido < 0 && (
          <p className="mt-1 text-xs text-erro">
            Adiantamentos e descontos passam do valor do acerto. Confira antes de fechar.
          </p>
        )}
      </div>

      <div className="border-t border-borda pt-4">
        <BotaoFechar liquido={liquido} />
        <p className="mt-2 text-xs text-texto-suave">
          Fechar cria a conta a pagar e trava a comissão destes fretes — eles não entram no
          próximo acerto.
        </p>
      </div>
    </form>
  )
}
