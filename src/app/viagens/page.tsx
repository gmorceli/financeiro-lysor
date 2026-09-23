import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarData, formatarMoeda, formatarNumero, rota } from '@/lib/utils'
import { Badge, Button, CabecalhoPagina, Card, EstadoVazio, LINK_TABELA, Tabela, Td, Th } from '@/components/ui'
import { RestaurarViagem } from './[id]/restaurar'

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

/**
 * A lista mostra as viagens vivas. As excluídas ficam atrás de um filtro, e não
 * somem de vez: a exclusão é lógica justamente para que o clique na linha
 * errada tenha volta, e uma lista que esconde o que foi excluído sem oferecer
 * onde procurar não tem volta nenhuma.
 */
export default async function ListaViagens({
  searchParams,
}: {
  searchParams: Promise<{ excluidas?: string }>
}) {
  const { excluidas } = await searchParams
  const mostrandoExcluidas = excluidas === '1'

  const [viagens, quantasExcluidas] = await Promise.all([
    prisma.viagem.findMany({
      where: mostrandoExcluidas ? { excluidaEm: { not: null } } : { excluidaEm: null },
      include: {
        veiculo: { select: { apelido: true } },
        motorista: { select: { nome: true } },
        fretes: { select: { valorFreteReal: true } },
      },
      orderBy: [{ dataSaida: 'desc' }, { numero: 'desc' }],
      take: 100,
    }),
    prisma.viagem.count({ where: { excluidaEm: { not: null } } }),
  ])

  const emAberto = viagens.filter((v) => v.status !== 'FECHADA').length

  return (
    <>
      <CabecalhoPagina
        titulo={mostrandoExcluidas ? 'Viagens excluídas' : 'Viagens'}
        descricao={
          mostrandoExcluidas
            ? 'Excluídas por engano voltam com Restaurar.'
            : emAberto > 0
              ? `${emAberto} viagem${emAberto > 1 ? 'ns' : ''} em aberto.`
              : 'Nenhuma viagem em aberto.'
        }
        acao={
          <div className="flex flex-wrap items-center gap-2">
            {mostrandoExcluidas ? (
              <Link href="/viagens">
                <Button variante="secundario">Ver as viagens</Button>
              </Link>
            ) : (
              quantasExcluidas > 0 && (
                <Link href="/viagens?excluidas=1">
                  <Button variante="secundario">
                    Mostrar excluídas ({quantasExcluidas})
                  </Button>
                </Link>
              )
            )}
            <Link href="/viagens/nova">
              <Button>Abrir viagem</Button>
            </Link>
          </div>
        }
      />

      <Card>
        {viagens.length === 0 ? (
          mostrandoExcluidas ? (
            <EstadoVazio
              titulo="Nenhuma viagem excluída"
              descricao="Tudo o que foi lançado continua valendo."
              acao={
                <Link href="/viagens">
                  <Button>Ver as viagens</Button>
                </Link>
              }
            />
          ) : (
            <EstadoVazio
              titulo="Nenhuma viagem registrada"
              descricao="Abra a viagem quando o caminhão sair. Depois é só lançar o frete e fechar na chegada."
              acao={
                <Link href="/viagens/nova">
                  <Button>Abrir a primeira</Button>
                </Link>
              }
            />
          )
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
                <Th />
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
                        className={LINK_TABELA}
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
                      {mostrandoExcluidas && viagem.motivoExclusao && (
                        <span className="block text-xs">
                          {viagem.motivoExclusao}
                          {viagem.excluidaPor ? ` · ${viagem.excluidaPor}` : ''}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {km == null ? '—' : formatarNumero(km)}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {viagem.fretes.length === 0 ? '—' : formatarMoeda(receita)}
                    </Td>
                    <Td>
                      {mostrandoExcluidas ? (
                        <Badge tom="neutro">Excluída</Badge>
                      ) : (
                        <Badge tom={TOM_STATUS[viagem.status]}>
                          {ROTULO_STATUS[viagem.status]}
                        </Badge>
                      )}
                    </Td>
                    {/*
                      Lançar a viagem duas vezes, trocar a placa ou digitar um
                      zero a mais acontece toda semana. Até aqui o registro
                      errado ficava para sempre no resultado do mês.
                    */}
                    <Td className="text-right">
                      {mostrandoExcluidas ? (
                        <RestaurarViagem
                          viagemId={viagem.id}
                          numero={viagem.numero}
                          compacto
                        />
                      ) : (
                        <Link
                          href={rota(`/viagens/${viagem.id}/excluir`)}
                          className={LINK_TABELA}
                        >
                          Excluir
                        </Link>
                      )}
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
