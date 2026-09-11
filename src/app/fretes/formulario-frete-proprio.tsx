'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Select, Textarea } from '@/components/ui'
import { formatarMoeda, rota } from '@/lib/utils'
import { salvarFreteProprio } from './actions'

const hoje = () => new Date().toISOString().slice(0, 10)

/** Um frete já gravado, com tudo em texto do jeito que o formulário consome. */
export type FreteProprioExistente = {
  id: string
  clienteId: string
  dataEmissao: string
  numeroCte: string
  serie: string
  origem: string
  destino: string
  produto: string
  cabecas: string
  pesoKg: string
  dataEntrega: string
  valorCte: string
  valorFreteReal: string
  valorPedagioDestacado: string
  valorIcms: string
  observacoes: string
}

/**
 * Frete de caminhão da Lysor.
 *
 * O ponto delicado é o par de valores: o CT-e às vezes sai pelo mínimo, e a
 * comissão do motorista e o lucro por frete seguem o valor combinado de fato.
 * O campo do valor real vem preenchido igual ao do CT-e — quando forem iguais,
 * o operador não digita nada; quando não, corrige e o sistema mostra a
 * diferença na hora.
 */
export function FormularioFreteProprio({
  viagemId,
  origemPadrao,
  destinoPadrao,
  clientes,
  frete,
}: {
  viagemId: string
  origemPadrao: string
  destinoPadrao: string
  clientes: Array<{ id: string; nome: string }>
  /** Presente só na correção de um frete já lançado. */
  frete?: FreteProprioExistente
}) {
  const [valorCte, setValorCte] = useState(frete?.valorCte ?? '')
  const [valorReal, setValorReal] = useState(frete?.valorFreteReal ?? '')
  // Na correção os dois valores já existem e não se acompanham mais.
  const [tocouNoReal, setTocouNoReal] = useState(frete !== undefined)

  // Enquanto o operador não mexer no valor real, ele acompanha o do CT-e.
  const realEfetivo = tocouNoReal ? valorReal : valorCte
  const cte = Number(valorCte)
  const real = Number(realEfetivo)
  const diferenca =
    valorCte !== '' && realEfetivo !== '' && Number.isFinite(cte) && Number.isFinite(real)
      ? real - cte
      : null

  return (
    <Formulario
      action={salvarFreteProprio}
      voltarPara={rota(`/viagens/${viagemId}`)}
      rotuloSalvar={frete ? 'Salvar correção' : 'Lançar frete'}
    >
      {(erros) => (
        <>
          <input type="hidden" name="viagemId" value={viagemId} />
          {frete && <input type="hidden" name="id" value={frete.id} />}

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Cliente" obrigatorio erro={erros.clienteId}>
              <Select name="clienteId" defaultValue={frete?.clienteId ?? ''} required autoFocus>
                <option value="">Selecione…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Data de emissão" obrigatorio erro={erros.dataEmissao}>
              <Input
                name="dataEmissao"
                type="date"
                defaultValue={frete?.dataEmissao ?? hoje()}
                required
              />
            </Campo>

            <Campo label="Número do CT-e" erro={erros.numeroCte}>
              <Input name="numeroCte" inputMode="numeric" defaultValue={frete?.numeroCte} />
            </Campo>

            <Campo label="Série" erro={erros.serie}>
              <Input name="serie" inputMode="numeric" defaultValue={frete?.serie} />
            </Campo>

            <Campo label="Origem" obrigatorio erro={erros.origem}>
              <Input name="origem" defaultValue={frete?.origem ?? origemPadrao} required />
            </Campo>

            <Campo label="Destino" obrigatorio erro={erros.destino}>
              <Input name="destino" defaultValue={frete?.destino ?? destinoPadrao} required />
            </Campo>

            <Campo label="Produto" erro={erros.produto}>
              <Input name="produto" defaultValue={frete?.produto ?? 'Bovinos'} />
            </Campo>

            <Campo label="Cabeças" erro={erros.cabecas}>
              <Input
                name="cabecas"
                type="number"
                inputMode="numeric"
                defaultValue={frete?.cabecas}
              />
            </Campo>

            <Campo label="Peso (kg)" erro={erros.pesoKg}>
              <Input
                name="pesoKg"
                type="number"
                inputMode="numeric"
                defaultValue={frete?.pesoKg}
              />
            </Campo>

            <Campo label="Data de entrega" erro={erros.dataEntrega}>
              <Input name="dataEntrega" type="date" defaultValue={frete?.dataEntrega} />
            </Campo>
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="text-sm font-semibold text-texto">Valores</h2>
            </div>

            <Campo label="Valor do CT-e" obrigatorio erro={erros.valorCte}>
              <Input
                name="valorCte"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valorCte}
                onChange={(e) => setValorCte(e.target.value)}
                required
              />
            </Campo>

            <Campo
              label="Valor real do frete"
              obrigatorio
              dica="O que foi combinado de verdade. Se for o mesmo do CT-e, deixe como está."
              erro={erros.valorFreteReal}
            >
              <Input
                name="valorFreteReal"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={realEfetivo}
                onChange={(e) => {
                  setTocouNoReal(true)
                  setValorReal(e.target.value)
                }}
                required
              />
            </Campo>

            {diferenca !== null && diferenca !== 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-alerta sm:col-span-2">
                O valor real está {formatarMoeda(Math.abs(diferenca))}{' '}
                {diferenca > 0 ? 'acima' : 'abaixo'} do CT-e. A comissão do motorista e o
                lucro deste frete usam o valor real.
              </div>
            )}

            <Campo label="Pedágio destacado" erro={erros.valorPedagioDestacado}>
              <Input
                name="valorPedagioDestacado"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={frete?.valorPedagioDestacado}
              />
            </Campo>

            <Campo label="ICMS" erro={erros.valorIcms}>
              <Input
                name="valorIcms"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={frete?.valorIcms}
              />
            </Campo>

            <Campo label="Observações" erro={erros.observacoes}>
              <Textarea name="observacoes" defaultValue={frete?.observacoes} />
            </Campo>
          </Card>
        </>
      )}
    </Formulario>
  )
}
