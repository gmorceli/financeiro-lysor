import type { PerfilUsuario } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Duas travas que existem para o sistema não ficar sem dono:
 *
 * 1. ninguém tira o próprio acesso de administrador — o clique que parece
 *    inofensivo é o que deixa a empresa sem quem cadastre usuário;
 * 2. o último administrador ativo não pode ser rebaixado nem desativado, mesmo
 *    por outro administrador.
 *
 * Devolve a frase a mostrar, ou `null` quando a mudança pode seguir.
 */
export async function impedimentoDeAdmin(
  alvoId: string,
  autorId: string,
  novoPerfil: PerfilUsuario,
  ativo: boolean,
): Promise<string | null> {
  const alvo = await prisma.usuario.findUnique({
    where: { id: alvoId },
    select: { perfil: true, ativo: true },
  })
  if (!alvo) return null

  // Só interessa quando a mudança retira um administrador de circulação.
  const perdeAdmin = alvo.perfil === 'ADMIN' && alvo.ativo && (novoPerfil !== 'ADMIN' || !ativo)
  if (!perdeAdmin) return null

  if (alvoId === autorId) {
    return 'Você não pode remover o seu próprio acesso de administrador. Peça a outro administrador.'
  }

  const outros = await prisma.usuario.count({
    where: { perfil: 'ADMIN', ativo: true, id: { not: alvoId } },
  })
  if (outros === 0) {
    return 'Este é o último administrador ativo. Promova outra pessoa antes de mudar este.'
  }
  return null
}
