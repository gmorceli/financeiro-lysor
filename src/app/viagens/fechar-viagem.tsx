'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Textarea } from '@/components/ui'
import { calcularKm } from '@/lib/calculos'
import { formatarNumero } from '@/lib/utils'
import { fecharViagem } from './actions'

const hoje = () => new Date().toISOString().slice(0, 10)

/**
 * Fechamento da viagem.
 *
 * O km rodado aparece assim que a chegada é digitada, e o km vazio sai sozinho
 * do que não foi carregado. Nesta operação o retorno vazio é a regra — medi-lo
 * é o que diferencia o custo por km real do imaginado.
 */
export function FecharViagem({
  viagemId,
  kmInicial,
}: {
  viagemId: string
  kmInicial: number
}) {
  const [kmSaida, setKmSaida] = useState(String(kmInicial))
  const [kmFinal, setKmFinal] = useState('')
  const [kmCarregado, setKmCarregado] = useState('')

  const saida = Number(kmSaida)
  const temSaida = kmSaida !== '' && Number.isFinite(saida)
  const final = Number(kmFinal)
  const temFinal = kmFinal !== '' && Number.isFinite(final) && temSaida && final >= saida
  const km = temFinal
    ? calcularKm(saida, final, kmCarregado === '' ? undefined : Number(kmCarregado))
    : null

  return (
    <Formulario
      action={fecharViagem}
      voltarPara="/viagens"
      rotuloSalvar="Fechar viagem"
    >
      {(erros) => (
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={viagemId} />

          <Campo label="Data de chegada" obrigatorio erro={erros.dataChegada}>
            <Input name="dataChegada" type="date" defaultValue={hoje()} required />
          </Campo>

          {/*
            A saída é editável porque nem sempre é verdade: viagem importada de
            MDF-e nasce com o km do cadastro do caminhão, e ninguém confere isso
            na importação. Aqui a pessoa está com o painel na frente.
          */}
          <Campo
            label="Km de saída"
            obrigatorio
            dica={`Estava ${formatarNumero(kmInicial)} km no cadastro. Corrija se o painel diz outra coisa.`}
            erro={erros.kmInicial}
          >
            <Input
              name="kmInicial"
              type="number"
              inputMode="numeric"
              value={kmSaida}
              onChange={(e) => setKmSaida(e.target.value)}
              required
            />
          </Campo>

          <Campo
            label="Km de chegada"
            obrigatorio
            erro={erros.kmFinal}
          >
            <Input
              name="kmFinal"
              type="number"
              inputMode="numeric"
              value={kmFinal}
              onChange={(e) => setKmFinal(e.target.value)}
              required
              autoFocus
            />
          </Campo>

          <Campo
            label="Km carregado"
            dica="Quanto rodou com carga. O resto entra como vazio."
            erro={erros.kmCarregado}
          >
            <Input
              name="kmCarregado"
              type="number"
              inputMode="numeric"
              value={kmCarregado}
              onChange={(e) => setKmCarregado(e.target.value)}
              max={km?.rodado}
            />
          </Campo>

          <Campo
            label="Km rodado a mais"
            dica="Só se rodou além do previsto por erro de terceiro."
            erro={erros.kmImprodutivo}
          >
            <Input name="kmImprodutivo" type="number" inputMode="numeric" />
          </Campo>

          <Campo label="Motivo do km a mais" erro={erros.motivoKmImprodutivo}>
            <Textarea
              name="motivoKmImprodutivo"
              placeholder="Endereço errado, carga não estava pronta…"
            />
          </Campo>

          {km && (
            <div className="rounded-lg bg-primaria-clara p-3 text-sm sm:col-span-2">
              <p className="font-medium text-primaria">Esta viagem</p>
              <p className="mt-1 text-texto">
                Rodou <strong>{formatarNumero(km.rodado)} km</strong>
                {km.carregado !== undefined && (
                  <>
                    {' — '}
                    {formatarNumero(km.carregado)} carregado e{' '}
                    <strong>{formatarNumero(km.vazio ?? 0)} vazio</strong>
                    {km.rodado > 0 && (
                      <> ({Math.round(((km.vazio ?? 0) / km.rodado) * 100)}% do total)</>
                    )}
                  </>
                )}
                .
              </p>
            </div>
          )}
        </Card>
      )}
    </Formulario>
  )
}
