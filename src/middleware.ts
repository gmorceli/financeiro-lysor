import { NextResponse, type NextRequest } from 'next/server'
import { NOME_COOKIE } from '@/lib/cookie-sessao'

/**
 * Primeira barreira, deliberadamente burra: o middleware só pergunta se existe
 * cookie de sessão. Ele não valida nada.
 *
 * Validar exigiria consultar o banco, e o middleware roda no runtime de borda,
 * onde o Prisma não roda. A checagem de verdade acontece no layout de cada área
 * e em toda action, com `exigirUsuario` e `exigirAcesso` — cookie forjado passa
 * por aqui e morre lá. O papel disto é só evitar que a pessoa deslogada veja a
 * tela piscar antes de ser mandada pro login.
 */
const PUBLICOS = ['/entrar']

export function middleware(requisicao: NextRequest) {
  const { pathname, search } = requisicao.nextUrl

  if (PUBLICOS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return NextResponse.next()
  }

  if (requisicao.cookies.has(NOME_COOKIE)) return NextResponse.next()

  const login = new URL('/entrar', requisicao.url)
  // Volta pra onde a pessoa queria ir depois de entrar. Só caminho relativo é
  // aceito na leitura do parâmetro, para o link não servir de trampolim.
  if (pathname !== '/') login.searchParams.set('destino', `${pathname}${search}`)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
