import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarMoeda } from '@/lib/utils'
import { Badge, CabecalhoPagina, Card, Tabela, Td, Th } from '@/components/ui'
import { EM_ABERTO, hojeUtc, resumoFinanceiro } from './consultas'

export const dynamic = 'force-dynamic'

/**
 * Fluxo de caixa por faixa de vencimento.
 *
 * Títulos sem vencimento — os que esperam o cliente pagar para o agregado ser
 * acertado — ficam numa faixa própria: projetá-los numa data inventada daria
 * ao operador uma falsa sensação de compromisso marcado.
 */
const FAIXAS = [
  { rotulo: 'Vencidos', ateDias: -1 },
  { rotulo: 'Próximos 7 dias', ateDias: 7 },
  { rotulo: 'De 8 a 30 dias', ateDias: 30 },
  { rotulo: 'Mais de 30 dias', ateDias: Infinity },
] as const

export default async function PainelFinanceiro() {
  const [resumo, abertos] = await Promise.all([
    resumoFinanceiro(),
    prisma.lancamento.findMany({
      where: { status: EM_ABERTO },
      select: { tipo: true, valor: true, valorPago: true, dataVencimento: true },
    }),
  ])

  const hoje = hojeUtc()
  const linhas = FAIXAS.map((faixa) => ({ rotulo: faixa.rotulo, receber: 0, pagar: 0 }))
  let semData = { receber: 0, pagar: 0 }

  for (const titulo of abertos) {
    const restante = Number(titulo.valor) - Number(titulo.valorPago)
    const alvo = titulo.tipo === 'RECEITA' ? 'receber' : 'pagar'

    if (!titulo.dataVencimento) {
      semData[alvo] += restante
      continue
    }

    const dias = Math.floor(
      (titulo.dataVencimento.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000),
    )
    const indice = FAIXAS.findIndex((f) => dias <= f.ateDias)
    linhas[indice === -1 ? FAIXAS.length - 1 : indice][alvo] += restante
  }

  const cartoes = [
    {
      rotulo: 'A receber',
      valor: resumo.aReceber,
      detalhe: `${resumo.aReceberQtd} título${resumo.aReceberQtd === 1 ? '' : 's'}`,
      href: '/financeiro/receber',
      alerta: resumo.vencidosReceberQtd > 0
        ? `${resumo.vencidosReceberQtd} vencido${resumo.vencidosReceberQtd === 1 ? '' : 's'}`
        : null,
    },
    {
      rotulo: 'A pagar',
      valor: resumo.aPagar,
      detalhe: `${resumo.aPagarQtd} título${resumo.aPagarQtd === 1 ? '' : 's'}`,
      href: '/financeiro/pagar',
      alerta: resumo.vencidosPagarQtd > 0
        ? `${resumo.vencidosPagarQtd} vencido${resumo.vencidosPagarQtd === 1 ? '' : 's'}`
        : null,
    },
  ] as const

  const saldoProjetado = resumo.aReceber - resumo.aPagar

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="Contas a pagar, a receber e o que está por vencer."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {cartoes.map((cartao) => (
          <Link key={cartao.href} href={cartao.href} className="group">
            <Card className="h-full p-4 transition-colors group-hover:border-primaria/40">
              <p className="text-sm text-texto-suave">{cartao.rotulo}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-texto">
                {formatarMoeda(cartao.valor)}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                {cartao.detalhe}
                {cartao.alerta && <Badge tom="erro">{cartao.alerta}</Badge>}
              </p>
            </Card>
          </Link>
        ))}

        <Card className="h-full p-4">
          <p className="text-sm text-texto-suave">Saldo projetado</p>
          <p
            className={
              saldoProjetado >= 0
                ? 'mt-1 text-2xl font-semibold tabular-nums text-primaria'
                : 'mt-1 text-2xl font-semibold tabular-nums text-erro'
            }
          >
            {formatarMoeda(saldoProjetado)}
          </p>
          <p className="mt-1 text-xs text-texto-suave">
            Tudo que há a receber menos tudo que há a pagar
          </p>
        </Card>
      </div>

      <Card>
        <div className="border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">Fluxo de caixa por vencimento</h2>
        </div>
        <Tabela>
          <thead>
            <tr>
              <Th>Quando</Th>
              <Th className="text-right">A receber</Th>
              <Th className="text-right">A pagar</Th>
              <Th className="text-right">Saldo</Th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const saldo = linha.receber - linha.pagar
              const vazia = linha.receber === 0 && linha.pagar === 0
              return (
                <tr key={linha.rotulo} className={vazia ? 'text-texto-suave' : ''}>
                  <Td className="text-texto">{linha.rotulo}</Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {linha.receber === 0 ? '—' : formatarMoeda(linha.receber)}
                  </Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {linha.pagar === 0 ? '—' : formatarMoeda(linha.pagar)}
                  </Td>
                  <Td
                    className={
                      vazia
                        ? 'text-right tabular-nums'
                        : saldo >= 0
                          ? 'text-right tabular-nums font-medium text-primaria'
                          : 'text-right tabular-nums font-medium text-erro'
                    }
                  >
                    {vazia ? '—' : formatarMoeda(saldo)}
                  </Td>
                </tr>
              )
            })}
            {(semData.receber > 0 || semData.pagar > 0) && (
              <tr>
                <Td className="text-texto">
                  Aguardando o cliente pagar
                  <span className="ml-2 text-xs text-texto-suave">
                    repasse a agregado
                  </span>
                </Td>
                <Td className="text-right tabular-nums text-texto-suave">
                  {semData.receber === 0 ? '—' : formatarMoeda(semData.receber)}
                </Td>
                <Td className="text-right tabular-nums text-texto-suave">
                  {semData.pagar === 0 ? '—' : formatarMoeda(semData.pagar)}
                </Td>
                <Td className="text-right tabular-nums text-texto-suave">—</Td>
              </tr>
            )}
          </tbody>
        </Tabela>
      </Card>

      <p className="mt-4 text-sm text-texto-suave">
        No mês: {formatarMoeda(resumo.recebidoMes)} recebidos e{' '}
        {formatarMoeda(resumo.pagoMes)} pagos.
      </p>
    </>
  )
}
