import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { calcularComissaoMotorista } from '@/lib/calculos'
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
import { FecharViagem } from '../fechar-viagem'

export const dynamic = 'force-dynamic'

const ROTULO_STATUS = {
  PLANEJADA: 'Planejada',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_ACERTO: 'Aguardando acerto',
  FECHADA: 'Fechada',
} as const

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-texto-suave">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-texto">{valor}</dd>
    </div>
  )
}

export default async function DetalheViagem({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viagem = await prisma.viagem.findUnique({
    where: { id },
    include: {
      veiculo: { select: { apelido: true } },
      motorista: {
        select: { nome: true, percentualComissao: true, baseComissao: true },
      },
      fretes: {
        include: { cliente: { select: { razaoSocial: true, nomeFantasia: true } } },
        orderBy: { dataEmissao: 'asc' },
      },
    },
  })

  if (!viagem) notFound()

  const receita = viagem.fretes.reduce((soma, f) => soma + Number(f.valorFreteReal), 0)
  const receitaCte = viagem.fretes.reduce((soma, f) => soma + Number(f.valorCte), 0)
  const comissao = viagem.fretes.reduce(
    (soma, f) =>
      soma +
      calcularComissaoMotorista(
        Number(f.valorFreteReal),
        Number(f.valorCte),
        Number(viagem.motorista.percentualComissao),
        viagem.motorista.baseComissao,
      ),
    0,
  )
  const kmRodado = viagem.kmFinal != null ? viagem.kmFinal - viagem.kmInicial : null
  const aberta = viagem.status === 'EM_ANDAMENTO' || viagem.status === 'PLANEJADA'

  return (
    <>
      <CabecalhoPagina
        titulo={`Viagem ${viagem.numero}`}
        descricao={`${viagem.veiculo.apelido} · ${viagem.origem} → ${viagem.destino}`}
        acao={<Badge tom={aberta ? 'alerta' : 'positivo'}>{ROTULO_STATUS[viagem.status]}</Badge>}
      />

      <Card className="mb-4 p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Dado rotulo="Motorista" valor={viagem.motorista.nome} />
          <Dado rotulo="Saída" valor={formatarData(viagem.dataSaida)} />
          <Dado rotulo="Chegada" valor={formatarData(viagem.dataChegada)} />
          <Dado
            rotulo="Km rodado"
            valor={kmRodado == null ? '—' : `${formatarNumero(kmRodado)} km`}
          />
          {viagem.kmVazio != null && (
            <Dado
              rotulo="Km vazio"
              valor={
                <>
                  {formatarNumero(viagem.kmVazio)} km
                  {kmRodado ? (
                    <span className="text-texto-suave">
                      {' '}
                      ({Math.round((viagem.kmVazio / kmRodado) * 100)}%)
                    </span>
                  ) : null}
                </>
              }
            />
          )}
          {viagem.kmImprodutivo != null && (
            <Dado
              rotulo="Km a mais"
              valor={
                <span className="text-alerta">
                  {formatarNumero(viagem.kmImprodutivo)} km
                </span>
              }
            />
          )}
        </dl>
        {viagem.motivoKmImprodutivo && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-alerta">
            Km rodado a mais: {viagem.motivoKmImprodutivo}
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">Fretes desta viagem</h2>
          {aberta && (
            <Link href={rota(`/viagens/${viagem.id}/fretes/novo`)}>
              <Button variante="secundario">Lançar frete</Button>
            </Link>
          )}
        </div>

        {viagem.fretes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum frete lançado"
            descricao="Lance o CT-e desta viagem. É de onde sai a receita e a comissão do motorista."
            acao={
              aberta ? (
                <Link href={rota(`/viagens/${viagem.id}/fretes/novo`)}>
                  <Button>Lançar frete</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>CT-e</Th>
                <Th>Cliente</Th>
                <Th>Rota</Th>
                <Th className="text-right">Valor do CT-e</Th>
                <Th className="text-right">Valor real</Th>
              </tr>
            </thead>
            <tbody>
              {viagem.fretes.map((frete) => {
                const divergente = Number(frete.valorFreteReal) !== Number(frete.valorCte)
                return (
                  <tr key={frete.id} className="hover:bg-fundo">
                    <Td className="tabular-nums text-texto-suave">
                      {frete.numeroCte ?? '—'}
                    </Td>
                    <Td className="text-texto">
                      {frete.cliente.nomeFantasia || frete.cliente.razaoSocial}
                    </Td>
                    <Td className="text-texto-suave">
                      {frete.origem} → {frete.destino}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {formatarMoeda(frete.valorCte)}
                    </Td>
                    <Td className="text-right tabular-nums font-medium text-texto">
                      {formatarMoeda(frete.valorFreteReal)}
                      {divergente && (
                        <span className="ml-1 text-xs font-normal text-alerta">
                          ≠ CT-e
                        </span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        )}

        {viagem.fretes.length > 0 && (
          <div className="grid gap-3 border-t border-borda px-4 py-3 sm:grid-cols-3">
            <Dado rotulo="Receita (real)" valor={formatarMoeda(receita)} />
            <Dado rotulo="Somatório dos CT-e" valor={formatarMoeda(receitaCte)} />
            <Dado
              rotulo={`Comissão do motorista (${Number(viagem.motorista.percentualComissao)}%)`}
              valor={formatarMoeda(comissao)}
            />
          </div>
        )}
      </Card>

      {aberta ? (
        <Card className="p-4">
          <h2 className="mb-4 text-sm font-semibold text-texto">Fechar viagem</h2>
          <FecharViagem viagemId={viagem.id} kmInicial={viagem.kmInicial} />
        </Card>
      ) : (
        <Link href="/viagens">
          <Button variante="secundario">Voltar para viagens</Button>
        </Link>
      )}
    </>
  )
}
