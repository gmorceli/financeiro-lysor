import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { calcularConsumo } from '@/lib/calculos'
import { formatarData, formatarMoeda, formatarNumero } from '@/lib/utils'
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

/**
 * O km/l é calculado na leitura, comparando cada abastecimento de tanque cheio
 * com o anterior do mesmo veículo. Guardar o número no banco significaria
 * recalcular tudo a cada lançamento retroativo — e lançamento retroativo vai
 * acontecer, porque o cupom às vezes chega dias depois.
 */
export default async function ListaAbastecimentos() {
  const abastecimentos = await prisma.abastecimento.findMany({
    include: {
      veiculo: { select: { apelido: true } },
      fornecedor: { select: { nome: true } },
      motorista: { select: { nome: true } },
    },
    orderBy: [{ data: 'desc' }, { odometro: 'desc' }],
    take: 200,
  })

  // Para cada veículo, o abastecimento de tanque cheio imediatamente anterior.
  const anteriorPorVeiculo = new Map<string, { odometro: number }>()
  const cronologico = [...abastecimentos].sort(
    (a, b) => a.odometro - b.odometro || a.data.getTime() - b.data.getTime(),
  )
  const consumoPorId = new Map<string, number | null>()

  for (const a of cronologico) {
    const anterior = anteriorPorVeiculo.get(a.veiculoId)
    consumoPorId.set(
      a.id,
      a.tanqueCheio && anterior
        ? calcularConsumo(anterior.odometro, a.odometro, Number(a.litros))
        : null,
    )
    if (a.tanqueCheio) anteriorPorVeiculo.set(a.veiculoId, { odometro: a.odometro })
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Abastecimentos"
        descricao="O maior custo variável da operação. O km/l sai daqui."
        acao={
          <Link href="/custos/abastecimentos/novo">
            <Button>Lançar abastecimento</Button>
          </Link>
        }
      />

      <Card>
        {abastecimentos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum abastecimento lançado"
            descricao="Lance com o km do painel e os litros. É o que permite calcular o consumo e o custo por quilômetro."
            acao={
              <Link href="/custos/abastecimentos/novo">
                <Button>Lançar o primeiro</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Caminhão</Th>
                <Th className="text-right">Km</Th>
                <Th className="text-right">Litros</Th>
                <Th className="text-right">R$/l</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">km/l</Th>
                <Th>Posto</Th>
              </tr>
            </thead>
            <tbody>
              {abastecimentos.map((a) => {
                const consumo = consumoPorId.get(a.id)
                return (
                  <tr key={a.id} className="hover:bg-fundo">
                    <Td className="tabular-nums text-texto-suave">{formatarData(a.data)}</Td>
                    <Td className="text-texto">{a.veiculo.apelido}</Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {formatarNumero(a.odometro)}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {formatarNumero(Number(a.litros), 1)}
                      {!a.tanqueCheio && (
                        <Badge className="ml-1" tom="neutro">
                          parcial
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {formatarMoeda(a.valorLitro)}
                    </Td>
                    <Td className="text-right tabular-nums font-medium text-texto">
                      {formatarMoeda(a.valorTotal)}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {consumo == null ? '—' : consumo.toFixed(2).replace('.', ',')}
                    </Td>
                    <Td className="text-texto-suave">{a.fornecedor?.nome ?? '—'}</Td>
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
