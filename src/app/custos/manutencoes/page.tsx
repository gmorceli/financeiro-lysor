import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarData, formatarMoeda, formatarNumero } from '@/lib/utils'
import { Badge, Button, CabecalhoPagina, Card, EstadoVazio, Tabela, Td, Th } from '@/components/ui'

export const dynamic = 'force-dynamic'

const ROTULO_TIPO = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA: 'Corretiva',
  PNEU: 'Pneu',
  REVISAO: 'Revisão',
} as const

const TOM_TIPO = {
  PREVENTIVA: 'positivo',
  CORRETIVA: 'alerta',
  PNEU: 'neutro',
  REVISAO: 'neutro',
} as const

export default async function ListaManutencoes() {
  const manutencoes = await prisma.manutencao.findMany({
    include: {
      veiculo: { select: { apelido: true } },
      fornecedor: { select: { nome: true } },
    },
    orderBy: { data: 'desc' },
    take: 200,
  })

  return (
    <>
      <CabecalhoPagina
        titulo="Manutenções"
        descricao="Peças e mão de obra separadas, para saber onde o dinheiro está indo."
        acao={
          <Link href="/custos/manutencoes/novo">
            <Button>Lançar manutenção</Button>
          </Link>
        }
      />

      <Card>
        {manutencoes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma manutenção lançada"
            descricao="Lance com o km do painel — com o tempo dá para saber de quanto em quanto tempo cada peça costuma durar."
            acao={
              <Link href="/custos/manutencoes/novo">
                <Button>Lançar a primeira</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Veículo</Th>
                <Th>Tipo</Th>
                <Th>O que foi feito</Th>
                <Th className="text-right">Km</Th>
                <Th className="text-right">Peças</Th>
                <Th className="text-right">Serviço</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {manutencoes.map((m) => (
                <tr key={m.id} className="hover:bg-fundo">
                  <Td className="tabular-nums text-texto-suave">{formatarData(m.data)}</Td>
                  <Td className="text-texto">{m.veiculo.apelido}</Td>
                  <Td>
                    <Badge tom={TOM_TIPO[m.tipo]}>{ROTULO_TIPO[m.tipo]}</Badge>
                  </Td>
                  <Td className="max-w-xs truncate text-texto-suave" title={m.descricao}>
                    {m.descricao}
                  </Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {m.odometro == null ? '—' : formatarNumero(m.odometro)}
                  </Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {formatarMoeda(m.valorPecas)}
                  </Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {formatarMoeda(m.valorServico)}
                  </Td>
                  <Td className="text-right tabular-nums font-medium text-texto">
                    {formatarMoeda(Number(m.valorPecas) + Number(m.valorServico))}
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
