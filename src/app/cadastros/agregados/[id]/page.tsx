import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioAgregado } from '../formulario'

export const dynamic = 'force-dynamic'

export default async function EditarAgregado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agregado = await prisma.proprietario.findUnique({ where: { id } })
  if (!agregado) notFound()

  return (
    <>
      <CabecalhoPagina titulo={agregado.nome} descricao="Editar agregado" />
      <FormularioAgregado agregado={agregado} />
    </>
  )
}
