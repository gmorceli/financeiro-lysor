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
  numeroNota: string
  tanqueCheio: boolean
  formaPagamento: string
  dataVencimento: string
  observacoes: string
}

export type VeiculoAbastecimento = {
  id: string
  apelido: string
  odometroAtual: number | null
  /** Odômetro do último abastecimento de tanque cheio com km anotado. */
  ultimoTanqueCheio: { odometro: number } | null
}

/**
 * Lançamento de abastecimento.
 *
 * Sem cartão de combustível e com a cliente preferindo manter a anotação do
 * motorista, esta tela é a única fonte do maior custo variável da operação —
 * por isso é a mais enxuta do sistema e a mais preparada para o celular.
 *
 * O abastecimento é do **caminhão**, não da viagem. Um tanque cheio atende
 * várias viagens; escolher uma delas jogava o diesel inteiro na primeira que o
 * motorista anotou, e o lucro das outras saía alto pelo motivo errado. O custo
 * entra no fechamento do caminhão no mês, valor exato e sem rateio.
 *
 * O preço do litro aparece assim que litros e valor são preenchidos, e o km/l
 * quando há km anterior. É a chance de perceber o erro de digitação na hora:
 * 1,8 km/l salta aos olhos de quem conhece a frota.
 */
export function FormularioAbastecimento({
  veiculos,
  motoristas,
  fornecedores,
  abastecimento,
}: {
  veiculos: VeiculoAbastecimento[]
  motoristas: Array<{ id: string; nome: string }>
  fornecedores: Array<{ id: string; nome: string }>
  /** Presente só na correção de um abastecimento já lançado. */
  abastecimento?: AbastecimentoExistente
}) {
  const [veiculoId, setVeiculoId] = useState(abastecimento?.veiculoId ?? '')
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
              dica={
                veiculo?.odometroAtual != null
                  ? `Última leitura: ${formatarNumero(veiculo.odometroAtual)} km. Em branco se o motorista não anotou.`
                  : 'Conforme a anotação do motorista. Pode ficar em branco.'
              }
              erro={erros.odometro}
            >
              <Input
                name="odometro"
                type="number"
                inputMode="numeric"
                value={odometro}
                onChange={(e) => setOdometro(e.target.value)}
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

            <Campo
              label="Posto"
              obrigatorio
              dica="É por ele que a fatura do fim do mês encontra este abastecimento."
              erro={erros.fornecedorId}
            >
              <Select
                name="fornecedorId"
                defaultValue={abastecimento?.fornecedorId ?? ''}
                required
              >
                <option value="">Selecione…</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo
              label="Nº da nota ou fatura"
              dica="O posto fatura sem detalhamento; o número ajuda a conferir depois."
              erro={erros.numeroNota}
            >
              <Input name="numeroNota" defaultValue={abastecimento?.numeroNota} />
            </Campo>

            <Campo label="Motorista" erro={erros.motoristaId}>
              <Select
                name="motoristaId"
                defaultValue={abastecimento?.motoristaId ?? ''}
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
                {consumo === null && odometro === '' && (
                  <p className="mt-1 text-texto-suave">
                    Sem o km do painel não dá para calcular o km/l deste intervalo. O
                    custo entra igual.
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
                <option value="BOLETO">Faturado no posto</option>
                <option value="PIX">Pix</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TRANSFERENCIA">Transferência</option>
              </Select>
            </Campo>

            <Campo
              label="Vencimento"
              dica="Faturado: a data da fatura do posto. Em branco se pagou na hora."
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
