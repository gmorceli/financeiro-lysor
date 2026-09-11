import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioVeiculo } from '../formulario'

export const dynamic = 'force-dynamic'

export default async function EditarVeiculo({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [veiculo, proprietarios] = await Promise.all([
    prisma.veiculo.findUnique({ where: { id } }),
    prisma.proprietario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  if (!veiculo) notFound()

  return (
    <>
      <CabecalhoPagina titulo={veiculo.apelido} descricao="Editar veículo" />
      <FormularioVeiculo veiculo={veiculo} proprietarios={proprietarios} />
    </>
  )
}
