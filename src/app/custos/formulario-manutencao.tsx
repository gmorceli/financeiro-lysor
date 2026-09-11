'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Select, Textarea } from '@/components/ui'
import { arredondar } from '@/lib/calculos'
import { formatarMoeda } from '@/lib/utils'
import { salvarManutencao } from './actions'

const hoje = () => new Date().toISOString().slice(0, 10)

/**
 * Manutenção. Peças e mão de obra são separadas porque a cliente compra peça
 * fora e paga a oficina só pelo serviço — e porque saber a proporção entre as
 * duas ajuda a decidir quando o caminhão está caro demais para manter.
 */
export function FormularioManutencao({
  veiculos,
  fornecedores,
}: {
  veiculos: Array<{ id: string; apelido: string; odometroAtual: number | null; tipo: string }>
  fornecedores: Array<{ id: string; nome: string }>
}) {
  const [veiculoId, setVeiculoId] = useState('')
  const [valorPecas, setValorPecas] = useState('')
  const [valorServico, setValorServico] = useState('')
  const [parcelas, setParcelas] = useState('1')

  const veiculo = veiculos.find((v) => v.id === veiculoId)
  const total = arredondar((Number(valorPecas) || 0) + (Number(valorServico) || 0))
  const numParcelas = Math.max(1, Number(parcelas) || 1)

  return (
    <Formulario
      action={salvarManutencao}
      voltarPara="/custos/manutencoes"
      rotuloSalvar="Lançar manutenção"
    >
      {(erros) => (
        <>
          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Veículo" obrigatorio erro={erros.veiculoId}>
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
              <Input name="data" type="date" defaultValue={hoje()} required />
            </Campo>

            <Campo label="Tipo" obrigatorio erro={erros.tipo}>
              <Select name="tipo" defaultValue="CORRETIVA">
                <option value="CORRETIVA">Corretiva — quebrou</option>
                <option value="PREVENTIVA">Preventiva</option>
                <option value="REVISAO">Revisão</option>
                <option value="PNEU">Pneu</option>
              </Select>
            </Campo>

            <Campo label="Oficina / fornecedor" erro={erros.fornecedorId}>
              <Select name="fornecedorId" defaultValue="">
                <option value="">Não informado</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            {veiculo?.tipo !== 'CARRETA' && (
              <Campo
                label="Km do painel"
                dica="Ajuda a saber de quanto em quanto tempo a peça costuma durar."
                erro={erros.odometro}
              >
                <Input
                  name="odometro"
                  type="number"
                  inputMode="numeric"
                  key={veiculoId || 'sem-veiculo'}
                  defaultValue={veiculo?.odometroAtual ?? ''}
                />
              </Campo>
            )}

            <Campo label="O que foi feito" obrigatorio erro={erros.descricao}>
              <Textarea name="descricao" required placeholder="Troca de embreagem, revisão dos 100 mil…" />
            </Campo>
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Valor das peças" erro={erros.valorPecas}>
              <Input
                name="valorPecas"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valorPecas}
                onChange={(e) => setValorPecas(e.target.value)}
              />
            </Campo>

            <Campo label="Valor da mão de obra" erro={erros.valorServico}>
              <Input
                name="valorServico"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valorServico}
                onChange={(e) => setValorServico(e.target.value)}
              />
            </Campo>

            <Campo label="Forma de pagamento" obrigatorio erro={erros.formaPagamento}>
              <Select name="formaPagamento" defaultValue="BOLETO">
                <option value="BOLETO">Boleto</option>
                <option value="CARTAO">Cartão</option>
                <option value="PIX">Pix</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TRANSFERENCIA">Transferência</option>
              </Select>
            </Campo>

            <Campo label="Parcelas" dica="1 para pagamento à vista." erro={erros.parcelas}>
              <Input
                name="parcelas"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
              />
            </Campo>

            <Campo
              label="Primeiro vencimento"
              dica="Deixe em branco se pagou na hora."
              erro={erros.dataVencimento}
            >
              <Input name="dataVencimento" type="date" />
            </Campo>

            {total > 0 && (
              <div className="rounded-lg bg-primaria-clara p-3 text-sm sm:col-span-2">
                <p className="text-texto">
                  Total: <strong>{formatarMoeda(total)}</strong>
                  {numParcelas > 1 && (
                    <>
                      {' '}
                      em {numParcelas}x de{' '}
                      <strong>{formatarMoeda(arredondar(total / numParcelas))}</strong>, com
                      vencimento mensal
                    </>
                  )}
                  .
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </Formulario>
  )
}
