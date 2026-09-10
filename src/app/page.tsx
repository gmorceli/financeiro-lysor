import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CabecalhoPagina } from '@/components/ui'

export const dynamic = 'force-dynamic'

const CADASTROS = [
  {
    href: '/cadastros/veiculos',
    rotulo: 'Veículos',
    descricao: 'Cavalos, trucks e carretas',
    contar: () => prisma.veiculo.count(),
  },
  {
    href: '/cadastros/motoristas',
    rotulo: 'Motoristas',
    descricao: 'Vínculo e forma de pagamento',
    contar: () => prisma.motorista.count(),
  },
  {
    href: '/cadastros/clientes',
    rotulo: 'Clientes',
    descricao: 'Embarcadores e prazo de pagamento',
    contar: () => prisma.cliente.count(),
  },
  {
    href: '/cadastros/agregados',
    rotulo: 'Agregados',
    descricao: 'Percentual e seguro cobrados',
    contar: () => prisma.proprietario.count(),
  },
  {
    href: '/cadastros/fornecedores',
    rotulo: 'Fornecedores',
    descricao: 'Postos, oficinas e borracharias',
    contar: () => prisma.fornecedor.count(),
  },
] as const

export default async function Inicio() {
  const totais = await Promise.all(CADASTROS.map((c) => c.contar()))

  return (
    <>
      <CabecalhoPagina
        titulo="Cadastros"
        descricao="Primeiro passo: deixar a frota, a equipe e os parceiros cadastrados. Depois vêm as viagens."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CADASTROS.map((cadastro, indice) => (
          <Link key={cadastro.href} href={cadastro.href} className="group">
            <Card className="h-full p-4 transition-colors group-hover:border-primaria/40">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-texto">{cadastro.rotulo}</span>
                <span className="text-2xl font-semibold tabular-nums text-primaria">
                  {totais[indice]}
                </span>
              </div>
              <p className="mt-1 text-sm text-texto-suave">{cadastro.descricao}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
