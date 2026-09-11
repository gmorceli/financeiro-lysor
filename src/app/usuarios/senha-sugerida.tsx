'use client'

import { useState } from 'react'
import { Button, Campo, Input } from '@/components/ui'

/**
 * Alfabeto sem 0/O, 1/l/I — a senha provisória vai ser ditada por telefone ou
 * colada no WhatsApp, e caractere ambíguo transforma isso em três tentativas.
 */
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789'

function sortear() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const letras = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length])
  // Em grupos de quatro: quem lê em voz alta não se perde no meio.
  return [letras.slice(0, 4), letras.slice(4, 8), letras.slice(8, 12)]
    .map((g) => g.join(''))
    .join('-')
}

/**
 * Senha provisória sorteada no navegador em vez de digitada pelo administrador.
 * Deixar a escolha na mão de quem cadastra é como nasce "lysor123" — e como ela
 * vai ter que ser trocada no primeiro acesso, o que importa é ser aleatória e
 * legível, não memorável.
 */
export function SenhaSugerida({
  nome = 'senha',
  label = 'Senha provisória',
  erro,
}: {
  nome?: string
  label?: string
  erro?: string[]
}) {
  const [senha, setSenha] = useState(sortear)

  return (
    <Campo
      label={label}
      dica="Passe para a pessoa. Ela vai ser obrigada a trocar no primeiro acesso."
      erro={erro}
      obrigatorio
    >
      <div className="flex gap-2">
        <Input
          name={nome}
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          required
        />
        <Button variante="secundario" onClick={() => setSenha(sortear())}>
          Outra
        </Button>
      </div>
    </Campo>
  )
}
