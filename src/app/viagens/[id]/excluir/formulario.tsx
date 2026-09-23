'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Select } from '@/components/ui'
import { formatarMoeda } from '@/lib/utils'
import { MOTIVOS_EXCLUSAO } from '@/lib/viagens'
import { excluirViagem } from '../../actions'

/**
 * Confirmação da exclusão.
 *
 * A escolha entre apagar e manter as despesas é a única decisão de verdade
 * desta tela, e por isso ela aparece com a consequência escrita ao lado. O
 * padrão é **manter**: o pedágio foi pago de qualquer jeito, e apagar por
 * omissão sumiria com dinheiro que saiu da conta. Apagar é para o caso em que
 * a viagem inteira era duplicata — aí a despesa também era.
 */
export function FormularioExclusao({
  viagemId,
  despesas,
}: {
  viagemId: string
  despesas: Array<{ id: string; descricao: string; categoria: string; valor: number }>
}) {
  const [motivo, setMotivo] = useState('')
  const total = despesas.reduce((soma, d) => soma + d.valor, 0)

  return (
    <Formulario
      action={excluirViagem}
      voltarPara="/viagens"
      rotuloSalvar="Confirmar exclusão"
    >
      {(erros) => (
        <>
          <input type="hidden" name="id" value={viagemId} />

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Motivo" obrigatorio erro={erros.motivo}>
              <Select
                name="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
                autoFocus
              >
                <option value="">Selecione…</option>
                {Object.entries(MOTIVOS_EXCLUSAO).map(([chave, rotulo]) => (
                  <option key={chave} value={chave}>
                    {rotulo}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo
              label={motivo === 'OUTRO' ? 'Qual o motivo' : 'Detalhe (opcional)'}
              obrigatorio={motivo === 'OUTRO'}
              erro={erros.motivoTexto}
            >
              <Input
                name="motivoTexto"
                required={motivo === 'OUTRO'}
                placeholder="Fica registrado com a data e o seu nome."
              />
            </Campo>
          </Card>

          {despesas.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-texto">
                {despesas.length} despesa{despesas.length === 1 ? '' : 's'} lançada
                {despesas.length === 1 ? '' : 's'} nesta viagem — {formatarMoeda(total)}
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-texto-suave">
                {despesas.map((d) => (
                  <li key={d.id} className="flex justify-between gap-4">
                    <span>
                      {d.descricao} <span className="text-xs">({d.categoria})</span>
                    </span>
                    <span className="tabular-nums">{formatarMoeda(d.valor)}</span>
                  </li>
                ))}
              </ul>

              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-medium text-texto">
                  O que fazer com elas?
                </legend>
                <label className="flex min-h-11 items-start gap-2 text-sm text-texto">
                  <input
                    type="radio"
                    name="despesas"
                    value="manter"
                    defaultChecked
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <strong className="font-medium">Manter como custo do caminhão.</strong>{' '}
                    O dinheiro saiu mesmo — o pedágio foi pago ainda que o CT-e estivesse
                    errado. Some da viagem, continua no resultado do caminhão no mês.
                  </span>
                </label>
                <label className="flex min-h-11 items-start gap-2 text-sm text-texto">
                  <input type="radio" name="despesas" value="excluir" className="mt-1 h-4 w-4" />
                  <span>
                    <strong className="font-medium">Excluir junto.</strong> Para quando a
                    viagem inteira era duplicata e a despesa também. Despesa já paga fica
                    de pé de qualquer forma, como custo do caminhão.
                  </span>
                </label>
              </fieldset>
            </Card>
          )}
        </>
      )}
    </Formulario>
  )
}
