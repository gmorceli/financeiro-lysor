'use client'

import { useState } from 'react'
import type { Prisma } from '@prisma/client'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Checkbox, Input, Select } from '@/components/ui'
import { salvarMotorista } from './actions'

type Motorista = Prisma.MotoristaGetPayload<object>

export function FormularioMotorista({
  motorista,
  veiculos,
}: {
  motorista?: Motorista
  veiculos: Array<{ id: string; apelido: string }>
}) {
  const [modelo, setModelo] = useState(motorista?.modeloRemuneracao ?? 'HIBRIDO')
  const temSalario = modelo !== 'COMISSAO'
  const temComissao = modelo !== 'FIXO_MENSAL'

  return (
    <Formulario action={salvarMotorista} voltarPara="/cadastros/motoristas">
      {(erros) => (
        <>
          {motorista && <input type="hidden" name="id" value={motorista.id} />}

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Nome" obrigatorio erro={erros.nome}>
              <Input name="nome" defaultValue={motorista?.nome} required autoFocus />
            </Campo>
            <Campo label="CPF" obrigatorio erro={erros.cpf}>
              <Input name="cpf" defaultValue={motorista?.cpf} required inputMode="numeric" />
            </Campo>
            <Campo label="Telefone" erro={erros.telefone}>
              <Input name="telefone" type="tel" defaultValue={motorista?.telefone ?? ''} />
            </Campo>
            <Campo label="Vínculo" obrigatorio erro={erros.vinculo}>
              <Select name="vinculo" defaultValue={motorista?.vinculo ?? 'CLT'}>
                <option value="CLT">CLT</option>
                <option value="AUTONOMO">Autônomo</option>
                <option value="AGREGADO">Agregado</option>
              </Select>
            </Campo>
            <Campo label="CNH" erro={erros.cnh}>
              <Input name="cnh" defaultValue={motorista?.cnh ?? ''} inputMode="numeric" />
            </Campo>
            <Campo label="Categoria da CNH" erro={erros.cnhCategoria}>
              <Input
                name="cnhCategoria"
                defaultValue={motorista?.cnhCategoria ?? ''}
                placeholder="E"
                className="uppercase"
              />
            </Campo>
            <Campo
              label="Validade da CNH"
              dica="O sistema avisa quando estiver perto de vencer."
              erro={erros.cnhValidade}
            >
              <Input
                name="cnhValidade"
                type="date"
                defaultValue={
                  motorista?.cnhValidade
                    ? new Date(motorista.cnhValidade).toISOString().slice(0, 10)
                    : ''
                }
              />
            </Campo>
            <Campo label="Caminhão de sempre" erro={erros.veiculoPadraoId}>
              <Select name="veiculoPadraoId" defaultValue={motorista?.veiculoPadraoId ?? ''}>
                <option value="">Sem caminhão fixo</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.apelido}
                  </option>
                ))}
              </Select>
            </Campo>
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="text-sm font-semibold text-texto">Como é pago</h2>
              <p className="mt-0.5 text-sm text-texto-suave">
                É daqui que sai o acerto no fim de cada viagem.
              </p>
            </div>

            <Campo label="Forma de pagamento" obrigatorio erro={erros.modeloRemuneracao}>
              <Select
                name="modeloRemuneracao"
                value={modelo}
                onChange={(e) => setModelo(e.target.value as typeof modelo)}
              >
                <option value="COMISSAO">Só comissão</option>
                <option value="HIBRIDO">Salário + comissão</option>
                <option value="FIXO_MENSAL">Só salário</option>
              </Select>
            </Campo>

            {temSalario && (
              <Campo label="Salário mensal" obrigatorio erro={erros.salarioFixo}>
                <Input
                  name="salarioFixo"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={motorista?.salarioFixo?.toString() ?? ''}
                />
              </Campo>
            )}

            {temComissao && (
              <>
                <Campo label="Comissão (%)" obrigatorio erro={erros.percentualComissao}>
                  <Input
                    name="percentualComissao"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    defaultValue={motorista?.percentualComissao?.toString() ?? '12'}
                  />
                </Campo>
                <Campo
                  label="A comissão incide sobre"
                  obrigatorio
                  dica="Quando o CT-e sai pelo mínimo, a comissão segue o valor realmente combinado."
                  erro={erros.baseComissao}
                >
                  <Select name="baseComissao" defaultValue={motorista?.baseComissao ?? 'FRETE_REAL'}>
                    <option value="FRETE_REAL">Valor real do frete</option>
                    <option value="VALOR_CTE">Valor do CT-e</option>
                  </Select>
                </Campo>
              </>
            )}

            <Campo label="Diária de viagem" dica="Deixe zero se não pagam." erro={erros.valorDiaria}>
              <Input
                name="valorDiaria"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={motorista?.valorDiaria?.toString() ?? '0'}
              />
            </Campo>

            <label className="flex min-h-11 items-center gap-2 self-end text-sm text-texto">
              <input type="hidden" name="ativo" value="false" />
              <Checkbox name="ativo" value="true" defaultChecked={motorista?.ativo ?? true} />
              Motorista ativo
            </label>
          </Card>
        </>
      )}
    </Formulario>
  )
}
