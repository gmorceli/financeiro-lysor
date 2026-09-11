import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Button, CabecalhoPagina, Card, EstadoVazio } from '@/components/ui'
import { FormularioFreteProprio } from '@/app/fretes/formulario-frete-proprio'

export const dynamic = 'force-dynamic'

export default async function NovoFreteDaViagem({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [viagem, clientes] = await Promise.all([
    prisma.viagem.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        origem: true,
        destino: true,
        veiculo: { select: { apelido: true } },
      },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
      orderBy: { razaoSocial: 'asc' },
    }),
  ])

  if (!viagem) notFound()

  if (clientes.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Lançar frete" />
        <Card>
          <EstadoVazio
            titulo="Nenhum cliente cadastrado"
            descricao="Cadastre o cliente do frete antes de lançar o CT-e."
            acao={
              <Link href="/cadastros/clientes/novo">
                <Button>Cadastrar cliente</Button>
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
        titulo="Lançar frete"
        descricao={`Viagem ${viagem.numero} · ${viagem.veiculo.apelido}`}
      />
      <FormularioFreteProprio
        viagemId={viagem.id}
        origemPadrao={viagem.origem}
        destinoPadrao={viagem.destino}
        clientes={clientes.map((c) => ({
          id: c.id,
          nome: c.nomeFantasia || c.razaoSocial,
        }))}
      />
    </>
  )
}
