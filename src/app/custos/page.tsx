import Link from 'next/link'
import { prisma } from '@/lib/prisma'
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

  const [combustivel, manutencao, outros] = await Promise.all([
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
      where: {
        tipo: 'DESPESA',
        dataCompetencia: { gte: desde },
        categoria: { nome: { notIn: ['Combustível', 'Manutenção', 'Pneus'] } },
      },
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
  ] as const

  return (
    <>
      <CabecalhoPagina
        titulo="Custos"
        descricao="Todo custo lançado aqui já entra como conta a pagar."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
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

      <Card className="p-4">
        <p className="text-sm text-texto-suave">
          Despesas de viagem — pedágio, chapa, lavagem — são lançadas dentro da própria
          viagem, para entrarem no custo daquele frete. Outros custos do mês somam{' '}
          <strong className="text-texto">{formatarMoeda(outros._sum.valor ?? 0)}</strong>.
        </p>
      </Card>
    </>
  )
}
