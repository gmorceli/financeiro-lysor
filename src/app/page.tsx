import Link from 'next/link'
import type { Route } from 'next'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/sessao'
import { podeAcessar } from '@/lib/permissoes'
import { formatarMoeda, rota } from '@/lib/utils'
import { Badge, Button, CabecalhoPagina, Card, LINK_TABELA, Tabela, Td, Th } from '@/components/ui'
import { EM_ABERTO, emDias, hojeUtc, resumoFinanceiro } from './financeiro/consultas'

export const dynamic = 'force-dynamic'

/**
 * A tela da manhã.
 *
 * Perguntada sobre o que precisaria ver todo dia, a cliente respondeu contas a
 * pagar, contas a receber e saldo do caixa — não lucro por caminhão. Lucro é
 * relatório de fechamento; isto aqui é o que ela abre às cinco da manhã.
 */
export default async function Inicio() {
  const usuario = await exigirUsuario()
  const hoje = hojeUtc()

  /**
   * Quem é só Operação não vê dinheiro nesta tela. Não basta esconder os
   * cartões: as consultas nem rodam, porque valor a receber não deve nem sair
   * do banco para uma renderização que não tem direito a ele.
   */
  const veFinanceiro = podeAcessar(usuario.perfil, 'financeiro')

  const [resumo, vencendo, viagensAbertas, incompletas] = await Promise.all([
    veFinanceiro ? resumoFinanceiro() : null,
    veFinanceiro
      ? prisma.lancamento.findMany({
          where: { status: EM_ABERTO, dataVencimento: { lte: emDias(7) } },
          include: {
            cliente: { select: { razaoSocial: true, nomeFantasia: true } },
            fornecedor: { select: { nome: true } },
            proprietario: { select: { nome: true } },
          },
          orderBy: { dataVencimento: 'asc' },
          take: 12,
        })
      : [],
    prisma.viagem.findMany({
      where: { status: { in: ['PLANEJADA', 'EM_ANDAMENTO'] }, excluidaEm: null },
      include: {
        veiculo: { select: { apelido: true } },
        motorista: { select: { nome: true } },
        _count: { select: { fretes: true } },
      },
      orderBy: { dataSaida: 'asc' },
      take: 10,
    }),
    // Viagem fechada sem frete lançado é receita que ficou para trás.
    prisma.viagem.count({
      where: { status: { not: 'PLANEJADA' }, fretes: { none: {} }, excluidaEm: null },
    }),
  ])

  const indicadores: Array<{
    rotulo: string
    valor: number
    href: Route
    destaque?: boolean
  }> = resumo
    ? [
        { rotulo: 'A receber', valor: resumo.aReceber, href: '/financeiro/receber' },
        { rotulo: 'A pagar', valor: resumo.aPagar, href: '/financeiro/pagar' },
        {
          rotulo: 'Saldo projetado',
          valor: resumo.aReceber - resumo.aPagar,
          href: '/financeiro',
          destaque: true,
        },
      ]
    : []

  return (
    <>
      <CabecalhoPagina
        titulo="Bom dia"
        descricao="O que precisa de atenção hoje."
        acao={
          <Link href="/viagens/nova">
            <Button>Abrir viagem</Button>
          </Link>
        }
      />

      {((resumo?.vencidosPagarQtd ?? 0) > 0 ||
        (resumo?.vencidosReceberQtd ?? 0) > 0 ||
        incompletas > 0) && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-alerta">Precisa de atenção</h2>
          {/*
            A linha inteira é o link, não um trecho da frase.
            Este cartão é o que a cliente abre às cinco da manhã e é por ele que
            ela entra no sistema — deixar o alvo do tamanho de duas palavras no
            meio de um parágrafo é o pior lugar possível para economizar pixel.
          */}
          <ul className="mt-1 text-sm text-texto">
            {resumo && resumo.vencidosPagarQtd > 0 && (
              <li>
                <Link
                  href="/financeiro/pagar"
                  className="-mx-2 flex min-h-11 items-center rounded-lg px-2 hover:bg-amber-100/60"
                >
                  <span className="font-medium text-primaria">
                    {resumo.vencidosPagarQtd} conta{resumo.vencidosPagarQtd === 1 ? '' : 's'} a
                    pagar vencida{resumo.vencidosPagarQtd === 1 ? '' : 's'}
                  </span>
                  <span className="ml-1">— {formatarMoeda(resumo.vencidosPagar)}</span>
                </Link>
              </li>
            )}
            {resumo && resumo.vencidosReceberQtd > 0 && (
              <li>
                <Link
                  href="/financeiro/receber"
                  className="-mx-2 flex min-h-11 items-center rounded-lg px-2 hover:bg-amber-100/60"
                >
                  <span className="font-medium text-primaria">
                    {resumo.vencidosReceberQtd} recebimento
                    {resumo.vencidosReceberQtd === 1 ? '' : 's'} em atraso
                  </span>
                  <span className="ml-1">— {formatarMoeda(resumo.vencidosReceber)}</span>
                </Link>
              </li>
            )}
            {incompletas > 0 && (
              <li>
                <Link
                  href="/viagens"
                  className="-mx-2 flex min-h-11 items-center rounded-lg px-2 hover:bg-amber-100/60"
                >
                  <span className="font-medium text-primaria">
                    {incompletas} viagem{incompletas === 1 ? '' : 'ns'} sem frete lançado
                  </span>
                  <span className="ml-1 text-texto-suave">— receita ficando para trás</span>
                </Link>
              </li>
            )}
          </ul>
        </Card>
      )}

      {indicadores.length > 0 && (
      <div className="mb-4 grid gap-2 sm:grid-cols-3 sm:gap-3">
        {indicadores.map((indicador) => (
          <Link key={indicador.rotulo} href={indicador.href} className="group">
            {/*
              No celular cada indicador é uma linha — rótulo à esquerda, valor à
              direita. Em três colunas a 375px "R$ 30.611,07" não cabe: o valor
              vazava do cartão e o sinal de menos caía para a linha de cima.
            */}
            <Card className="flex h-full items-baseline justify-between gap-2 p-3 transition-colors group-hover:border-primaria/40 sm:block sm:p-4">
              <p className="text-sm text-texto-suave">{indicador.rotulo}</p>
              <p
                className={
                  indicador.destaque && indicador.valor < 0
                    ? 'whitespace-nowrap text-lg font-semibold tabular-nums text-erro sm:mt-1 sm:text-2xl'
                    : indicador.destaque
                      ? 'whitespace-nowrap text-lg font-semibold tabular-nums text-primaria sm:mt-1 sm:text-2xl'
                      : 'whitespace-nowrap text-lg font-semibold tabular-nums text-texto sm:mt-1 sm:text-2xl'
                }
              >
                {formatarMoeda(indicador.valor)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      )}

      <div className={veFinanceiro ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
        {veFinanceiro && (
        <Card>
          <div className="border-b border-borda px-4 py-3">
            <h2 className="text-sm font-semibold text-texto">Vence nos próximos 7 dias</h2>
          </div>
          {vencendo.length === 0 ? (
            <p className="px-4 py-6 text-sm text-texto-suave">Nada vencendo esta semana.</p>
          ) : (
            <Tabela minimo="min-w-0">
              <thead>
                <tr>
                  <Th>Vence</Th>
                  <Th>Quem</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {vencendo.map((titulo) => {
                  const quem =
                    titulo.cliente?.nomeFantasia ||
                    titulo.cliente?.razaoSocial ||
                    titulo.fornecedor?.nome ||
                    titulo.proprietario?.nome ||
                    titulo.descricao
                  const vencido = titulo.dataVencimento! < hoje
                  return (
                    <tr key={titulo.id}>
                      <Td className={vencido ? 'tabular-nums text-erro' : 'tabular-nums text-texto-suave'}>
                        {titulo.dataVencimento!.toLocaleDateString('pt-BR', {
                          timeZone: 'UTC',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </Td>
                      <Td className="max-w-40 truncate text-texto" title={quem}>
                        {quem}
                      </Td>
                      <Td
                        className={
                          titulo.tipo === 'RECEITA'
                            ? 'whitespace-nowrap text-right tabular-nums text-primaria'
                            : 'whitespace-nowrap text-right tabular-nums text-texto'
                        }
                      >
                        {titulo.tipo === 'RECEITA' ? '+' : '−'}&nbsp;
                        {formatarMoeda(Number(titulo.valor) - Number(titulo.valorPago))}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Tabela>
          )}
        </Card>
        )}

        <Card>
          <div className="border-b border-borda px-4 py-3">
            <h2 className="text-sm font-semibold text-texto">Viagens em aberto</h2>
          </div>
          {viagensAbertas.length === 0 ? (
            <p className="px-4 py-6 text-sm text-texto-suave">
              Nenhuma viagem em aberto.
            </p>
          ) : (
            <Tabela>
              <thead>
                <tr>
                  <Th>Nº</Th>
                  <Th>Caminhão</Th>
                  <Th>Rota</Th>
                  <Th>Frete</Th>
                </tr>
              </thead>
              <tbody>
                {viagensAbertas.map((viagem) => (
                  <tr key={viagem.id} className="hover:bg-fundo">
                    <Td className="tabular-nums">
                      <Link
                        href={rota(`/viagens/${viagem.id}`)}
                        className={LINK_TABELA}
                      >
                        {viagem.numero}
                      </Link>
                    </Td>
                    <Td className="text-texto">{viagem.veiculo.apelido}</Td>
                    <Td className="max-w-40 truncate text-texto-suave">
                      {viagem.origem} → {viagem.destino}
                    </Td>
                    <Td>
                      {viagem._count.fretes === 0 ? (
                        <Badge tom="alerta">falta lançar</Badge>
                      ) : (
                        <Badge tom="positivo">{viagem._count.fretes}</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Card>
      </div>
    </>
  )
}
