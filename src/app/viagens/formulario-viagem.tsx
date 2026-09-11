'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Select, Textarea } from '@/components/ui'
import { formatarNumero } from '@/lib/utils'
import { criarViagem } from './actions'

export type VeiculoOpcao = {
  id: string
  apelido: string
  odometroAtual: number | null
  motoristaPadraoId: string | null
}

const hoje = () => new Date().toISOString().slice(0, 10)

/**
 * Abertura de viagem.
 *
 * Escolher o caminhão preenche sozinho o motorista de sempre e a quilometragem
 * de saída (o odômetro que ficou da última viagem). Na prática sobram origem e
 * destino para digitar — é o que sustenta a meta de fechar uma viagem em menos
 * de um minuto.
 */
export function FormularioViagem({
  veiculos,
  motoristas,
}: {
  veiculos: VeiculoOpcao[]
  motoristas: Array<{ id: string; nome: string }>
}) {
  const [veiculoId, setVeiculoId] = useState('')
  const veiculo = veiculos.find((v) => v.id === veiculoId)

  return (
    <Formulario action={criarViagem} voltarPara="/viagens" rotuloSalvar="Abrir viagem">
      {(erros) => (
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          <Campo label="Caminhão" obrigatorio erro={erros.veiculoId}>
            <Select
              name="veiculoId"
              value={veiculoId}
              onChange={(e) => setVeiculoId(e.target.value)}
              required
              autoFocus
            >
              <option value="">Selecione…</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.apelido}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Motorista" obrigatorio erro={erros.motoristaId}>
            <Select
              name="motoristaId"
              key={veiculo?.motoristaPadraoId ?? 'sem-motorista'}
              defaultValue={veiculo?.motoristaPadraoId ?? ''}
              required
            >
              <option value="">Selecione…</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Data de saída" obrigatorio erro={erros.dataSaida}>
            <Input name="dataSaida" type="date" defaultValue={hoje()} required />
          </Campo>

          <Campo
            label="Km de saída"
            obrigatorio
            dica={
              veiculo?.odometroAtual != null
                ? `Última leitura: ${formatarNumero(veiculo.odometroAtual)} km`
                : 'O km do painel na saída.'
            }
            erro={erros.kmInicial}
          >
            <Input
              name="kmInicial"
              type="number"
              inputMode="numeric"
              key={veiculo?.id ?? 'sem-veiculo'}
              defaultValue={veiculo?.odometroAtual ?? ''}
              required
            />
          </Campo>

          <Campo label="Origem" obrigatorio erro={erros.origem}>
            <Input name="origem" required placeholder="Fazenda, cidade…" />
          </Campo>

          <Campo label="Destino" obrigatorio erro={erros.destino}>
            <Input name="destino" required placeholder="Frigorífico, cidade…" />
          </Campo>

          <Campo label="Observações" erro={erros.observacoes}>
            <Textarea name="observacoes" />
          </Campo>
        </Card>
      )}
    </Formulario>
  )
}
