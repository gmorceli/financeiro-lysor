import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioDespesaViagem } from '../formulario'

export const dynamic = 'force-dynamic'

export default async function NovaDespesaViagem({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [viagem, categorias, fornecedores] = await Promise.all([
    prisma.viagem.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        excluidaEm: true,
        veiculo: { select: { apelido: true } },
      },
    }),
    // Só o que é custo direto da viagem; combustível tem tela própria porque
    // precisa de litros e odômetro.
    prisma.categoria.findMany({
      where: {
        tipo: 'DESPESA',
        nivelCusto: 'DIRETO_VIAGEM',
        nome: { not: 'Combustível' },
      },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  if (!viagem || viagem.excluidaEm) notFound()

  return (
    <>
      <CabecalhoPagina
        titulo="Lançar despesa"
        descricao={`Viagem ${viagem.numero} · ${viagem.veiculo.apelido}`}
      />
      <FormularioDespesaViagem
        viagemId={viagem.id}
        categorias={categorias}
        fornecedores={fornecedores}
      />
    </>
  )
}
