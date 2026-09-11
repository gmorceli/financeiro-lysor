'use client'

import { useState } from 'react'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { AvisoErro, Badge, Button, Campo, Card, Input, Td } from '@/components/ui'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { ESTADO_INICIAL } from '@/lib/acoes'
import { registrarBaixa } from '@/app/financeiro/actions'

const hoje = () => new Date().toISOString().slice(0, 10)

function BotaoConfirmar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Confirmar'}
    </Button>
  )
}

/**
 * Baixa de título. Abre em linha na própria tabela, sem tirar o operador da
 * lista — ela vai dar baixa em vários seguidos, e cada navegação extra é
 * atrito multiplicado.
 */
export function BaixaDeTitulo({
  lancamentoId,
  tipo,
  valorRestante,
}: {
  lancamentoId: string
  tipo: 'RECEITA' | 'DESPESA'
  valorRestante: number
}) {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState(registrarBaixa, ESTADO_INICIAL)
  const router = useRouter()

  useEffect(() => {
    if (estado.ok) {
      setAberto(false)
      router.refresh()
    }
  }, [estado.ok, router])

  if (!aberto) {
    return (
      <Button variante="secundario" onClick={() => setAberto(true)}>
        {tipo === 'RECEITA' ? 'Receber' : 'Pagar'}
      </Button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="lancamentoId" value={lancamentoId} />
      <AvisoErro mensagem={estado.erroGeral} />
      <div className="flex flex-wrap items-end gap-2">
        <Campo label="Data" erro={estado.errosPorCampo?.data}>
          <Input name="data" type="date" defaultValue={hoje()} className="w-40" required />
        </Campo>
        <Campo label="Valor" erro={estado.errosPorCampo?.valor}>
          <Input
            name="valor"
            type="number"
            step="0.01"
            inputMode="decimal"
            defaultValue={valorRestante.toFixed(2)}
            className="w-36"
            required
          />
        </Campo>
        <BotaoConfirmar />
        <Button variante="discreto" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/** Situação do título em relação ao vencimento. */
export function SituacaoTitulo({
  status,
  dataVencimento,
  gatilho,
}: {
  status: string
  dataVencimento: Date | null
  gatilho: string
}) {
  if (status === 'LIQUIDADO') return <Badge tom="positivo">Pago</Badge>
  if (status === 'PARCIAL') return <Badge tom="alerta">Parcial</Badge>

  if (!dataVencimento) {
    if (gatilho === 'AO_RECEBER') {
      return <Badge tom="neutro">Aguarda o cliente pagar</Badge>
    }
    return <Badge tom="neutro">Sem vencimento</Badge>
  }

  const hojeUtc = new Date()
  hojeUtc.setUTCHours(0, 0, 0, 0)
  if (dataVencimento < hojeUtc) return <Badge tom="erro">Vencido</Badge>
  return <Badge tom="neutro">Em aberto</Badge>
}

export function CelulaVencimento({
  dataVencimento,
  gatilho,
}: {
  dataVencimento: Date | null
  gatilho: string
}) {
  if (!dataVencimento) {
    return (
      <Td className="text-texto-suave">
        {gatilho === 'AO_RECEBER' ? 'ao receber' : '—'}
      </Td>
    )
  }
  const hojeUtc = new Date()
  hojeUtc.setUTCHours(0, 0, 0, 0)
  const vencido = dataVencimento < hojeUtc
  return (
    <Td className={vencido ? 'tabular-nums text-erro' : 'tabular-nums text-texto-suave'}>
      {formatarData(dataVencimento)}
    </Td>
  )
}

export function ValorRestante({ valor, valorPago }: { valor: number; valorPago: number }) {
  const restante = valor - valorPago
  if (valorPago === 0) return <>{formatarMoeda(valor)}</>
  return (
    <>
      {formatarMoeda(restante)}
      <span className="ml-1 text-xs font-normal text-texto-suave">
        de {formatarMoeda(valor)}
      </span>
    </>
  )
}
