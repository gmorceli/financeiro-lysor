import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { usuarioDaSessao } from '@/lib/sessao'
import { navegacaoDoPerfil, ROTULOS_PERFIL } from '@/lib/permissoes'
import { rota } from '@/lib/utils'
import { MenuDoUsuario } from './menu-usuario'

export const metadata: Metadata = {
  title: 'Lysor Transportes',
  description: 'Gestão de frota, fretes e resultado',
}

/**
 * O cabeçalho só existe para quem está logado, e o menu já vem filtrado pelo
 * perfil — a pessoa não vê uma aba que a levaria a um aviso de bloqueio. A
 * filtragem é conveniência de interface, não segurança: quem digitar a URL na
 * mão é barrado pelo layout da área.
 *
 * A tela de login mora na mesma árvore e não tem cabeçalho nenhum. Em vez de
 * mover as 60 telas para um grupo de rotas só por causa disso, o layout decide
 * pela presença de sessão.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioDaSessao()

  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        {usuario ? (
          <>
            <header className="border-b border-borda bg-superficie">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
                <Link
                  href="/"
                  className="-ml-2 flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold tracking-tight text-primaria sm:min-h-0"
                >
                  Lysor Transportes
                </Link>
                <MenuDoUsuario nome={usuario.nome} perfil={ROTULOS_PERFIL[usuario.perfil]} />
              </div>
              {!usuario.trocarSenha && (
                <nav className="mx-auto max-w-6xl overflow-x-auto px-4">
                  <ul className="flex min-w-max gap-1 pb-2">
                    {navegacaoDoPerfil(usuario.perfil).map((item) => (
                      <li key={item.href}>
                        <Link
                          href={rota(item.href)}
                          className="flex min-h-11 items-center rounded-lg px-3 py-1.5 text-sm text-texto-suave transition-colors hover:bg-fundo hover:text-texto sm:min-h-0"
                        >
                          {item.rotulo}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </header>
            <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  )
}
