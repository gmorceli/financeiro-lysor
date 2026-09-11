'use client'

import type { Prisma } from '@prisma/client'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Checkbox, Input, Select } from '@/components/ui'
import { salvarFornecedor } from './actions'

type Fornecedor = Prisma.FornecedorGetPayload<object>

const CATEGORIAS = ['Posto', 'Oficina', 'Borracharia', 'Peças', 'Pedágio', 'Outros']

export function FormularioFornecedor({ fornecedor }: { fornecedor?: Fornecedor }) {
  return (
    <Formulario action={salvarFornecedor} voltarPara="/cadastros/fornecedores">
      {(erros) => (
        <>
          {fornecedor && <input type="hidden" name="id" value={fornecedor.id} />}
          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Nome" obrigatorio erro={erros.nome}>
              <Input name="nome" defaultValue={fornecedor?.nome} required autoFocus />
            </Campo>
            <Campo label="Tipo de fornecedor" erro={erros.categoria}>
              <Select name="categoria" defaultValue={fornecedor?.categoria ?? ''}>
                <option value="">Selecione…</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="CNPJ ou CPF" erro={erros.cpfCnpj}>
              <Input name="cpfCnpj" defaultValue={fornecedor?.cpfCnpj ?? ''} inputMode="numeric" />
            </Campo>
            <Campo label="Pessoa física ou empresa" erro={erros.tipoPessoa}>
              <Select name="tipoPessoa" defaultValue={fornecedor?.tipoPessoa ?? ''}>
                <option value="">Não informado</option>
                <option value="PF">Pessoa física</option>
                <option value="PJ">Empresa</option>
              </Select>
            </Campo>
            <Campo label="Telefone" erro={erros.telefone}>
              <Input name="telefone" type="tel" defaultValue={fornecedor?.telefone ?? ''} />
            </Campo>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm text-texto">
              <input type="hidden" name="ativo" value="false" />
              <Checkbox name="ativo" value="true" defaultChecked={fornecedor?.ativo ?? true} />
              Fornecedor ativo
            </label>
          </Card>
        </>
      )}
    </Formulario>
  )
}
