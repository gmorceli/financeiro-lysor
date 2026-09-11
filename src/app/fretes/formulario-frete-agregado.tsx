'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Select, Textarea } from '@/components/ui'
import { calcularCobrancaAgregado, type RegraCobrancaAgregado } from '@/lib/calculos'
import { formatarMoeda } from '@/lib/utils'
import { salvarFreteAgregado } from './actions'

const hoje = () => new Date().toISOString().slice(0, 10)

/** Um frete de agregado já gravado, em texto para o formulário. */
export type FreteAgregadoExistente = {
  id: string
  proprietarioId: string
  clienteId: string
  fluxoFinanceiro: string
  dataEmissao: string
  numeroCte: string
  serie: string
  origem: string
  destino: string
  produto: string
  cabecas: string
  valorCte: string
  valorCargaNfe: string
  numeroNfe: string
  dataEntrega: string
  observacoes: string
}

export type AgregadoOpcao = {
  id: string
  nome: string
  regraCobranca: RegraCobrancaAgregado
}

/**
 * Frete rodado por agregado.
 *
 * Não existe viagem da Lysor aqui: o caminhão é do agregado, e a receita é a
 * comissão mais o seguro que ele paga. A conta aparece na tela conforme os
 * valores são digitados, mas quem grava é o servidor, a partir da regra
 * cadastrada — a tela é conferência, não entrada.
 */
export function FormularioFreteAgregado({ agregados, clientes, frete }: {
  agregados: AgregadoOpcao[]
  clientes: Array<{ id: string; nome: string }>
  /** Presente só na correção de um frete já lançado. */
  frete?: FreteAgregadoExistente
}) {
  const [agregadoId, setAgregadoId] = useState(
    frete?.proprietarioId ?? agregados[0]?.id ?? '',
  )
  const [valorCte, setValorCte] = useState(frete?.valorCte ?? '')
  const [valorCarga, setValorCarga] = useState(frete?.valorCargaNfe ?? '')

  const agregado = agregados.find((a) => a.id === agregadoId)
  const cte = Number(valorCte)
  const carga = Number(valorCarga)
  const podeCalcular =
    agregado && valorCte !== '' && valorCarga !== '' && Number.isFinite(cte) && Number.isFinite(carga)

  const cobranca = podeCalcular
    ? calcularCobrancaAgregado(cte, carga, agregado.regraCobranca)
    : null

  return (
    <Formulario
      action={salvarFreteAgregado}
      voltarPara="/fretes"
      rotuloSalvar={frete ? 'Salvar correção' : 'Lançar frete'}
    >
      {(erros) => (
        <>
          {frete && <input type="hidden" name="id" value={frete.id} />}
          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Agregado" obrigatorio erro={erros.proprietarioId}>
              <Select
                name="proprietarioId"
                value={agregadoId}
                onChange={(e) => setAgregadoId(e.target.value)}
                required
                autoFocus
              >
                <option value="">Selecione…</option>
                {agregados.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Cliente" obrigatorio erro={erros.clienteId}>
              <Select name="clienteId" defaultValue={frete?.clienteId ?? ''} required>
                <option value="">Selecione…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo
              label="Quem recebe do cliente"
              obrigatorio
              dica="Muda quem a Lysor cobra: o cliente ou o próprio agregado."
              erro={erros.fluxoFinanceiro}
            >
              <Select
                name="fluxoFinanceiro"
                defaultValue={frete?.fluxoFinanceiro ?? 'INTERMEDIADO'}
                required
              >
                <option value="INTERMEDIADO">A Lysor recebe e repassa ao agregado</option>
                <option value="DIRETO">O agregado recebe direto e repassa a comissão</option>
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
              <Input name="origem" defaultValue={frete?.origem} required />
            </Campo>

            <Campo label="Destino" obrigatorio erro={erros.destino}>
              <Input name="destino" defaultValue={frete?.destino} required />
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
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="text-sm font-semibold text-texto">
                Valores e o que a Lysor cobra
              </h2>
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
              label="Valor da nota fiscal da carga"
              obrigatorio
              dica="Base do seguro. Vem no XML do CT-e, no valor da carga."
              erro={erros.valorCargaNfe}
            >
              <Input
                name="valorCargaNfe"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valorCarga}
                onChange={(e) => setValorCarga(e.target.value)}
                required
              />
            </Campo>

            <Campo label="Número da nota fiscal" erro={erros.numeroNfe}>
              <Input name="numeroNfe" inputMode="numeric" defaultValue={frete?.numeroNfe} />
            </Campo>

            <Campo label="Data de entrega" erro={erros.dataEntrega}>
              <Input name="dataEntrega" type="date" defaultValue={frete?.dataEntrega} />
            </Campo>

            {cobranca && agregado && (
              <div className="rounded-lg bg-primaria-clara p-3 text-sm sm:col-span-2">
                <p className="font-medium text-primaria">A Lysor recebe deste frete</p>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <dt className="text-xs text-texto-suave">
                      Comissão ({agregado.regraCobranca.percentualCte ?? 0}%)
                    </dt>
                    <dd className="tabular-nums text-texto">
                      {formatarMoeda(cobranca.comissao)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-texto-suave">
                      Seguro ({agregado.regraCobranca.percentualSeguroCarga ?? 0}%)
                    </dt>
                    <dd className="tabular-nums text-texto">
                      {formatarMoeda(cobranca.seguro)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-texto-suave">Total</dt>
                    <dd className="font-semibold tabular-nums text-primaria">
                      {formatarMoeda(cobranca.total)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <Campo label="Observações" erro={erros.observacoes}>
              <Textarea name="observacoes" defaultValue={frete?.observacoes} />
            </Campo>
          </Card>
        </>
      )}
    </Formulario>
  )
}
