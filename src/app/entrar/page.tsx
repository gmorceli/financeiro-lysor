import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui'
import { usuarioDaSessao } from '@/lib/sessao'
import { FormularioLogin } from './formulario'

export const metadata: Metadata = { title: 'Entrar · Lysor Transportes' }

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  if (await usuarioDaSessao()) redirect('/')
  const { destino } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-lg font-semibold tracking-tight text-primaria">Lysor Transportes</p>
          <p className="mt-1 text-sm text-texto-suave">Gestão de frota, fretes e resultado</p>
        </div>
        <Card className="p-6">
          <FormularioLogin destino={destino} />
        </Card>
        <p className="mt-6 text-center text-xs text-texto-suave">
          Esqueceu a senha? Um administrador redefine para você.
        </p>
      </div>
    </div>
  )
}
