'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AvisoErro, Button, Campo, Input } from '@/components/ui'
import { ESTADO_INICIAL } from '@/lib/acoes'
import { entrar } from './actions'

function BotaoEntrar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
    </Button>
  )
}

export function FormularioLogin({ destino }: { destino?: string }) {
  const [estado, formAction] = useActionState(entrar, ESTADO_INICIAL)
  const erros = estado.errosPorCampo ?? {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AvisoErro mensagem={estado.erroGeral} />
      <input type="hidden" name="destino" value={destino ?? ''} />

      <Campo label="E-mail" erro={erros.email} obrigatorio>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoFocus
          required
        />
      </Campo>

      <Campo label="Senha" erro={erros.senha} obrigatorio>
        <Input name="senha" type="password" autoComplete="current-password" required />
      </Campo>

      <BotaoEntrar />
    </form>
  )
}
