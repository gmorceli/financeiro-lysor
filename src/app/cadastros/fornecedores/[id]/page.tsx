import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioFornecedor } from '../formulario'

export const dynamic = 'force-dynamic'

export default async function EditarFornecedor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fornecedor = await prisma.fornecedor.findUnique({ where: { id } })
  if (!fornecedor) notFound()

  return (
    <>
      <CabecalhoPagina titulo={fornecedor.nome} descricao="Editar fornecedor" />
      <FormularioFornecedor fornecedor={fornecedor} />
    </>
  )
}
