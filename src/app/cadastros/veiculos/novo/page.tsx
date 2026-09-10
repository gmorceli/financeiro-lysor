import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioVeiculo } from '../formulario'

export const dynamic = 'force-dynamic'

export default async function NovoVeiculo() {
  const proprietarios = await prisma.proprietario.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  return (
    <>
      <CabecalhoPagina titulo="Novo veículo" />
      <FormularioVeiculo proprietarios={proprietarios} />
    </>
  )
}
