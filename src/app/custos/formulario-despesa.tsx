'use client'

import { useState } from 'react'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Select, Textarea } from '@/components/ui'
import { salvarDespesa } from './actions'

const hoje = () => new Date().toISOString().slice(0, 10)

export type CategoriaOpcao = {
  id: string
  nome: string
  /** Camada da cascata — é o que decide de qual lucro este custo sai. */
  camada: string
}

export type GrupoDeCategorias = {
  titulo: string
  explicacao: string
  categorias: CategoriaOpcao[]
}

export type DespesaExistente = {
  id: string
  categoriaId: string
  viagemId: string
  veiculoId: string
  fornecedorId: string
  data: string
  descricao: string
  valor: string
  formaPagamento: string
  dataVencimento: string
  observacoes: string
}

/**
 * Despesa que não é abastecimento nem manutenção.
 *
 * A escolha do tipo é a decisão de verdade desta tela: é ela que diz de qual
 * lucro o custo sai. Por isso as opções vêm agrupadas pela camada da cascata,
 * com a consequência escrita ao lado — e não numa lista alfabética de trinta
 * nomes em que pedágio e contador parecem a mesma coisa.
 *
 * A cliente lançava pedágio como manutenção preventiva porque era a única porta
 * aberta no menu Custos. O resultado não sumia: ia para a camada errada, e o
 * caminhão parecia caro de manter por causa de pedágio.
 */
export function FormularioDespesa({
  grupos,
  viagens,
  veiculos,
  fornecedores,
  despesa,
}: {
  grupos: GrupoDeCategorias[]
  viagens: Array<{ id: string; rotulo: string }>
  veiculos: Array<{ id: string; apelido: string }>
  fornecedores: Array<{ id: string; nome: string }>
  /** Presente só na correção de uma despesa já lançada. */
  despesa?: DespesaExistente
}) {
  const [categoriaId, setCategoriaId] = useState(despesa?.categoriaId ?? '')
  const [viagemId, setViagemId] = useState(despesa?.viagemId ?? '')

  const todas = grupos.flatMap((g) => g.categorias)
  const escolhida = todas.find((c) => c.id === categoriaId)
  const grupoEscolhido = grupos.find((g) =>
    g.categorias.some((c) => c.id === categoriaId),
  )

  // Custo de viagem sem viagem ainda entra no resultado, mas ninguém sabe de
  // qual frete é. O aviso aparece na hora da escolha, não depois de salvar.
  const faltaViagem = escolhida?.camada === 'DIRETO_VIAGEM' && viagemId === ''

  return (
    <Formulario
      action={salvarDespesa}
      voltarPara="/custos/despesas"
      rotuloSalvar={despesa ? 'Salvar correção' : 'Lançar despesa'}
    >
      {(erros) => (
        <>
          {despesa && <input type="hidden" name="id" value={despesa.id} />}

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo
              label="Tipo de despesa"
              obrigatorio
              dica="É o tipo que decide de qual lucro este custo sai."
              erro={erros.categoriaId}
            >
              <Select
                name="categoriaId"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                required
                autoFocus
              >
                <option value="">Selecione…</option>
                {grupos.map((grupo) => (
                  <optgroup key={grupo.titulo} label={grupo.titulo}>
                    {grupo.categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Campo>

            <Campo label="Data" obrigatorio erro={erros.data}>
              <Input
                name="data"
                type="date"
                defaultValue={despesa?.data ?? hoje()}
                required
              />
            </Campo>

            {grupoEscolhido && (
              <p className="rounded-lg bg-primaria-clara p-3 text-sm text-texto sm:col-span-2">
                <strong className="font-medium text-primaria">
                  {grupoEscolhido.titulo}
                </strong>{' '}
                — {grupoEscolhido.explicacao}
              </p>
            )}

            <Campo label="Descrição" obrigatorio erro={erros.descricao}>
              <Input
                name="descricao"
                required
                defaultValue={despesa?.descricao}
                placeholder="Pedágio da BR-070, licenciamento 2026…"
              />
            </Campo>

            <Campo label="Valor" obrigatorio erro={erros.valor}>
              <Input
                name="valor"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={despesa?.valor}
                required
              />
            </Campo>

            <Campo
              label="Viagem"
              dica="Só para custo de viagem. Em branco, o custo entra sem dono de frete."
              erro={erros.viagemId}
            >
              <Select
                name="viagemId"
                value={viagemId}
                onChange={(e) => setViagemId(e.target.value)}
              >
                <option value="">Nenhuma</option>
                {viagens.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.rotulo}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo
              label="Caminhão"
              dica="Em branco, o custo fica da empresa, não de um caminhão."
              erro={erros.veiculoId}
            >
              <Select name="veiculoId" defaultValue={despesa?.veiculoId ?? ''}>
                <option value="">Nenhum</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.apelido}
                  </option>
                ))}
              </Select>
            </Campo>

            {faltaViagem && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-alerta sm:col-span-2">
                Custo de viagem sem viagem escolhida entra no resultado do mês, mas
                fora do lucro de qualquer frete — e aparece no relatório como custo
                sem dono. Se souber de qual viagem é, escolha acima.
              </div>
            )}
          </Card>

          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Fornecedor" erro={erros.fornecedorId}>
              <Select name="fornecedorId" defaultValue={despesa?.fornecedorId ?? ''}>
                <option value="">Não informado</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Forma de pagamento" obrigatorio erro={erros.formaPagamento}>
              <Select
                name="formaPagamento"
                defaultValue={despesa?.formaPagamento ?? 'DINHEIRO'}
              >
                <option value="DINHEIRO">Dinheiro</option>
                <option value="PIX">Pix</option>
                <option value="CARTAO">Cartão</option>
                <option value="BOLETO">Boleto</option>
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
                defaultValue={despesa?.dataVencimento}
              />
            </Campo>

            <Campo label="Observações" erro={erros.observacoes}>
              <Textarea name="observacoes" defaultValue={despesa?.observacoes} />
            </Campo>
          </Card>
        </>
      )}
    </Formulario>
  )
}
