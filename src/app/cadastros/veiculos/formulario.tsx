'use client'

import { useState } from 'react'
import type { Prisma } from '@prisma/client'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Checkbox, Input, Select, Textarea } from '@/components/ui'
import { salvarVeiculo } from './actions'

type Veiculo = Prisma.VeiculoGetPayload<object>

export function FormularioVeiculo({
  veiculo,
  proprietarios,
}: {
  veiculo?: Veiculo
  proprietarios: Array<{ id: string; nome: string }>
}) {
  const [tipo, setTipo] = useState(veiculo?.tipo ?? 'CAVALO')
  const [tipoPosse, setTipoPosse] = useState(veiculo?.tipoPosse ?? 'PROPRIO')
  const ehCarreta = tipo === 'CARRETA'

  return (
    <Formulario action={salvarVeiculo} voltarPara="/cadastros/veiculos">
      {(erros) => (
        <>
          {veiculo && <input type="hidden" name="id" value={veiculo.id} />}

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo
              label="Apelido"
              obrigatorio
              dica='Como vocês chamam o veículo — "FH Vermelha", "Carreta Viloças". É o que aparece em todas as telas.'
              erro={erros.apelido}
            >
              <Input name="apelido" defaultValue={veiculo?.apelido} required autoFocus />
            </Campo>

            <Campo label="Placa" obrigatorio erro={erros.placa}>
              <Input
                name="placa"
                defaultValue={veiculo?.placa}
                required
                className="uppercase"
                placeholder="ABC1D23"
              />
            </Campo>

            <Campo label="Tipo" obrigatorio erro={erros.tipo}>
              <Select
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as typeof tipo)}
              >
                <option value="CAVALO">Cavalo mecânico</option>
                <option value="TRUCK">Truck</option>
                <option value="CARRETA">Carreta</option>
              </Select>
            </Campo>

            <Campo label="Situação" obrigatorio erro={erros.status}>
              <Select name="status" defaultValue={veiculo?.status ?? 'ATIVO'}>
                <option value="ATIVO">Ativo</option>
                <option value="MANUTENCAO">Em manutenção</option>
                <option value="INATIVO">Inativo</option>
                <option value="VENDIDO">Vendido</option>
              </Select>
            </Campo>

            <Campo label="De quem é" obrigatorio erro={erros.tipoPosse}>
              <Select
                name="tipoPosse"
                value={tipoPosse}
                onChange={(e) => setTipoPosse(e.target.value as typeof tipoPosse)}
              >
                <option value="PROPRIO">Da Lysor</option>
                <option value="AGREGADO">De agregado</option>
              </Select>
            </Campo>

            {tipoPosse === 'AGREGADO' && (
              <Campo label="Agregado" obrigatorio erro={erros.proprietarioId}>
                <Select name="proprietarioId" defaultValue={veiculo?.proprietarioId ?? ''}>
                  <option value="">Selecione…</option>
                  {proprietarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
            )}
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Marca" erro={erros.marca}>
              <Input name="marca" defaultValue={veiculo?.marca ?? ''} />
            </Campo>
            <Campo label="Modelo" erro={erros.modelo}>
              <Input name="modelo" defaultValue={veiculo?.modelo ?? ''} />
            </Campo>
            <Campo label="Ano" erro={erros.ano}>
              <Input name="ano" type="number" defaultValue={veiculo?.ano ?? ''} />
            </Campo>
            <Campo label="Eixos" erro={erros.eixos}>
              <Input name="eixos" type="number" defaultValue={veiculo?.eixos ?? ''} />
            </Campo>
            <Campo label="Capacidade (kg)" erro={erros.capacidadeKg}>
              <Input name="capacidadeKg" type="number" defaultValue={veiculo?.capacidadeKg ?? ''} />
            </Campo>
            <Campo label="Capacidade (cabeças)" erro={erros.capacidadeCabecas}>
              <Input
                name="capacidadeCabecas"
                type="number"
                defaultValue={veiculo?.capacidadeCabecas ?? ''}
              />
            </Campo>

            {!ehCarreta && (
              <Campo
                label="Quilometragem atual"
                dica="O km do painel hoje. É a base de todo cálculo de custo por km."
                erro={erros.odometroAtual}
              >
                <Input
                  name="odometroAtual"
                  type="number"
                  defaultValue={veiculo?.odometroAtual ?? ''}
                />
              </Campo>
            )}
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Data de aquisição" erro={erros.dataAquisicao}>
              <Input
                name="dataAquisicao"
                type="date"
                defaultValue={
                  veiculo?.dataAquisicao
                    ? new Date(veiculo.dataAquisicao).toISOString().slice(0, 10)
                    : ''
                }
              />
            </Campo>
            <Campo label="Valor de aquisição" erro={erros.valorAquisicao}>
              <Input
                name="valorAquisicao"
                type="number"
                step="0.01"
                defaultValue={veiculo?.valorAquisicao?.toString() ?? ''}
              />
            </Campo>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-texto">Isenções</span>
              <label className="flex items-center gap-2 text-sm text-texto">
                <input type="hidden" name="isentoIpva" value="false" />
                <Checkbox
                  name="isentoIpva"
                  value="true"
                  defaultChecked={veiculo?.isentoIpva ?? false}
                />
                Isento de IPVA
              </label>
              <label className="flex items-center gap-2 text-sm text-texto">
                <input type="hidden" name="isentoLicenciamento" value="false" />
                <Checkbox
                  name="isentoLicenciamento"
                  value="true"
                  defaultChecked={veiculo?.isentoLicenciamento ?? false}
                />
                Isento de licenciamento
              </label>
            </div>

            <Campo label="Observações" erro={erros.observacoes}>
              <Textarea name="observacoes" defaultValue={veiculo?.observacoes ?? ''} />
            </Campo>
          </Card>
        </>
      )}
    </Formulario>
  )
}
