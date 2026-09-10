import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioCliente } from '../formulario'

export const dynamic = 'force-dynamic'

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cliente = await prisma.cliente.findUnique({ where: { id } })
  if (!cliente) notFound()

  return (
    <>
      <CabecalhoPagina
        titulo={cliente.nomeFantasia || cliente.razaoSocial}
        descricao="Editar cliente"
      />
      <FormularioCliente cliente={cliente} />
    </>
  )
}
