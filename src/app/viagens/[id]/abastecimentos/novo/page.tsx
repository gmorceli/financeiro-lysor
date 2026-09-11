import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina } from '@/components/ui'
import { FormularioAbastecimento } from '@/app/custos/formulario-abastecimento'

export const dynamic = 'force-dynamic'

/**
 * Abastecimento lançado de dentro da viagem: o caminhão já vem travado e o
 * custo nasce apropriado àquela viagem, que é o que faz o diesel entrar no
 * resultado do frete certo.
 */
export default async function NovoAbastecimentoDaViagem({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [viagem, fornecedores, motoristas] = await Promise.all([
    prisma.viagem.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        motoristaId: true,
        veiculo: {
          select: {
            id: true,
            apelido: true,
            odometroAtual: true,
            abastecimentos: {
              where: { tanqueCheio: true },
              orderBy: { odometro: 'desc' },
              take: 1,
              select: { odometro: true },
            },
          },
        },
      },
    }),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.motorista.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  if (!viagem) notFound()

  return (
    <>
      <CabecalhoPagina
        titulo="Lançar abastecimento"
        descricao={`Viagem ${viagem.numero} · ${viagem.veiculo.apelido}`}
      />
      <FormularioAbastecimento
        viagemId={viagem.id}
        veiculoFixoId={viagem.veiculo.id}
        motoristaSugeridoId={viagem.motoristaId}
        veiculos={[
          {
            id: viagem.veiculo.id,
            apelido: viagem.veiculo.apelido,
            odometroAtual: viagem.veiculo.odometroAtual,
            ultimoTanqueCheio: viagem.veiculo.abastecimentos[0] ?? null,
          },
        ]}
        motoristas={motoristas}
        fornecedores={fornecedores}
      />
    </>
  )
}
