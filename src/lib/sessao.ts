import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { PerfilUsuario } from '@prisma/client'
import { podeAcessar, type Area } from '@/lib/permissoes'
import { NOME_COOKIE } from '@/lib/cookie-sessao'
import {
  criarSessaoNoBanco,
  encerrarSessaoDoToken,
  gerarToken,
  limparSessoesVencidas,
  usuarioDoToken,
  type UsuarioLogado,
} from '@/lib/sessao-nucleo'

export { revogarSessoes } from '@/lib/sessao-nucleo'
export type { UsuarioLogado } from '@/lib/sessao-nucleo'
export { NOME_COOKIE } from '@/lib/cookie-sessao'

/**
 * Usuário da requisição atual, ou `null`.
 *
 * Envolvido em `cache` do React: o layout raiz, o layout da área e a página
 * chamam esta função na mesma renderização, e sem isso seriam três consultas
 * idênticas ao banco por navegação.
 */
export const usuarioDaSessao = cache(async (): Promise<UsuarioLogado | null> => {
  const token = (await cookies()).get(NOME_COOKIE)?.value
  if (!token) return null
  return usuarioDoToken(token)
})

/**
 * Exige sessão válida. Sem ela, volta para o login guardando o destino.
 *
 * `trocaDeSenha` só é usado pela própria tela de troca: com a flag de senha
 * provisória de pé, todo o resto do sistema desvia para lá. É o que garante que
 * a senha criada pelo administrador não fica valendo.
 */
export async function exigirUsuario({
  trocaDeSenha = false,
}: { trocaDeSenha?: boolean } = {}): Promise<UsuarioLogado> {
  const usuario = await usuarioDaSessao()
  if (!usuario) redirect('/entrar')
  if (usuario.trocarSenha && !trocaDeSenha) redirect('/conta/senha')
  return usuario
}

/**
 * Exige sessão **e** permissão de área. Chamado pelo layout de cada área e por
 * toda action que escreve — action é endpoint HTTP público, não basta esconder
 * o botão na tela.
 *
 * Desvia para uma tela que diz o que faltou em vez de devolver 403 seco: quem
 * bate aqui é colega de trabalho que clicou num link antigo, não invasor. O 403
 * nativo do Next (`forbidden()`) faria isso melhor, mas depende da flag
 * experimental `authInterrupts`, e a fronteira de permissão não vai se apoiar
 * em algo que pode mudar de comportamento entre releases.
 */
export async function exigirAcesso(area: Area): Promise<UsuarioLogado> {
  const usuario = await exigirUsuario()
  if (!podeAcessar(usuario.perfil, area)) {
    redirect(`/sem-acesso?area=${encodeURIComponent(area)}`)
  }
  return usuario
}

async function origemDaRequisicao() {
  const cabecalhos = await headers()
  return {
    ip: cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    navegador: cabecalhos.get('user-agent')?.slice(0, 300) ?? null,
  }
}

/**
 * Cria a sessão e grava o cookie. Só funciona de dentro de Server Action ou
 * Route Handler — renderização de página não pode escrever cookie.
 */
export async function criarSessao(usuarioId: string) {
  const token = gerarToken()
  const expiraEm = await criarSessaoNoBanco(usuarioId, token, await origemDaRequisicao())

  ;(await cookies()).set(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiraEm,
  })

  // Faxina oportunista: sessão vencida não serve para nada e a tabela cresce
  // sozinha. Feita no login porque é o único momento em que uma escrita a mais
  // não custa nada ao operador.
  await limparSessoesVencidas()
}

export async function encerrarSessao() {
  const jar = await cookies()
  const token = jar.get(NOME_COOKIE)?.value
  if (token) await encerrarSessaoDoToken(token)
  jar.delete(NOME_COOKIE)
}

export function ehPerfil(valor: unknown): valor is PerfilUsuario {
  return valor === 'ADMIN' || valor === 'FINANCEIRO' || valor === 'OPERACAO' || valor === 'MOTORISTA'
}
