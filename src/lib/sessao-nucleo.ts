import { createHash, randomBytes } from 'node:crypto'
import type { Usuario } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Sessão sem cookie e sem redirect.
 *
 * A separação é o que torna a autenticação testável: `scripts/verificar-auth.ts`
 * exercita criação, expiração e revogação de sessão contra o Postgres de
 * verdade, sem precisar de requisição HTTP. `sessao.ts` é só a casca que lê o
 * cookie e desvia a navegação.
 */

/**
 * Trinta dias. A operação acontece muito no celular e boa parte dela de
 * madrugada, na beira do caminhão — obrigar login toda semana faria a pessoa
 * escolher uma senha curta, que é o oposto do que se quer.
 */
export const DIAS_DE_SESSAO = 30

/** O banco guarda o digest, nunca o token. Vazar o dump não vira sessão ativa. */
export function digerirToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function gerarToken() {
  return randomBytes(32).toString('base64url')
}

export type UsuarioLogado = Pick<
  Usuario,
  'id' | 'nome' | 'email' | 'perfil' | 'trocarSenha' | 'motoristaId'
>

export async function criarSessaoNoBanco(
  usuarioId: string,
  token: string,
  origem: { ip?: string | null; navegador?: string | null } = {},
) {
  const expiraEm = new Date(Date.now() + DIAS_DE_SESSAO * 24 * 60 * 60 * 1000)
  await prisma.sessao.create({
    data: {
      tokenHash: digerirToken(token),
      usuarioId,
      expiraEm,
      ip: origem.ip ?? null,
      navegador: origem.navegador ?? null,
    },
  })
  return expiraEm
}

/**
 * Resolve o token para um usuário, ou `null`.
 *
 * Três motivos para devolver `null`: token desconhecido, sessão vencida, usuário
 * desativado. O último é o que faz "tirar o acesso de alguém" valer na próxima
 * requisição, sem depender de apagar sessão nenhuma.
 */
export async function usuarioDoToken(token: string): Promise<UsuarioLogado | null> {
  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: digerirToken(token) },
    select: {
      expiraEm: true,
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          trocarSenha: true,
          motoristaId: true,
          ativo: true,
        },
      },
    },
  })

  if (!sessao) return null
  if (sessao.expiraEm.getTime() <= Date.now()) return null
  if (!sessao.usuario.ativo) return null

  const { ativo: _ativo, ...usuario } = sessao.usuario
  return usuario
}

export async function encerrarSessaoDoToken(token: string) {
  await prisma.sessao.deleteMany({ where: { tokenHash: digerirToken(token) } })
}

/**
 * Derruba todas as sessões de um usuário. Usado na troca de senha e quando um
 * administrador desativa alguém: senha nova com sessão antiga ainda valendo é
 * senha não trocada.
 */
export async function revogarSessoes(usuarioId: string) {
  await prisma.sessao.deleteMany({ where: { usuarioId } })
}

export async function limparSessoesVencidas() {
  await prisma.sessao.deleteMany({ where: { expiraEm: { lte: new Date() } } })
}
