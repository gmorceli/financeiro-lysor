import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { DESPESA_AVULSA } from '@/lib/custos'
import { CAMADA_DO_CUSTO } from '@/lib/categorias'
import { formatarData, formatarMoeda, rota } from '@/lib/utils'
import {
  Badge,
  Button,
  CabecalhoPagina,
  Card,
  EstadoVazio,
  LINK_TABELA,
  Tabela,
  Td,
  Th,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

const TOM_CAMADA = {
  DIRETO_VIAGEM: 'alerta',
  VEICULO: 'neutro',
  OVERHEAD: 'positivo',
  LIQUIDACAO: 'neutro',
} as const

export default async function ListaDespesas() {
  const despesas = await prisma.lancamento.findMany({
    where: DESPESA_AVULSA,
    include: {
      categoria: { select: { nome: true, nivelCusto: true } },
      veiculo: { select: { apelido: true } },
      viagem: { select: { numero: true } },
    },
    orderBy: { dataCompetencia: 'desc' },
    take: 200,
  })

  return (
    <>
      <CabecalhoPagina
        titulo="Despesas"
        descricao="Pedágio, chapa, lavagem, seguro, licenciamento, contador."
        acao={
          <Link href="/custos/despesas/nova">
            <Button>Lançar despesa</Button>
          </Link>
        }
      />

      <Card>
        {despesas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma despesa lançada"
            descricao="Tudo que não é abastecimento nem manutenção entra aqui — e o tipo escolhido decide de qual lucro o custo sai."
            acao={
              <Link href="/custos/despesas/nova">
                <Button>Lançar a primeira</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Descrição</Th>
                <Th>Tipo</Th>
                <Th>Sai de</Th>
                <Th>Onde</Th>
                <Th className="text-right">Valor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {despesas.map((d) => (
                <tr key={d.id} className="hover:bg-fundo">
                  <Td className="tabular-nums text-texto-suave">
                    {formatarData(d.dataCompetencia)}
                  </Td>
                  <Td className="max-w-xs truncate text-texto" title={d.descricao}>
                    {d.descricao}
                  </Td>
                  <Td className="text-texto-suave">{d.categoria.nome}</Td>
                  {/*
                    A coluna que o print da cliente pedia: com pedágio lançado
                    como manutenção, nada na tela dizia que o custo tinha ido
                    para a camada errada da cascata.
                  */}
                  <Td>
                    <Badge tom={TOM_CAMADA[d.categoria.nivelCusto]}>
                      {CAMADA_DO_CUSTO[d.categoria.nivelCusto].titulo}
                    </Badge>
                  </Td>
                  <Td className="text-texto-suave">
                    {d.viagem ? `Viagem ${d.viagem.numero}` : (d.veiculo?.apelido ?? '—')}
                  </Td>
                  <Td className="text-right tabular-nums font-medium text-texto">
                    {formatarMoeda(d.valor)}
                  </Td>
                  <Td className="text-right">
                    <Link href={rota(`/custos/despesas/${d.id}`)} className={LINK_TABELA}>
                      Corrigir
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
