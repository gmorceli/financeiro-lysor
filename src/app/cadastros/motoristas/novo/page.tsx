import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioMotorista } from '../formulario'

export const dynamic = 'force-dynamic'

export default async function NovoMotorista() {
  const veiculos = await prisma.veiculo.findMany({
    where: { status: 'ATIVO', tipo: { in: ['CAVALO', 'TRUCK'] } },
    select: { id: true, apelido: true },
    orderBy: { apelido: 'asc' },
  })

  return (
    <>
      <CabecalhoPagina titulo="Novo motorista" />
      <FormularioMotorista veiculos={veiculos} />
    </>
  )
}
