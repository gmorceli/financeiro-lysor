import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioManutencao } from '../../formulario-manutencao'

export const dynamic = 'force-dynamic'

export default async function NovaManutencao() {
  const [veiculos, fornecedores] = await Promise.all([
    prisma.veiculo.findMany({
      where: { status: { in: ['ATIVO', 'MANUTENCAO'] } },
      select: { id: true, apelido: true, odometroAtual: true, tipo: true },
      orderBy: { apelido: 'asc' },
    }),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  return (
    <>
      <CabecalhoPagina titulo="Lançar manutenção" />
      <FormularioManutencao veiculos={veiculos} fornecedores={fornecedores} />
    </>
  )
}
