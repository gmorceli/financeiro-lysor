'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AvisoErro, Button, Campo, Input } from '@/components/ui'
import { ESTADO_INICIAL } from '@/lib/acoes'
import { SENHA_MINIMA } from '@/lib/regras-senha'
import { trocarSenha } from '../actions'

function BotaoSalvar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar senha nova'}
    </Button>
  )
}

export function FormularioTrocaDeSenha() {
  const [estado, formAction] = useActionState(trocarSenha, ESTADO_INICIAL)
  const erros = estado.errosPorCampo ?? {}

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <AvisoErro mensagem={estado.erroGeral} />

      <Campo label="Senha atual" erro={erros.senhaAtual} obrigatorio>
        <Input name="senhaAtual" type="password" autoComplete="current-password" required />
      </Campo>

      <Campo
        label="Senha nova"
        dica={`Pelo menos ${SENHA_MINIMA} caracteres. Frase curta funciona melhor que palavra difícil.`}
        erro={erros.senhaNova}
        obrigatorio
      >
        <Input name="senhaNova" type="password" autoComplete="new-password" required />
      </Campo>

      <Campo label="Repita a senha nova" erro={erros.confirmacao} obrigatorio>
        <Input name="confirmacao" type="password" autoComplete="new-password" required />
      </Campo>

      <div className="border-t border-borda pt-4">
        <BotaoSalvar />
      </div>
    </form>
  )
}
