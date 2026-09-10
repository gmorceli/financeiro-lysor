'use client'

import { useState } from 'react'
import type { Prisma } from '@prisma/client'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Checkbox, Input, Select } from '@/components/ui'
import { formatarMoeda } from '@/lib/utils'
import { salvarAgregado } from './actions'

type Proprietario = Prisma.ProprietarioGetPayload<object>

type RegraCobranca = {
  percentualCte?: number
  percentualSeguroCarga?: number
  quemPagaCombustivel?: string
  quemPagaPedagio?: string
}

/** Exemplo com números redondos, para o operador conferir a regra na hora. */
const EXEMPLO_CTE = 10_000
const EXEMPLO_CARGA = 500_000

export function FormularioAgregado({ agregado }: { agregado?: Proprietario }) {
  const regra = (agregado?.regraCobranca ?? {}) as RegraCobranca
  const [percentualCte, setPercentualCte] = useState(regra.percentualCte ?? 10)
  const [percentualSeguro, setPercentualSeguro] = useState(regra.percentualSeguroCarga ?? 0.06)

  const comissao = (EXEMPLO_CTE * percentualCte) / 100
  const seguro = (EXEMPLO_CARGA * percentualSeguro) / 100

  return (
    <Formulario action={salvarAgregado} voltarPara="/cadastros/agregados">
      {(erros) => (
        <>
          {agregado && <input type="hidden" name="id" value={agregado.id} />}

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Nome" obrigatorio erro={erros.nome}>
              <Input name="nome" defaultValue={agregado?.nome} required autoFocus />
            </Campo>
            <Campo label="CPF ou CNPJ" obrigatorio erro={erros.cpfCnpj}>
              <Input name="cpfCnpj" defaultValue={agregado?.cpfCnpj} required inputMode="numeric" />
            </Campo>
            <Campo label="Tipo" obrigatorio erro={erros.tipoPessoa}>
              <Select name="tipoPessoa" defaultValue={agregado?.tipoPessoa ?? 'PF'}>
                <option value="PF">Pessoa física</option>
                <option value="PJ">Empresa</option>
              </Select>
            </Campo>
            <Campo label="Telefone" erro={erros.telefone}>
              <Input name="telefone" type="tel" defaultValue={agregado?.telefone ?? ''} />
            </Campo>
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="text-sm font-semibold text-texto">Quanto a Lysor cobra dele</h2>
              <p className="mt-0.5 text-sm text-texto-suave">
                O agregado usa a estrutura da Lysor e paga por isso. O acerto acontece quando o
                cliente paga aquele CT-e.
              </p>
            </div>

            <Campo label="Percentual sobre o CT-e (%)" obrigatorio erro={erros.percentualCte}>
              <Input
                name="percentualCte"
                type="number"
                step="0.01"
                inputMode="decimal"
                required
                value={percentualCte}
                onChange={(e) => setPercentualCte(Number(e.target.value))}
              />
            </Campo>

            <Campo
              label="Seguro sobre o valor da carga (%)"
              obrigatorio
              dica="Incide sobre o valor da nota fiscal da mercadoria."
              erro={erros.percentualSeguroCarga}
            >
              <Input
                name="percentualSeguroCarga"
                type="number"
                step="0.0001"
                inputMode="decimal"
                required
                value={percentualSeguro}
                onChange={(e) => setPercentualSeguro(Number(e.target.value))}
              />
            </Campo>

            <Campo label="Quem paga o combustível" obrigatorio erro={erros.quemPagaCombustivel}>
              <Select
                name="quemPagaCombustivel"
                defaultValue={regra.quemPagaCombustivel ?? 'AGREGADO'}
              >
                <option value="AGREGADO">O agregado</option>
                <option value="TRANSPORTADORA">A Lysor</option>
              </Select>
            </Campo>

            <Campo label="Quem paga o pedágio" obrigatorio erro={erros.quemPagaPedagio}>
              <Select name="quemPagaPedagio" defaultValue={regra.quemPagaPedagio ?? 'AGREGADO'}>
                <option value="AGREGADO">O agregado</option>
                <option value="TRANSPORTADORA">A Lysor</option>
              </Select>
            </Campo>

            <div className="rounded-lg bg-primaria-clara p-3 text-sm sm:col-span-2">
              <p className="font-medium text-primaria">Conferindo com um exemplo</p>
              <p className="mt-1 text-texto">
                Um CT-e de {formatarMoeda(EXEMPLO_CTE)} com carga de{' '}
                {formatarMoeda(EXEMPLO_CARGA)} gera{' '}
                <strong>{formatarMoeda(comissao)}</strong> de comissão e{' '}
                <strong>{formatarMoeda(seguro)}</strong> de seguro —{' '}
                <strong>{formatarMoeda(comissao + seguro)}</strong> a cobrar.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-texto">
              <input type="hidden" name="ativo" value="false" />
              <Checkbox name="ativo" value="true" defaultChecked={agregado?.ativo ?? true} />
              Agregado ativo
            </label>
          </Card>
        </>
      )}
    </Formulario>
  )
}
