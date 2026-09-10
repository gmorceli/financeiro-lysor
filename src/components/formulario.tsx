'use client'

import { useActionState } from 'react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { AvisoErro, Button } from '@/components/ui'
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/acoes'

function BotaoSalvar({ rotulo = 'Salvar' }: { rotulo?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : rotulo}
    </Button>
  )
}

/**
 * Casca comum dos formulários de cadastro: estado da action, erro geral,
 * botões e retorno para a lista depois de salvar.
 *
 * `children` recebe os erros por campo para distribuir entre os inputs.
 */
export function Formulario({
  action,
  voltarPara,
  children,
  rotuloSalvar,
}: {
  action: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>
  voltarPara: Route
  children: (errosPorCampo: Record<string, string[]>) => React.ReactNode
  rotuloSalvar?: string
}) {
  const [estado, formAction] = useActionState(action, ESTADO_INICIAL)
  const router = useRouter()

  useEffect(() => {
    if (estado.ok) {
      router.push(voltarPara)
      router.refresh()
    }
  }, [estado.ok, router, voltarPara])

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <AvisoErro mensagem={estado.erroGeral} />
      {children(estado.errosPorCampo ?? {})}
      <div className="flex flex-wrap gap-2 border-t border-borda pt-4">
        <BotaoSalvar rotulo={rotuloSalvar} />
        <Button variante="secundario" onClick={() => router.push(voltarPara)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
