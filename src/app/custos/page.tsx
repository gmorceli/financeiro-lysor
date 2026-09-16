import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { DESPESA_AVULSA } from '@/lib/custos'
import { formatarMoeda } from '@/lib/utils'
import { CabecalhoPagina, Card } from '@/components/ui'

export const dynamic = 'force-dynamic'

/** Primeiro dia do mês corrente, em UTC, para casar com colunas `date`. */
function inicioDoMes() {
  const agora = new Date()
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
}

export default async function Custos() {
  const desde = inicioDoMes()

  const [combustivel, manutencao, despesas] = await Promise.all([
    prisma.lancamento.aggregate({
      _sum: { valor: true },
      where: { tipo: 'DESPESA', dataCompetencia: { gte: desde }, categoria: { nome: 'Combustível' } },
    }),
    prisma.lancamento.aggregate({
      _sum: { valor: true },
      where: {
        tipo: 'DESPESA',
        dataCompetencia: { gte: desde },
        categoria: { nome: { in: ['Manutenção', 'Pneus'] } },
      },
    }),
    prisma.lancamento.aggregate({
      _sum: { valor: true },
      where: { dataCompetencia: { gte: desde }, ...DESPESA_AVULSA },
    }),
  ])

  const cartoes = [
    {
      href: '/custos/abastecimentos',
      rotulo: 'Abastecimentos',
      descricao: 'Litros, km do painel e consumo',
      total: combustivel._sum.valor,
    },
    {
      href: '/custos/manutencoes',
      rotulo: 'Manutenções',
      descricao: 'Peças, mão de obra e pneus',
      total: manutencao._sum.valor,
    },
    {
      href: '/custos/despesas',
      rotulo: 'Despesas',
      descricao: 'Pedágio, lavagem, seguro, licenciamento, contador',
      total: despesas._sum.valor,
    },
  ] as const

  return (
    <>
      <CabecalhoPagina
        titulo="Custos"
        descricao="Todo custo lançado aqui já entra como conta a pagar."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cartoes.map((cartao) => (
          <Link key={cartao.href} href={cartao.href} className="group">
            <Card className="h-full p-4 transition-colors group-hover:border-primaria/40">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-texto">{cartao.rotulo}</span>
                <span className="text-lg font-semibold tabular-nums text-primaria">
                  {formatarMoeda(cartao.total ?? 0)}
                </span>
              </div>
              <p className="mt-1 text-sm text-texto-suave">{cartao.descricao}</p>
              <p className="mt-2 text-xs text-texto-suave">No mês corrente</p>
            </Card>
          </Link>
        ))}
      </div>

      {/*
        Este aviso já existia como parágrafo solto e não funcionou: a cliente
        lançou pedágio como manutenção preventiva, porque manutenção era um
        cartão clicável e isto era um texto. Agora "Despesas" é um cartão
        também, e o texto só explica quando vale a pena usar a tela da viagem.
      */}
      <Card className="p-4">
        <p className="text-sm text-texto-suave">
          Pedágio, chapa e lavagem de uma viagem específica ficam melhores lançados{' '}
          <strong className="text-texto">de dentro da própria viagem</strong> — assim
          entram no lucro daquele frete. Pela tela de Despesas também dá, escolhendo a
          viagem na lista.
        </p>
        <p className="mt-2 text-sm text-texto-suave">
          Na dúvida sobre onde lançar,{' '}
          <Link
            href="/ajuda"
            className="-my-3 inline-flex min-h-11 items-center font-medium text-primaria hover:underline sm:my-0 sm:min-h-0"
          >
            veja a ajuda
          </Link>
          .
        </p>
      </Card>
    </>
  )
}
