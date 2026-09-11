import Link from 'next/link'
import { calcularResultadoPorFrete, limitesDoMes, mesAtual } from '@/lib/resultado'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { Badge, Button, CabecalhoPagina, Card, Tabela, Td, Th } from '@/components/ui'
import { SeletorMes } from '../seletor-mes'

export const dynamic = 'force-dynamic'

function lerMes(texto: string | undefined) {
  const casa = texto?.match(/^(\d{4})-(\d{2})$/)
  if (!casa) return mesAtual()
  const ano = Number(casa[1])
  const mes = Number(casa[2])
  if (mes < 1 || mes > 12) return mesAtual()
  return { ano, mes }
}

export default async function ResultadoPorFrete({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes: mesTexto } = await searchParams
  const { ano, mes } = lerMes(mesTexto)
  const { inicio, fim } = limitesDoMes(ano, mes)
  const valorSeletor = `${ano}-${String(mes).padStart(2, '0')}`

  const linhas = await calcularResultadoPorFrete(inicio, fim)
  const totais = linhas.reduce(
    (acumulado, linha) => ({
      receita: acumulado.receita + linha.receita,
      custoDireto: acumulado.custoDireto + linha.custoDiretoRateado,
      custoVeiculo: acumulado.custoVeiculo + linha.custoVeiculoRateado,
      resultado: acumulado.resultado + linha.resultado,
    }),
    { receita: 0, custoDireto: 0, custoVeiculo: 0, resultado: 0 },
  )

  return (
    <>
      <CabecalhoPagina
        titulo="Resultado por frete"
        descricao="Diesel e pedágio são da viagem — aqui aparecem rateados por frete, na proporção da receita."
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <SeletorMes valor={valorSeletor} />
            <Link href={`/relatorios?mes=${valorSeletor}`}>
              <Button variante="secundario">Por caminhão</Button>
            </Link>
          </div>
        }
      />

      <Card>
        {linhas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-texto-suave">
            Nenhum frete neste mês. Escolha outro período no seletor acima.
          </p>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>CT-e</Th>
                <Th>Cliente</Th>
                <Th>Rota</Th>
                <Th>Quem rodou</Th>
                <Th className="text-right">Receita</Th>
                <Th className="text-right">Custo direto</Th>
                <Th className="text-right">Custo do caminhão</Th>
                <Th className="text-right">Resultado</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.freteId} className="hover:bg-fundo">
                  <Td className="tabular-nums text-texto-suave">{formatarData(linha.data)}</Td>
                  <Td className="tabular-nums text-texto-suave">{linha.numeroCte ?? '—'}</Td>
                  <Td className="text-texto">{linha.cliente}</Td>
                  <Td className="max-w-48 truncate text-texto-suave" title={linha.rota}>
                    {linha.rota}
                  </Td>
                  <Td>
                    {linha.veiculo ? (
                      <span className="text-texto-suave">{linha.veiculo}</span>
                    ) : (
                      <Badge>Agregado</Badge>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {formatarMoeda(linha.receita)}
                  </Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {linha.custoDiretoRateado === 0
                      ? '—'
                      : formatarMoeda(linha.custoDiretoRateado)}
                  </Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {linha.custoVeiculoRateado === 0
                      ? '—'
                      : formatarMoeda(linha.custoVeiculoRateado)}
                  </Td>
                  <Td
                    className={
                      linha.resultado >= 0
                        ? 'text-right tabular-nums font-semibold text-primaria'
                        : 'text-right tabular-nums font-semibold text-erro'
                    }
                  >
                    {formatarMoeda(linha.resultado)}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-fundo">
                <Td colSpan={5} className="font-medium text-texto">
                  {linhas.length} frete{linhas.length === 1 ? '' : 's'}
                </Td>
                <Td className="text-right tabular-nums font-semibold text-texto">
                  {formatarMoeda(totais.receita)}
                </Td>
                <Td className="text-right tabular-nums font-semibold text-texto">
                  {formatarMoeda(totais.custoDireto)}
                </Td>
                <Td className="text-right tabular-nums font-semibold text-texto">
                  {formatarMoeda(totais.custoVeiculo)}
                </Td>
                <Td
                  className={
                    totais.resultado >= 0
                      ? 'text-right tabular-nums font-semibold text-primaria'
                      : 'text-right tabular-nums font-semibold text-erro'
                  }
                >
                  {formatarMoeda(totais.resultado)}
                </Td>
              </tr>
            </tfoot>
          </Tabela>
        )}
      </Card>

      <p className="mt-4 text-sm text-texto-suave">
        Frete de agregado não tem custo rateado: o caminhão é dele, e a receita da Lysor
        é só a comissão e o seguro. O custo fixo da empresa não entra nesta tela — ele
        aparece só no resultado do mês.
      </p>
    </>
  )
}
