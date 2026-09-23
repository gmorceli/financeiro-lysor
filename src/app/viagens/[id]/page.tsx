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
  LINK_TABELA,
  Tabela,
  Td,
  Th,
} from '@/components/ui'
import { FecharViagem } from '../fechar-viagem'
import { ExcluirCusto, ReabrirViagem } from './acoes'
import { RestaurarViagem } from './restaurar'

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
      lancamentos: {
        where: { tipo: 'DESPESA', status: { not: 'CANCELADO' } },
        include: {
          categoria: { select: { nome: true } },
          // Para saber qual ação oferecer: o título de um abastecimento se
          // corrige na tela do abastecimento, não se apaga por aqui.
          abastecimento: { select: { id: true } },
        },
        orderBy: { dataCompetencia: 'asc' },
      },
    },
  })

  if (!viagem) notFound()

  // CT-e cancelado não é receita nem base de comissão — a mesma regra do DRE.
  const valendo = viagem.fretes.filter((f) => f.status !== 'CANCELADO')
  const receita = valendo.reduce((soma, f) => soma + Number(f.valorFreteReal), 0)
  const receitaCte = valendo.reduce((soma, f) => soma + Number(f.valorCte), 0)
  const comissao = valendo.reduce(
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
  const excluida = viagem.excluidaEm != null
  const aberta =
    !excluida && (viagem.status === 'EM_ANDAMENTO' || viagem.status === 'PLANEJADA')

  // Custos diretos: o que foi apropriado a esta viagem. A comissão do motorista
  // ainda não é um título — ela nasce no acerto — mas já entra na conta para o
  // operador não ver uma margem inflada.
  const custosLancados = viagem.lancamentos.reduce((soma, l) => soma + Number(l.valor), 0)
  const custoDireto = custosLancados + comissao
  const margem = receita - custoDireto

  return (
    <>
      <CabecalhoPagina
        titulo={`Viagem ${viagem.numero}`}
        descricao={`${viagem.veiculo.apelido} · ${viagem.origem} → ${viagem.destino}`}
        acao={
          excluida ? (
            <Badge tom="neutro">Excluída</Badge>
          ) : (
            <Badge tom={aberta ? 'alerta' : 'positivo'}>{ROTULO_STATUS[viagem.status]}</Badge>
          )
        }
      />

      {excluida && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-texto">
            <strong className="font-medium text-alerta">Esta viagem foi excluída</strong>{' '}
            em {formatarData(viagem.excluidaEm)}
            {viagem.excluidaPor ? ` por ${viagem.excluidaPor}` : ''}
            {viagem.motivoExclusao ? `: ${viagem.motivoExclusao}` : '.'}
          </p>
          <p className="mt-1 text-sm text-texto-suave">
            Ela está fora das listas, dos relatórios de lucro, do contas a receber e do
            cálculo de comissão. Os números abaixo são o que ela era.
          </p>
          <RestaurarViagem viagemId={viagem.id} numero={viagem.numero} />
        </Card>
      )}

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
                <Th />
              </tr>
            </thead>
            <tbody>
              {viagem.fretes.map((frete) => {
                const divergente = Number(frete.valorFreteReal) !== Number(frete.valorCte)
                const cancelado = frete.status === 'CANCELADO'
                return (
                  <tr
                    key={frete.id}
                    className={cancelado ? 'opacity-50 hover:bg-fundo' : 'hover:bg-fundo'}
                  >
                    <Td className="tabular-nums text-texto-suave">
                      {frete.numeroCte ?? '—'}
                      {cancelado && (
                        <span className="ml-2 text-xs font-medium text-erro">cancelado</span>
                      )}
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
                      {divergente && !cancelado && (
                        <span className="ml-1 text-xs font-normal text-alerta">
                          ≠ CT-e
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Link href={rota(`/fretes/${frete.id}`)} className={LINK_TABELA}>
                        {cancelado ? 'Ver' : 'Corrigir'}
                      </Link>
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

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">Custos desta viagem</h2>
          {aberta && (
            <Link href={rota(`/viagens/${viagem.id}/despesas/novo`)}>
              <Button variante="secundario">Lançar despesa</Button>
            </Link>
          )}
        </div>

        {viagem.lancamentos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum custo lançado"
            descricao="Pedágio, chapa e despesa de estrada entram aqui e viram conta a pagar automaticamente. Diesel não: o abastecimento é do caminhão, e vai em Custos."
            acao={
              aberta ? (
                <Link href={rota(`/viagens/${viagem.id}/despesas/novo`)}>
                  <Button>Lançar despesa</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th>Descrição</Th>
                <Th className="text-right">Valor</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {viagem.lancamentos.map((lancamento) => (
                <tr key={lancamento.id} className="hover:bg-fundo">
                  <Td className="tabular-nums text-texto-suave">
                    {formatarData(lancamento.dataCompetencia)}
                  </Td>
                  <Td className="text-texto-suave">{lancamento.categoria.nome}</Td>
                  <Td className="text-texto">{lancamento.descricao}</Td>
                  <Td className="text-right tabular-nums font-medium text-texto">
                    {formatarMoeda(lancamento.valor)}
                  </Td>
                  {/*
                    Lançar R$ 3.000 onde era R$ 300 é o erro mais fácil de
                    cometer aqui. Sem esta coluna, o jeito de corrigir era abrir
                    o banco. Cada tipo volta pela porta de onde entrou: o
                    abastecimento pela tela dele, a despesa pela dela.
                  */}
                  <Td className="text-right">
                    {lancamento.abastecimento ? (
                      <Link
                        href={rota(`/custos/abastecimentos/${lancamento.abastecimento.id}`)}
                        className={LINK_TABELA}
                      >
                        Corrigir
                      </Link>
                    ) : (
                      <span className="flex items-center justify-end gap-3">
                        <Link
                          href={rota(`/custos/despesas/${lancamento.id}`)}
                          className={LINK_TABELA}
                        >
                          Corrigir
                        </Link>
                        {Number(lancamento.valorPago) === 0 && (
                          <ExcluirCusto
                            lancamentoId={lancamento.id}
                            descricao={lancamento.descricao}
                          />
                        )}
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Card>

      {viagem.fretes.length > 0 && (
        <Card className="mb-4 p-4">
          <h2 className="mb-3 text-sm font-semibold text-texto">Resultado da viagem</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-texto-suave">Receita</dt>
              <dd className="tabular-nums text-texto">{formatarMoeda(receita)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-texto-suave">Custos lançados</dt>
              <dd className="tabular-nums text-texto">− {formatarMoeda(custosLancados)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-texto-suave">Comissão do motorista</dt>
              <dd className="tabular-nums text-texto">− {formatarMoeda(comissao)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-borda pt-1.5 font-medium">
              <dt className="text-texto">Margem de contribuição</dt>
              <dd
                className={
                  margem >= 0 ? 'tabular-nums text-primaria' : 'tabular-nums text-erro'
                }
              >
                {formatarMoeda(margem)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-texto-suave">
            Ainda sem o custo do caminhão (manutenção, seguro, parcela) nem o custo fixo da
            empresa — esses entram no relatório de resultado do mês.
            {kmRodado ? ` Custo de ${formatarMoeda(custoDireto / kmRodado)} por km rodado.` : ''}
          </p>
        </Card>
      )}

      {excluida ? (
        <Card className="p-4">
          <Link href="/viagens">
            <Button variante="secundario">Voltar para viagens</Button>
          </Link>
        </Card>
      ) : (
        <>
          {aberta ? (
            <Card className="mb-4 p-4">
              <h2 className="mb-4 text-sm font-semibold text-texto">Fechar viagem</h2>
              <FecharViagem viagemId={viagem.id} kmInicial={viagem.kmInicial} />
            </Card>
          ) : (
            <Card className="mb-4 p-4">
              <h2 className="text-sm font-semibold text-texto">Chegou custo depois?</h2>
              <p className="mt-1 text-sm text-texto-suave">
                Viagem fechada não aceita lançamento. Reabrir devolve o botão de despesa,
                e depois é só fechar de novo com o mesmo km.
              </p>
              <ReabrirViagem viagemId={viagem.id} numero={viagem.numero} />
            </Card>
          )}

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-texto">Lançou errado?</h2>
            <p className="mt-1 text-sm text-texto-suave">
              Viagem duplicada, placa trocada, CT-e cancelado. Excluir tira a viagem das
              listas e de todos os relatórios, e continua dando para restaurar.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={rota(`/viagens/${viagem.id}/excluir`)}>
                <Button variante="perigo">Excluir viagem</Button>
              </Link>
              <Link href="/viagens">
                <Button variante="secundario">Voltar para viagens</Button>
              </Link>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
