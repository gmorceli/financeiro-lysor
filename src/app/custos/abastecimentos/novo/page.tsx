import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button, CabecalhoPagina, Card, EstadoVazio } from '@/components/ui'
import { FormularioAbastecimento } from '../../formulario-abastecimento'

export const dynamic = 'force-dynamic'

export default async function NovoAbastecimento() {
  const [veiculos, motoristas, fornecedores] = await Promise.all([
    prisma.veiculo.findMany({
      where: { status: { in: ['ATIVO', 'MANUTENCAO'] }, tipo: { in: ['CAVALO', 'TRUCK'] } },
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
      orderBy: { apelido: 'asc' },
    }),
    prisma.motorista.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  if (veiculos.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Lançar abastecimento" />
        <Card>
          <EstadoVazio
            titulo="Nenhum caminhão cadastrado"
            descricao="Cadastre o caminhão antes de lançar abastecimento."
            acao={
              <Link href="/cadastros/veiculos/novo">
                <Button>Cadastrar caminhão</Button>
              </Link>
            }
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <CabecalhoPagina titulo="Lançar abastecimento" />
      <FormularioAbastecimento
        veiculos={veiculos.map((v) => ({
          id: v.id,
          apelido: v.apelido,
          odometroAtual: v.odometroAtual,
          ultimoTanqueCheio: v.abastecimentos[0] ?? null,
        }))}
        motoristas={motoristas}
        fornecedores={fornecedores}
      />
    </>
  )
}
