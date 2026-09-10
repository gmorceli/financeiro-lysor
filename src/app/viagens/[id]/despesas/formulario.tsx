'use client'

import { Formulario } from '@/components/formulario'
import { Campo, Card, Input, Select } from '@/components/ui'
import { rota } from '@/lib/utils'
import { salvarDespesaViagem } from './actions'

const hoje = () => new Date().toISOString().slice(0, 10)

/** Despesa avulsa da viagem: pedágio, chapa, lavagem, alimentação. */
export function FormularioDespesaViagem({
  viagemId,
  categorias,
  fornecedores,
}: {
  viagemId: string
  categorias: Array<{ id: string; nome: string }>
  fornecedores: Array<{ id: string; nome: string }>
}) {
  return (
    <Formulario
      action={salvarDespesaViagem}
      voltarPara={rota(`/viagens/${viagemId}`)}
      rotuloSalvar="Lançar despesa"
    >
      {(erros) => (
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          <input type="hidden" name="viagemId" value={viagemId} />

          <Campo label="Tipo de despesa" obrigatorio erro={erros.categoriaId}>
            <Select name="categoriaId" required autoFocus>
              <option value="">Selecione…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Data" obrigatorio erro={erros.data}>
            <Input name="data" type="date" defaultValue={hoje()} required />
          </Campo>

          <Campo label="Descrição" obrigatorio erro={erros.descricao}>
            <Input name="descricao" required placeholder="Pedágio da BR-070, chapa…" />
          </Campo>

          <Campo label="Valor" obrigatorio erro={erros.valor}>
            <Input name="valor" type="number" step="0.01" inputMode="decimal" required />
          </Campo>

          <Campo label="Fornecedor" erro={erros.fornecedorId}>
            <Select name="fornecedorId" defaultValue="">
              <option value="">Não informado</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Forma de pagamento" obrigatorio erro={erros.formaPagamento}>
            <Select name="formaPagamento" defaultValue="DINHEIRO">
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
            <Input name="dataVencimento" type="date" />
          </Campo>
        </Card>
      )}
    </Formulario>
  )
}
