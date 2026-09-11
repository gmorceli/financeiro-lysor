'use client'

import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui'
import { sair } from './conta/actions'

function BotaoSair() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variante="discreto" className="px-3 text-sm" disabled={pending}>
      {pending ? 'Saindo…' : 'Sair'}
    </Button>
  )
}

/**
 * Sair é POST, não link: um GET que encerra sessão é derrubado por qualquer
 * prefetch ou varredura de link do navegador.
 */
export function MenuDoUsuario({ nome, perfil }: { nome: string; perfil: string }) {
  const primeiroNome = nome.split(' ')[0]

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/conta/senha"
        className="hidden min-h-11 flex-col justify-center rounded-lg px-2 text-right text-sm leading-tight text-texto-suave transition-colors hover:bg-fundo hover:text-texto sm:flex sm:min-h-0"
        title="Trocar senha"
      >
        <span className="block font-medium text-texto">{primeiroNome}</span>
        <span className="block text-xs">{perfil}</span>
      </Link>
      <Link
        href="/conta/senha"
        className="flex min-h-11 items-center rounded-lg px-2 text-sm text-texto-suave transition-colors hover:bg-fundo hover:text-texto sm:hidden"
      >
        {primeiroNome}
      </Link>
      <form action={sair}>
        <BotaoSair />
      </form>
    </div>
  )
}
