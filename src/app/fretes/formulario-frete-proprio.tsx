'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Select, Textarea } from '@/components/ui'
import { formatarMoeda, rota } from '@/lib/utils'
import { salvarFreteProprio } from './actions'

const hoje = () => new Date().toISOString().slice(0, 10)

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
}: {
  viagemId: string
  origemPadrao: string
  destinoPadrao: string
  clientes: Array<{ id: string; nome: string }>
}) {
  const [valorCte, setValorCte] = useState('')
  const [valorReal, setValorReal] = useState('')
  const [tocouNoReal, setTocouNoReal] = useState(false)

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
      rotuloSalvar="Lançar frete"
    >
      {(erros) => (
        <>
          <input type="hidden" name="viagemId" value={viagemId} />

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Cliente" obrigatorio erro={erros.clienteId}>
              <Select name="clienteId" required autoFocus>
                <option value="">Selecione…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Data de emissão" obrigatorio erro={erros.dataEmissao}>
              <Input name="dataEmissao" type="date" defaultValue={hoje()} required />
            </Campo>

            <Campo label="Número do CT-e" erro={erros.numeroCte}>
              <Input name="numeroCte" inputMode="numeric" />
            </Campo>

            <Campo label="Série" erro={erros.serie}>
              <Input name="serie" inputMode="numeric" />
            </Campo>

            <Campo label="Origem" obrigatorio erro={erros.origem}>
              <Input name="origem" defaultValue={origemPadrao} required />
            </Campo>

            <Campo label="Destino" obrigatorio erro={erros.destino}>
              <Input name="destino" defaultValue={destinoPadrao} required />
            </Campo>

            <Campo label="Produto" erro={erros.produto}>
              <Input name="produto" defaultValue="Bovinos" />
            </Campo>

            <Campo label="Cabeças" erro={erros.cabecas}>
              <Input name="cabecas" type="number" inputMode="numeric" />
            </Campo>

            <Campo label="Peso (kg)" erro={erros.pesoKg}>
              <Input name="pesoKg" type="number" inputMode="numeric" />
            </Campo>

            <Campo label="Data de entrega" erro={erros.dataEntrega}>
              <Input name="dataEntrega" type="date" />
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
              />
            </Campo>

            <Campo label="ICMS" erro={erros.valorIcms}>
              <Input name="valorIcms" type="number" step="0.01" inputMode="decimal" />
            </Campo>

            <Campo label="Observações" erro={erros.observacoes}>
              <Textarea name="observacoes" />
            </Campo>
          </Card>
        </>
      )}
    </Formulario>
  )
}
