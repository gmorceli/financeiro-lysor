import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarNumero, formatarPlaca } from '@/lib/utils'
import {
  Badge,
  Button,
  CabecalhoPagina,
  Card,
  EstadoVazio,
  Tabela,
  Td,
  Th,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

const ROTULO_TIPO = { CAVALO: 'Cavalo', TRUCK: 'Truck', CARRETA: 'Carreta' } as const
const ROTULO_STATUS = {
  ATIVO: 'Ativo',
  MANUTENCAO: 'Em manutenção',
  INATIVO: 'Inativo',
  VENDIDO: 'Vendido',
} as const
const TOM_STATUS = {
  ATIVO: 'positivo',
  MANUTENCAO: 'alerta',
  INATIVO: 'neutro',
  VENDIDO: 'neutro',
} as const

export default async function ListaVeiculos() {
  const veiculos = await prisma.veiculo.findMany({
    include: { proprietario: { select: { nome: true } } },
    orderBy: [{ tipo: 'asc' }, { apelido: 'asc' }],
  })

  return (
    <>
      <CabecalhoPagina
        titulo="Veículos"
        descricao="Cavalos, trucks e carretas. Cada um tem custo próprio."
        acao={
          <Link href="/cadastros/veiculos/novo">
            <Button>Novo veículo</Button>
          </Link>
        }
      />

      <Card>
        {veiculos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum veículo cadastrado"
            descricao="Comece pelos cavalos e trucks, depois as carretas. O apelido é o que você usa no dia a dia."
            acao={
              <Link href="/cadastros/veiculos/novo">
                <Button>Cadastrar o primeiro</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Apelido</Th>
                <Th>Tipo</Th>
                <Th>Placa</Th>
                <Th className="text-right">Km atual</Th>
                <Th>De quem é</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {veiculos.map((veiculo) => (
                <tr key={veiculo.id} className="hover:bg-fundo">
                  <Td>
                    <Link
                      href={`/cadastros/veiculos/${veiculo.id}`}
                      className="font-medium text-primaria hover:underline"
                    >
                      {veiculo.apelido}
                    </Link>
                  </Td>
                  <Td className="text-texto-suave">{ROTULO_TIPO[veiculo.tipo]}</Td>
                  <Td className="tabular-nums text-texto-suave">
                    {formatarPlaca(veiculo.placa)}
                  </Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {veiculo.tipo === 'CARRETA' ? '—' : formatarNumero(veiculo.odometroAtual)}
                  </Td>
                  <Td className="text-texto-suave">
                    {veiculo.tipoPosse === 'PROPRIO'
                      ? 'Lysor'
                      : (veiculo.proprietario?.nome ?? 'Agregado')}
                  </Td>
                  <Td>
                    <Badge tom={TOM_STATUS[veiculo.status]}>
                      {ROTULO_STATUS[veiculo.status]}
                    </Badge>
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
