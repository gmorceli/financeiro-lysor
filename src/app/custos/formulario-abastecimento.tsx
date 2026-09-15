'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Checkbox, Input, Select, Textarea } from '@/components/ui'
import { calcularConsumo } from '@/lib/calculos'
import { formatarMoeda, formatarNumero } from '@/lib/utils'
import { salvarAbastecimento } from './actions'

const hoje = () => new Date().toISOString().slice(0, 10)

/** Um abastecimento já gravado, em texto do jeito que o formulário consome. */
export type AbastecimentoExistente = {
  id: string
  veiculoId: string
  motoristaId: string
  fornecedorId: string
  data: string
  litros: string
  valorTotal: string
  odometro: string
  tanqueCheio: boolean
  formaPagamento: string
  dataVencimento: string
  observacoes: string
}

export type VeiculoAbastecimento = {
  id: string
  apelido: string
  odometroAtual: number | null
  /** Odômetro e litros do último abastecimento de tanque cheio, se houver. */
  ultimoTanqueCheio: { odometro: number } | null
}

/**
 * Lançamento de abastecimento.
 *
 * Sem cartão de combustível e com a cliente preferindo manter a anotação do
 * motorista, esta tela é a única fonte do maior custo variável da operação —
 * por isso é a mais enxuta do sistema e a mais preparada para o celular.
 *
 * O consumo aparece assim que litros e odômetro são preenchidos, o que dá ao
 * operador uma chance de perceber o erro de digitação na hora: 1,8 km/l salta
 * aos olhos de quem conhece a frota.
 */
export function FormularioAbastecimento({
  veiculos,
  motoristas,
  fornecedores,
  viagemId,
  veiculoFixoId,
  motoristaSugeridoId,
  abastecimento,
}: {
  veiculos: VeiculoAbastecimento[]
  motoristas: Array<{ id: string; nome: string }>
  fornecedores: Array<{ id: string; nome: string }>
  viagemId?: string
  veiculoFixoId?: string
  motoristaSugeridoId?: string
  /** Presente só na correção de um abastecimento já lançado. */
  abastecimento?: AbastecimentoExistente
}) {
  const [veiculoId, setVeiculoId] = useState(
    abastecimento?.veiculoId ?? veiculoFixoId ?? '',
  )
  const [litros, setLitros] = useState(abastecimento?.litros ?? '')
  const [valorTotal, setValorTotal] = useState(abastecimento?.valorTotal ?? '')
  const [odometro, setOdometro] = useState(abastecimento?.odometro ?? '')
  const [tanqueCheio, setTanqueCheio] = useState(abastecimento?.tanqueCheio ?? true)

  const veiculo = veiculos.find((v) => v.id === veiculoId)
  const litrosNum = Number(litros)
  const totalNum = Number(valorTotal)
  const odometroNum = Number(odometro)

  const valorLitro =
    litros !== '' && valorTotal !== '' && litrosNum > 0 ? totalNum / litrosNum : null

  const consumo =
    tanqueCheio && veiculo?.ultimoTanqueCheio && odometro !== '' && litrosNum > 0
      ? calcularConsumo(veiculo.ultimoTanqueCheio.odometro, odometroNum, litrosNum)
      : null

  const odometroRetrocedeu =
    veiculo?.odometroAtual != null && odometro !== '' && odometroNum < veiculo.odometroAtual

  return (
    <Formulario
      action={salvarAbastecimento}
      voltarPara="/custos/abastecimentos"
      rotuloSalvar={abastecimento ? 'Salvar correção' : 'Lançar abastecimento'}
    >
      {(erros) => (
        <>
          {abastecimento && <input type="hidden" name="id" value={abastecimento.id} />}
          {viagemId && <input type="hidden" name="viagemId" value={viagemId} />}

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Caminhão" obrigatorio erro={erros.veiculoId}>
              <Select
                name="veiculoId"
                value={veiculoId}
                onChange={(e) => setVeiculoId(e.target.value)}
                required
                disabled={!!veiculoFixoId}
                autoFocus={!veiculoFixoId}
              >
                <option value="">Selecione…</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.apelido}
                  </option>
                ))}
              </Select>
              {veiculoFixoId && <input type="hidden" name="veiculoId" value={veiculoFixoId} />}
            </Campo>

            <Campo label="Data" obrigatorio erro={erros.data}>
              <Input
                name="data"
                type="date"
                defaultValue={abastecimento?.data ?? hoje()}
                required
              />
            </Campo>

            <Campo
              label="Km do painel"
              obrigatorio
              dica={
                veiculo?.odometroAtual != null
                  ? `Última leitura: ${formatarNumero(veiculo.odometroAtual)} km`
                  : 'O que está marcando no painel agora.'
              }
              erro={erros.odometro}
            >
              <Input
                name="odometro"
                type="number"
                inputMode="numeric"
                value={odometro}
                onChange={(e) => setOdometro(e.target.value)}
                required
                autoFocus={!!veiculoFixoId}
              />
            </Campo>

            <Campo label="Litros" obrigatorio erro={erros.litros}>
              <Input
                name="litros"
                type="number"
                step="0.001"
                inputMode="decimal"
                value={litros}
                onChange={(e) => setLitros(e.target.value)}
                required
              />
            </Campo>

            <Campo label="Valor pago" obrigatorio erro={erros.valorTotal}>
              <Input
                name="valorTotal"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                required
              />
            </Campo>

            <Campo label="Posto" erro={erros.fornecedorId}>
              <Select name="fornecedorId" defaultValue={abastecimento?.fornecedorId ?? ''}>
                <option value="">Não informado</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Motorista" erro={erros.motoristaId}>
              <Select
                name="motoristaId"
                defaultValue={abastecimento?.motoristaId ?? motoristaSugeridoId ?? ''}
              >
                <option value="">Não informado</option>
                {motoristas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <label className="flex min-h-11 items-center gap-2 self-end text-sm text-texto">
              <input type="hidden" name="tanqueCheio" value="false" />
              <Checkbox
                name="tanqueCheio"
                value="true"
                checked={tanqueCheio}
                onChange={(e) => setTanqueCheio(e.target.checked)}
              />
              Encheu o tanque
            </label>

            {odometroRetrocedeu && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-alerta sm:col-span-2">
                Esta quilometragem é menor que a última registrada
                {veiculo?.odometroAtual != null &&
                  ` (${formatarNumero(veiculo.odometroAtual)} km)`}
                . Confira antes de salvar — se for um lançamento atrasado, pode seguir.
              </div>
            )}

            {(valorLitro !== null || consumo !== null) && (
              <div className="rounded-lg bg-primaria-clara p-3 text-sm sm:col-span-2">
                {valorLitro !== null && (
                  <p className="text-texto">
                    Preço do litro: <strong>{formatarMoeda(valorLitro)}</strong>
                  </p>
                )}
                {consumo !== null && (
                  <p className="mt-1 text-texto">
                    Consumo desde o último tanque cheio:{' '}
                    <strong>{consumo.toFixed(2).replace('.', ',')} km/l</strong>
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Forma de pagamento" obrigatorio erro={erros.formaPagamento}>
              <Select
                name="formaPagamento"
                defaultValue={abastecimento?.formaPagamento ?? 'BOLETO'}
              >
                <option value="BOLETO">Boleto / faturado</option>
                <option value="PIX">Pix</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TRANSFERENCIA">Transferência</option>
              </Select>
            </Campo>

            <Campo
              label="Vencimento"
              dica="Deixe em branco se pagou na hora."
              erro={erros.dataVencimento}
            >
              <Input
                name="dataVencimento"
                type="date"
                defaultValue={abastecimento?.dataVencimento}
              />
            </Campo>

            <Campo label="Observações" erro={erros.observacoes}>
              <Textarea name="observacoes" defaultValue={abastecimento?.observacoes} />
            </Campo>
          </Card>
        </>
      )}
    </Formulario>
  )
}
