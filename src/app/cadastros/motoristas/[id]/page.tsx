import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioMotorista } from '../formulario'

export const dynamic = 'force-dynamic'

export default async function EditarMotorista({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [motorista, veiculos] = await Promise.all([
    prisma.motorista.findUnique({ where: { id } }),
    prisma.veiculo.findMany({
      where: { status: 'ATIVO', tipo: { in: ['CAVALO', 'TRUCK'] } },
      select: { id: true, apelido: true },
      orderBy: { apelido: 'asc' },
    }),
  ])

  if (!motorista) notFound()

  return (
    <>
      <CabecalhoPagina titulo={motorista.nome} descricao="Editar motorista" />
      <FormularioMotorista motorista={motorista} veiculos={veiculos} />
    </>
  )
}
