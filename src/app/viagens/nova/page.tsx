import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button, CabecalhoPagina, Card, EstadoVazio } from '@/components/ui'
import { FormularioViagem } from '../formulario-viagem'

export const dynamic = 'force-dynamic'

export default async function NovaViagem() {
  const [veiculos, motoristas] = await Promise.all([
    prisma.veiculo.findMany({
      where: { status: 'ATIVO', tipo: { in: ['CAVALO', 'TRUCK'] } },
      select: {
        id: true,
        apelido: true,
        odometroAtual: true,
        motoristasPadrao: { select: { id: true }, take: 1 },
      },
      orderBy: { apelido: 'asc' },
    }),
    prisma.motorista.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  if (veiculos.length === 0 || motoristas.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Abrir viagem" />
        <Card>
          <EstadoVazio
            titulo="Faltam cadastros"
            descricao={
              veiculos.length === 0
                ? 'Cadastre pelo menos um caminhão ativo antes de abrir uma viagem.'
                : 'Cadastre pelo menos um motorista ativo antes de abrir uma viagem.'
            }
            acao={
              <Link href={veiculos.length === 0 ? '/cadastros/veiculos/novo' : '/cadastros/motoristas/novo'}>
                <Button>Ir para o cadastro</Button>
              </Link>
            }
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Abrir viagem"
        descricao="Escolha o caminhão e o resto já vem preenchido."
      />
      <FormularioViagem
        veiculos={veiculos.map((v) => ({
          id: v.id,
          apelido: v.apelido,
          odometroAtual: v.odometroAtual,
          motoristaPadraoId: v.motoristasPadrao[0]?.id ?? null,
        }))}
        motoristas={motoristas}
      />
    </>
  )
}
