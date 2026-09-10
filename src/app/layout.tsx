import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lysor Transportes',
  description: 'Gestão de frota, fretes e resultado',
}

const NAVEGACAO = [
  { href: '/', rotulo: 'Início' },
  { href: '/cadastros/veiculos', rotulo: 'Veículos' },
  { href: '/cadastros/motoristas', rotulo: 'Motoristas' },
  { href: '/cadastros/clientes', rotulo: 'Clientes' },
  { href: '/cadastros/agregados', rotulo: 'Agregados' },
  { href: '/cadastros/fornecedores', rotulo: 'Fornecedores' },
] as const

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <header className="border-b border-borda bg-superficie">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <Link href="/" className="text-sm font-semibold tracking-tight text-primaria">
              Lysor Transportes
            </Link>
          </div>
          <nav className="mx-auto max-w-6xl overflow-x-auto px-4">
            <ul className="flex min-w-max gap-1 pb-2">
              {NAVEGACAO.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-1.5 text-sm text-texto-suave transition-colors hover:bg-fundo hover:text-texto"
                  >
                    {item.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
