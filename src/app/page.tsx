import Link from 'next/link'
import type { Route } from 'next'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/sessao'
import { podeAcessar } from '@/lib/permissoes'
import { formatarMoeda, rota } from '@/lib/utils'
import { Badge, Button, CabecalhoPagina, Card, Tabela, Td, Th } from '@/components/ui'
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
      where: { status: { in: ['PLANEJADA', 'EM_ANDAMENTO'] } },
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
      where: { status: { not: 'PLANEJADA' }, fretes: { none: {} } },
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

      {indicadores.length > 0 && (
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {indicadores.map((indicador) => (
          <Link key={indicador.rotulo} href={indicador.href} className="group">
            <Card className="h-full p-4 transition-colors group-hover:border-primaria/40">
              <p className="text-sm text-texto-suave">{indicador.rotulo}</p>
              <p
                className={
                  indicador.destaque && indicador.valor < 0
                    ? 'mt-1 text-2xl font-semibold tabular-nums text-erro'
                    : indicador.destaque
                      ? 'mt-1 text-2xl font-semibold tabular-nums text-primaria'
                      : 'mt-1 text-2xl font-semibold tabular-nums text-texto'
                }
              >
                {formatarMoeda(indicador.valor)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      )}

      {((resumo?.vencidosPagarQtd ?? 0) > 0 ||
        (resumo?.vencidosReceberQtd ?? 0) > 0 ||
        incompletas > 0) && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-alerta">Precisa de atenção</h2>
          <ul className="mt-2 space-y-1 text-sm text-texto">
            {resumo && resumo.vencidosPagarQtd > 0 && (
              <li>
                <Link href="/financeiro/pagar" className="text-primaria hover:underline">
                  {resumo.vencidosPagarQtd} conta{resumo.vencidosPagarQtd === 1 ? '' : 's'} a
                  pagar vencida{resumo.vencidosPagarQtd === 1 ? '' : 's'}
                </Link>{' '}
                — {formatarMoeda(resumo.vencidosPagar)}
              </li>
            )}
            {resumo && resumo.vencidosReceberQtd > 0 && (
              <li>
                <Link href="/financeiro/receber" className="text-primaria hover:underline">
                  {resumo.vencidosReceberQtd} recebimento
                  {resumo.vencidosReceberQtd === 1 ? '' : 's'} em atraso
                </Link>{' '}
                — {formatarMoeda(resumo.vencidosReceber)}
              </li>
            )}
            {incompletas > 0 && (
              <li>
                <Link href="/viagens" className="text-primaria hover:underline">
                  {incompletas} viagem{incompletas === 1 ? '' : 'ns'} sem frete lançado
                </Link>{' '}
                — receita que pode estar ficando para trás
              </li>
            )}
          </ul>
        </Card>
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
            <Tabela>
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
                            ? 'text-right tabular-nums text-primaria'
                            : 'text-right tabular-nums text-texto'
                        }
                      >
                        {titulo.tipo === 'RECEITA' ? '+' : '−'}{' '}
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
                        className="font-medium text-primaria hover:underline"
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
