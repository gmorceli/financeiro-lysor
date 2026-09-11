import Link from 'next/link'
import { calcularResultado, limitesDoMes, mesAtual } from '@/lib/resultado'
import { formatarMoeda, formatarNumero } from '@/lib/utils'
import { Button, CabecalhoPagina, Card, Tabela, Td, Th } from '@/components/ui'
import { SeletorMes } from './seletor-mes'
import { Cascata } from './cascata'

export const dynamic = 'force-dynamic'

/** Aceita "2026-09"; qualquer outra coisa cai no mês corrente. */
function lerMes(texto: string | undefined) {
  const casa = texto?.match(/^(\d{4})-(\d{2})$/)
  if (!casa) return mesAtual()
  const ano = Number(casa[1])
  const mes = Number(casa[2])
  if (mes < 1 || mes > 12) return mesAtual()
  return { ano, mes }
}

export default async function Relatorios({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes: mesTexto } = await searchParams
  const { ano, mes } = lerMes(mesTexto)
  const { inicio, fim } = limitesDoMes(ano, mes)
  const valorSeletor = `${ano}-${String(mes).padStart(2, '0')}`

  const resultado = await calcularResultado(inicio, fim)
  const semDados =
    resultado.propria.receita === 0 &&
    resultado.agregado.receita === 0 &&
    resultado.porVeiculo.length === 0

  return (
    <>
      <CabecalhoPagina
        titulo="Resultado"
        descricao="Quanto cada caminhão faturou, quanto custou e quanto sobrou."
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <SeletorMes valor={valorSeletor} />
            <Link href={`/relatorios/fretes?mes=${valorSeletor}`}>
              <Button variante="secundario">Por frete</Button>
            </Link>
            {/*
              Link comum, não botão com ação: download é uma requisição GET, e o
              navegador cuida dele sem passar pelo roteador do Next.
            */}
            <a href={`/relatorios/exportar?mes=${valorSeletor}`} download>
              <Button variante="secundario">Excel</Button>
            </a>
          </div>
        }
      />

      {semDados ? (
        <Card className="p-6 text-sm text-texto-suave">
          Nenhuma viagem ou frete neste mês. Escolha outro período no seletor acima.
        </Card>
      ) : (
        <>
          <Cascata resultado={resultado} />

          <Card className="mt-4">
            <div className="border-b border-borda px-4 py-3">
              <h2 className="text-sm font-semibold text-texto">Resultado por caminhão</h2>
            </div>
            {resultado.porVeiculo.length === 0 ? (
              <p className="px-4 py-6 text-sm text-texto-suave">
                Nenhum caminhão rodou neste mês.
              </p>
            ) : (
              <Tabela>
                <thead>
                  <tr>
                    <Th>Caminhão</Th>
                    <Th className="text-right">Receita</Th>
                    <Th className="text-right">Custo direto</Th>
                    <Th className="text-right">Custo do caminhão</Th>
                    <Th className="text-right">Resultado</Th>
                    <Th className="text-right">Km</Th>
                    <Th className="text-right">R$/km</Th>
                    <Th className="text-right">Custo/km</Th>
                    <Th className="text-right">km/l</Th>
                    <Th className="text-right">% vazio</Th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.porVeiculo.map((linha) => {
                    const percentualVazio =
                      linha.kmRodado > 0
                        ? Math.round((linha.kmVazio / linha.kmRodado) * 100)
                        : null
                    return (
                      <tr key={linha.veiculoId} className="hover:bg-fundo">
                        <Td className="font-medium text-texto">{linha.apelido}</Td>
                        <Td className="text-right tabular-nums text-texto-suave">
                          {formatarMoeda(linha.receita)}
                        </Td>
                        <Td className="text-right tabular-nums text-texto-suave">
                          {formatarMoeda(linha.custoDireto)}
                        </Td>
                        <Td className="text-right tabular-nums text-texto-suave">
                          {formatarMoeda(linha.custoVeiculo)}
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
                        <Td className="text-right tabular-nums text-texto-suave">
                          {formatarNumero(linha.kmRodado)}
                        </Td>
                        <Td className="text-right tabular-nums text-texto-suave">
                          {linha.receitaPorKm == null ? '—' : formatarMoeda(linha.receitaPorKm)}
                        </Td>
                        <Td className="text-right tabular-nums text-texto-suave">
                          {linha.custoPorKm == null ? '—' : formatarMoeda(linha.custoPorKm)}
                        </Td>
                        <Td className="text-right tabular-nums text-texto-suave">
                          {linha.consumo == null
                            ? '—'
                            : linha.consumo.toFixed(2).replace('.', ',')}
                        </Td>
                        <Td
                          className={
                            percentualVazio != null && percentualVazio >= 40
                              ? 'text-right tabular-nums text-alerta'
                              : 'text-right tabular-nums text-texto-suave'
                          }
                        >
                          {percentualVazio == null ? '—' : `${percentualVazio}%`}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Tabela>
            )}
          </Card>

          {resultado.propria.percentualVazio != null && (
            <p className="mt-4 text-sm text-texto-suave">
              A frota rodou {formatarNumero(resultado.propria.kmRodado)} km no mês, dos quais{' '}
              <strong className="text-texto">
                {formatarNumero(resultado.propria.kmVazio)} km vazios (
                {Math.round(resultado.propria.percentualVazio)}%)
              </strong>
              . Cada quilômetro vazio custa diesel e desgaste sem receita nenhuma.
            </p>
          )}
        </>
      )}
    </>
  )
}
