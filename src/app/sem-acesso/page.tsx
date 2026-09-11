import Link from 'next/link'
import { Card } from '@/components/ui'
import { exigirUsuario } from '@/lib/sessao'
import { AREAS, navegacaoDoPerfil, ROTULOS_PERFIL, type Area } from '@/lib/permissoes'
import { rota } from '@/lib/utils'

const NOMES_DE_AREA: Record<Area, string> = {
  operacao: 'a operação',
  cadastros: 'os cadastros',
  financeiro: 'o financeiro',
  resultado: 'o relatório de resultado',
  usuarios: 'o cadastro de usuários',
}

function ehArea(valor: unknown): valor is Area {
  return typeof valor === 'string' && valor in AREAS
}

export default async function PaginaSemAcesso({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>
}) {
  const usuario = await exigirUsuario()
  const { area } = await searchParams
  const primeira = navegacaoDoPerfil(usuario.perfil)[0]

  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-semibold text-texto">Essa parte não é do seu perfil</h1>
      <p className="mt-3 text-sm text-texto-suave">
        {ehArea(area)
          ? `Seu acesso é de ${ROTULOS_PERFIL[usuario.perfil]}, que não alcança ${NOMES_DE_AREA[area]}.`
          : `Seu acesso é de ${ROTULOS_PERFIL[usuario.perfil]}, que não alcança essa tela.`}{' '}
        Se você precisa dela para trabalhar, peça ao administrador para mudar seu perfil.
      </p>
      {primeira && (
        <Link
          href={rota(primeira.href)}
          className="mt-6 inline-flex items-center justify-center rounded-lg border border-borda bg-superficie px-4 py-2 text-sm font-medium text-texto transition-colors hover:bg-fundo"
        >
          Ir para {primeira.rotulo}
        </Link>
      )}
    </Card>
  )
}
