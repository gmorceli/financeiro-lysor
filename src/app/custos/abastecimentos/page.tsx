import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { calcularConsumo } from '@/lib/calculos'
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
    orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
    take: 200,
  })

  // Para cada veículo, o abastecimento de tanque cheio imediatamente anterior.
  // Só entram os que têm km anotado: o km virou opcional, e um registro sem km
  // não fecha intervalo de consumo nem pode servir de leitura anterior.
  const anteriorPorVeiculo = new Map<string, { odometro: number }>()
  const cronologico = [...abastecimentos].sort(
    (a, b) => a.data.getTime() - b.data.getTime() || (a.odometro ?? 0) - (b.odometro ?? 0),
  )
  const consumoPorId = new Map<string, number | null>()

  for (const a of cronologico) {
    const anterior = anteriorPorVeiculo.get(a.veiculoId)
    consumoPorId.set(
      a.id,
      a.tanqueCheio && anterior && a.odometro != null
        ? calcularConsumo(anterior.odometro, a.odometro, Number(a.litros))
        : null,
    )
    if (a.tanqueCheio && a.odometro != null) {
      anteriorPorVeiculo.set(a.veiculoId, { odometro: a.odometro })
    }
  }

  // Suspeita de duplicidade: mesmo caminhão, mesmo dia, mesmo valor.
  //
  // O abastecimento saiu de dentro da viagem, e os que já existiam foram
  // convertidos em custo do caminhão. Se o mesmo tanque tinha sido lançado em
  // duas viagens diferentes, a conversão deixou duas despesas iguais lado a
  // lado — o diesel contado em dobro no fechamento do mês. O sistema não apaga
  // sozinho porque abastecer duas vezes no mesmo posto no mesmo dia acontece;
  // ele marca, e quem sabe decide.
  const chaveDuplicidade = (a: (typeof abastecimentos)[number]) =>
    `${a.veiculoId}|${a.data.toISOString().slice(0, 10)}|${Number(a.valorTotal).toFixed(2)}`
  const vezes = new Map<string, number>()
  for (const a of abastecimentos) {
    const chave = chaveDuplicidade(a)
    vezes.set(chave, (vezes.get(chave) ?? 0) + 1)
  }
  const suspeitos = abastecimentos.filter((a) => (vezes.get(chaveDuplicidade(a)) ?? 0) > 1)
  const ehSuspeito = new Set(suspeitos.map((a) => a.id))

  return (
    <>
      <CabecalhoPagina
        titulo="Abastecimentos"
        descricao="Custo do caminhão no mês, valor exato. O km/l sai daqui."
        acao={
          <Link href="/custos/abastecimentos/novo">
            <Button>Lançar abastecimento</Button>
          </Link>
        }
      />

      {suspeitos.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-texto">
          <strong className="font-medium text-alerta">
            {suspeitos.length} lançamentos parecem repetidos.
          </strong>{' '}
          Mesmo caminhão, mesmo dia e mesmo valor —{' '}
          {[...new Set(suspeitos.map((a) => a.veiculo.apelido))].join(', ')}. Se for o
          mesmo abastecimento lançado duas vezes, o diesel está contado em dobro no
          fechamento do mês: abra e exclua um dos dois.
        </Card>
      )}

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
                <Th />
              </tr>
            </thead>
            <tbody>
              {abastecimentos.map((a) => {
                const consumo = consumoPorId.get(a.id)
                return (
                  <tr key={a.id} className="hover:bg-fundo">
                    <Td className="tabular-nums text-texto-suave">
                      {formatarData(a.data)}
                      {ehSuspeito.has(a.id) && (
                        <Badge className="ml-2" tom="alerta">
                          repetido?
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-texto">{a.veiculo.apelido}</Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {a.odometro == null ? '—' : formatarNumero(a.odometro)}
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
                    {/*
                      Um litro digitado a mais estraga o km/l, o custo por km e a
                      margem da viagem. Precisa ter volta.
                    */}
                    <Td className="text-right">
                      <Link
                        href={rota(`/custos/abastecimentos/${a.id}`)}
                        className={LINK_TABELA}
                      >
                        Corrigir
                      </Link>
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
