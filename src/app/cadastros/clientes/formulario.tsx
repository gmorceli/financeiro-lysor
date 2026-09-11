'use client'

import type { Prisma } from '@prisma/client'
import { Formulario } from '@/components/formulario'
import { Campo, Card, Checkbox, Input } from '@/components/ui'
import { salvarCliente } from './actions'

type Cliente = Prisma.ClienteGetPayload<object>

export function FormularioCliente({ cliente }: { cliente?: Cliente }) {
  return (
    <Formulario action={salvarCliente} voltarPara="/cadastros/clientes">
      {(erros) => (
        <>
          {cliente && <input type="hidden" name="id" value={cliente.id} />}
          <Card className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Razão social" obrigatorio erro={erros.razaoSocial}>
              <Input name="razaoSocial" defaultValue={cliente?.razaoSocial} required autoFocus />
            </Campo>
            <Campo label="Nome fantasia" erro={erros.nomeFantasia}>
              <Input name="nomeFantasia" defaultValue={cliente?.nomeFantasia ?? ''} />
            </Campo>
            <Campo label="CNPJ ou CPF" erro={erros.cnpj}>
              <Input name="cnpj" defaultValue={cliente?.cnpj ?? ''} inputMode="numeric" />
            </Campo>
            <Campo
              label="Prazo de pagamento (dias)"
              dica="Zero para pagamento à vista. Serve para prever o caixa."
              erro={erros.prazoPagamentoDias}
            >
              <Input
                name="prazoPagamentoDias"
                type="number"
                inputMode="numeric"
                defaultValue={cliente?.prazoPagamentoDias ?? 0}
              />
            </Campo>
            <Campo label="Pessoa de contato" erro={erros.contato}>
              <Input name="contato" defaultValue={cliente?.contato ?? ''} />
            </Campo>
            <Campo label="Telefone" erro={erros.telefone}>
              <Input name="telefone" type="tel" defaultValue={cliente?.telefone ?? ''} />
            </Campo>
            <Campo label="E-mail" erro={erros.email}>
              <Input name="email" type="email" defaultValue={cliente?.email ?? ''} />
            </Campo>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm text-texto">
              <input type="hidden" name="ativo" value="false" />
              <Checkbox name="ativo" value="true" defaultChecked={cliente?.ativo ?? true} />
              Cliente ativo
            </label>
          </Card>
        </>
      )}
    </Formulario>
  )
}
