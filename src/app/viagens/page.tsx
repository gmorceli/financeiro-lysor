import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarData, formatarMoeda, formatarNumero, rota } from '@/lib/utils'
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

const ROTULO_STATUS = {
  PLANEJADA: 'Planejada',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_ACERTO: 'Aguardando acerto',
  FECHADA: 'Fechada',
} as const

const TOM_STATUS = {
  PLANEJADA: 'neutro',
  EM_ANDAMENTO: 'alerta',
  AGUARDANDO_ACERTO: 'alerta',
  FECHADA: 'positivo',
} as const

export default async function ListaViagens() {
  const viagens = await prisma.viagem.findMany({
    include: {
      veiculo: { select: { apelido: true } },
      motorista: { select: { nome: true } },
      fretes: { select: { valorFreteReal: true } },
    },
    orderBy: [{ dataSaida: 'desc' }, { numero: 'desc' }],
    take: 100,
  })

  const emAberto = viagens.filter((v) => v.status !== 'FECHADA').length

  return (
    <>
      <CabecalhoPagina
        titulo="Viagens"
        descricao={
          emAberto > 0
            ? `${emAberto} viagem${emAberto > 1 ? 'ns' : ''} em aberto.`
            : 'Nenhuma viagem em aberto.'
        }
        acao={
          <Link href="/viagens/nova">
            <Button>Abrir viagem</Button>
          </Link>
        }
      />

      <Card>
        {viagens.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma viagem registrada"
            descricao="Abra a viagem quando o caminhão sair. Depois é só lançar o frete e fechar na chegada."
            acao={
              <Link href="/viagens/nova">
                <Button>Abrir a primeira</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Nº</Th>
                <Th>Saída</Th>
                <Th>Caminhão</Th>
                <Th>Motorista</Th>
                <Th>Rota</Th>
                <Th className="text-right">Km</Th>
                <Th className="text-right">Frete</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {viagens.map((viagem) => {
                const receita = viagem.fretes.reduce(
                  (soma, f) => soma + Number(f.valorFreteReal),
                  0,
                )
                const km =
                  viagem.kmFinal != null ? viagem.kmFinal - viagem.kmInicial : null
                return (
                  <tr key={viagem.id} className="hover:bg-fundo">
                    <Td className="tabular-nums">
                      <Link
                        href={rota(`/viagens/${viagem.id}`)}
                        className="font-medium text-primaria hover:underline"
                      >
                        {viagem.numero}
                      </Link>
                    </Td>
                    <Td className="tabular-nums text-texto-suave">
                      {formatarData(viagem.dataSaida)}
                    </Td>
                    <Td className="text-texto">{viagem.veiculo.apelido}</Td>
                    <Td className="text-texto-suave">{viagem.motorista.nome}</Td>
                    <Td className="text-texto-suave">
                      {viagem.origem} → {viagem.destino}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {km == null ? '—' : formatarNumero(km)}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {viagem.fretes.length === 0 ? '—' : formatarMoeda(receita)}
                    </Td>
                    <Td>
                      <Badge tom={TOM_STATUS[viagem.status]}>
                        {ROTULO_STATUS[viagem.status]}
                      </Badge>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
