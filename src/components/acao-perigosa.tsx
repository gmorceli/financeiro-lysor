'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AvisoErro, Button, Card } from '@/components/ui'
import type { EstadoFormulario } from '@/lib/acoes'
import { rota } from '@/lib/utils'

/**
 * Botão de ação que desfaz alguma coisa.
 *
 * Confirmação em dois toques, no lugar de `window.confirm`: o diálogo nativo é
 * fácil de fechar sem ler, e no celular ele cobre a tela inteira sem dizer o
 * que está prestes a sumir. Aqui a pergunta fica ao lado do botão, com o nome
 * do registro dentro dela.
 *
 * O erro volta da própria ação. Regras como "este frete já tem baixa" são
 * decididas no servidor, e é de lá que a frase tem de vir — repetir a regra no
 * cliente criaria duas verdades que envelhecem separadas.
 */
export function AcaoPerigosa({
  acao,
  id,
  rotulo,
  pergunta,
  rotuloConfirmar = 'Confirmar',
  destino,
  compacto = false,
}: {
  acao: (id: string) => Promise<EstadoFormulario>
  id: string
  rotulo: string
  pergunta: string
  rotuloConfirmar?: string
  /** Para onde ir quando der certo. Sem isso, só recarrega a tela. */
  destino?: string
  /** Dentro de uma célula de tabela, sem a margem e a moldura de bloco. */
  compacto?: boolean
}) {
  const [perguntando, setPerguntando] = useState(false)
  const [erro, setErro] = useState<string | undefined>()
  const [processando, comecar] = useTransition()
  const router = useRouter()

  function executar() {
    setErro(undefined)
    comecar(async () => {
      const estado = await acao(id)
      if (estado.ok) {
        setPerguntando(false)
        if (destino) router.push(rota(destino))
        router.refresh()
        return
      }
      setErro(estado.erroGeral ?? 'Não foi possível concluir.')
    })
  }

  if (!perguntando) {
    return (
      <div className={compacto ? undefined : 'mt-4'}>
        <AvisoErro mensagem={erro} />
        <Button variante="discreto" onClick={() => setPerguntando(true)}>
          {rotulo}
        </Button>
      </div>
    )
  }

  return (
    <Card className={compacto ? 'border-erro/30 p-3 text-left' : 'mt-4 border-erro/30 p-4'}>
      <p className="text-sm text-texto">{pergunta}</p>
      <AvisoErro mensagem={erro} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variante="perigo" onClick={executar} disabled={processando}>
          {processando ? 'Aguarde…' : rotuloConfirmar}
        </Button>
        <Button
          variante="secundario"
          onClick={() => {
            setPerguntando(false)
            setErro(undefined)
          }}
          disabled={processando}
        >
          Deixa pra lá
        </Button>
      </div>
    </Card>
  )
}
