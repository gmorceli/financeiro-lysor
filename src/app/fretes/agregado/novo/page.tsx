import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { RegraCobrancaAgregado } from '@/lib/calculos'
import { Button, CabecalhoPagina, Card, EstadoVazio } from '@/components/ui'
import { FormularioFreteAgregado } from '../../formulario-frete-agregado'

export const dynamic = 'force-dynamic'

export default async function NovoFreteAgregado() {
  const [agregados, clientes] = await Promise.all([
    prisma.proprietario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, regraCobranca: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
      orderBy: { razaoSocial: 'asc' },
    }),
  ])

  if (agregados.length === 0 || clientes.length === 0) {
    const faltaAgregado = agregados.length === 0
    return (
      <>
        <CabecalhoPagina titulo="Frete de agregado" />
        <Card>
          <EstadoVazio
            titulo={faltaAgregado ? 'Nenhum agregado cadastrado' : 'Nenhum cliente cadastrado'}
            descricao={
              faltaAgregado
                ? 'Cadastre o agregado com o percentual e o seguro antes de lançar o frete dele.'
                : 'Cadastre o cliente do frete antes de lançar o CT-e.'
            }
            acao={
              <Link href={faltaAgregado ? '/cadastros/agregados/novo' : '/cadastros/clientes/novo'}>
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
        titulo="Frete de agregado"
        descricao="O caminhão é do agregado. A Lysor recebe a comissão e o seguro."
      />
      <FormularioFreteAgregado
        agregados={agregados.map((a) => ({
          id: a.id,
          nome: a.nome,
          regraCobranca: (a.regraCobranca ?? {}) as RegraCobrancaAgregado,
        }))}
        clientes={clientes.map((c) => ({
          id: c.id,
          nome: c.nomeFantasia || c.razaoSocial,
        }))}
      />
    </>
  )
}
