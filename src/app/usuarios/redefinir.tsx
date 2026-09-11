'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AvisoErro, Button } from '@/components/ui'
import { ESTADO_INICIAL } from '@/lib/acoes'
import { redefinirSenha } from './actions'
import { SenhaSugerida } from './senha-sugerida'

function BotaoRedefinir() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variante="secundario" disabled={pending}>
      {pending ? 'Redefinindo…' : 'Redefinir senha'}
    </Button>
  )
}

export function FormularioRedefinirSenha({ usuarioId }: { usuarioId: string }) {
  const [estado, formAction] = useActionState(redefinirSenha, ESTADO_INICIAL)

  if (estado.ok) {
    return (
      <div className="rounded-lg border border-primaria/20 bg-primaria-clara px-4 py-3 text-sm text-primaria">
        Senha redefinida. A senha que está no campo acima é a que vale agora — passe para a pessoa.
        Todos os aparelhos em que ela estava logada foram desconectados.
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AvisoErro mensagem={estado.erroGeral} />
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <SenhaSugerida
        nome="senhaNova"
        label="Nova senha provisória"
        erro={estado.errosPorCampo?.senhaNova}
      />
      <div>
        <BotaoRedefinir />
      </div>
    </form>
  )
}
