import { prisma } from '@/lib/prisma'
import { arredondar, calcularComissaoMotorista } from '@/lib/calculos'

/**
 * Motor de resultado gerencial.
 *
 * A conta é apresentada em cascata, e cada camada responde uma pergunta
 * diferente:
 *
 *   Receita
 *   − custos diretos (diesel, pedágio, comissão, despesa de estrada)
 *   = margem de contribuição ......... decide preço e aceitar ou recusar carga
 *   − custos do veículo (manutenção, seguro, IPVA, parcela)
 *   = resultado do caminhão .......... decide manter, trocar ou vender
 *   − custos fixos da empresa
 *   = lucro operacional .............. o resultado de verdade
 *
 * As duas primeiras camadas são fato: cada lançamento sabe a que viagem e a
 * que veículo pertence. Só a última usa rateio, e é por isso que ela fica
 * isolada no fim — se o critério mudar, as camadas de cima não se mexem.
 *
 * Frete de agregado não passa por aqui da mesma forma: não há caminhão da
 * Lysor rodando, então não há custo direto nem custo de veículo. A receita é
 * a comissão mais o seguro, e a margem é quase integral. São duas linhas de
 * negócio com estruturas de capital opostas, e misturá-las numa média produz
 * um número que não descreve nenhuma das duas.
 */

export type LinhaVeiculo = {
  veiculoId: string
  apelido: string
  receita: number
  custoDireto: number
  margemContribuicao: number
  custoVeiculo: number
  resultado: number
  kmRodado: number
  kmVazio: number
  litros: number
  consumo: number | null
  custoPorKm: number | null
  receitaPorKm: number | null
  viagens: number
  fretes: number
}

export type LinhaFrete = {
  freteId: string
  numeroCte: string | null
  data: Date
  cliente: string
  rota: string
  veiculo: string | null
  receita: number
  custoDiretoRateado: number
  custoVeiculoRateado: number
  margemContribuicao: number
  resultado: number
}

export type ResultadoPeriodo = {
  inicio: Date
  fim: Date
  propria: {
    receita: number
    custoDireto: number
    margemContribuicao: number
    custoVeiculo: number
    resultado: number
    kmRodado: number
    kmVazio: number
    percentualVazio: number | null
    litros: number
    consumo: number | null
  }
  agregado: {
    receita: number
    fretes: number
  }
  overhead: number
  lucroOperacional: number
  porVeiculo: LinhaVeiculo[]
  /** Custos de veículo que não puderam ser ligados a nenhuma viagem do período. */
  custoVeiculoSemViagem: number
}

/** Primeiro e último instante de um mês, em UTC. */
export function limitesDoMes(ano: number, mes: number) {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1))
  const fim = new Date(Date.UTC(ano, mes, 0))
  return { inicio, fim }
}

export function mesAtual() {
  const agora = new Date()
  return { ano: agora.getUTCFullYear(), mes: agora.getUTCMonth() + 1 }
}

/**
 * Comissão do motorista de uma viagem.
 *
 * Ainda não é um título — ela nasce no acerto, que é a próxima fatia — mas
 * entra no custo direto mesmo assim. Deixá-la de fora mostraria uma margem
 * inflada em cerca de 12% da receita, que é justamente o tipo de número
 * bonito e errado que este sistema existe para evitar.
 */
function comissaoDaViagem(viagem: {
  fretes: Array<{ valorFreteReal: unknown; valorCte: unknown }>
  motorista: { percentualComissao: unknown; baseComissao: 'FRETE_REAL' | 'VALOR_CTE' }
}) {
  return viagem.fretes.reduce(
    (soma, frete) =>
      soma +
      calcularComissaoMotorista(
        Number(frete.valorFreteReal),
        Number(frete.valorCte),
        Number(viagem.motorista.percentualComissao),
        viagem.motorista.baseComissao,
      ),
    0,
  )
}

export async function calcularResultado(
  inicio: Date,
  fim: Date,
): Promise<ResultadoPeriodo> {
  const periodo = { gte: inicio, lte: fim }

  const [viagens, fretesAgregado, lancamentosVeiculo, lancamentosOverhead] =
    await Promise.all([
      prisma.viagem.findMany({
        where: { dataSaida: periodo },
        include: {
          veiculo: { select: { id: true, apelido: true } },
          motorista: { select: { percentualComissao: true, baseComissao: true } },
          fretes: { select: { valorFreteReal: true, valorCte: true } },
          lancamentos: {
            where: { tipo: 'DESPESA', categoria: { nivelCusto: 'DIRETO_VIAGEM' } },
            select: { valor: true },
          },
          abastecimentos: { select: { litros: true } },
        },
      }),
      prisma.frete.findMany({
        where: { modalidade: 'AGREGADO', dataEmissao: periodo, status: { not: 'CANCELADO' } },
        select: { valorComissaoAgregado: true, valorSeguroAgregado: true },
      }),
      prisma.lancamento.findMany({
        where: {
          tipo: 'DESPESA',
          dataCompetencia: periodo,
          categoria: { nivelCusto: 'VEICULO' },
          status: { not: 'CANCELADO' },
        },
        select: { valor: true, veiculoId: true },
      }),
      prisma.lancamento.aggregate({
        _sum: { valor: true },
        where: {
          tipo: 'DESPESA',
          dataCompetencia: periodo,
          categoria: { nivelCusto: 'OVERHEAD' },
          status: { not: 'CANCELADO' },
        },
      }),
    ])

  // Custo de veículo agrupado, para casar com as viagens de cada um.
  const custoPorVeiculo = new Map<string, number>()
  let custoVeiculoSemDono = 0
  for (const lancamento of lancamentosVeiculo) {
    if (!lancamento.veiculoId) {
      custoVeiculoSemDono += Number(lancamento.valor)
      continue
    }
    custoPorVeiculo.set(
      lancamento.veiculoId,
      (custoPorVeiculo.get(lancamento.veiculoId) ?? 0) + Number(lancamento.valor),
    )
  }

  const porVeiculo = new Map<string, LinhaVeiculo>()

  for (const viagem of viagens) {
    const chave = viagem.veiculo.id
    const linha =
      porVeiculo.get(chave) ??
      {
        veiculoId: chave,
        apelido: viagem.veiculo.apelido,
        receita: 0,
        custoDireto: 0,
        margemContribuicao: 0,
        custoVeiculo: 0,
        resultado: 0,
        kmRodado: 0,
        kmVazio: 0,
        litros: 0,
        consumo: null,
        custoPorKm: null,
        receitaPorKm: null,
        viagens: 0,
        fretes: 0,
      }

    linha.receita += viagem.fretes.reduce((s, f) => s + Number(f.valorFreteReal), 0)
    linha.custoDireto +=
      viagem.lancamentos.reduce((s, l) => s + Number(l.valor), 0) + comissaoDaViagem(viagem)
    linha.kmRodado += viagem.kmFinal != null ? viagem.kmFinal - viagem.kmInicial : 0
    linha.kmVazio += viagem.kmVazio ?? 0
    linha.litros += viagem.abastecimentos.reduce((s, a) => s + Number(a.litros), 0)
    linha.viagens += 1
    linha.fretes += viagem.fretes.length

    porVeiculo.set(chave, linha)
  }

  // Custo do veículo entra por inteiro no resultado do próprio veículo — não
  // há rateio a fazer aqui, o lançamento já sabe de quem é.
  let custoVeiculoSemViagem = custoVeiculoSemDono
  for (const [veiculoId, custo] of custoPorVeiculo) {
    const linha = porVeiculo.get(veiculoId)
    if (linha) {
      linha.custoVeiculo += custo
    } else {
      // Veículo teve custo mas não rodou no período. O custo existe e precisa
      // aparecer em algum lugar, senão o lucro sai maior do que é.
      custoVeiculoSemViagem += custo
    }
  }

  const linhas = [...porVeiculo.values()].map((linha) => {
    linha.receita = arredondar(linha.receita)
    linha.custoDireto = arredondar(linha.custoDireto)
    linha.custoVeiculo = arredondar(linha.custoVeiculo)
    linha.margemContribuicao = arredondar(linha.receita - linha.custoDireto)
    linha.resultado = arredondar(linha.margemContribuicao - linha.custoVeiculo)
    linha.consumo =
      linha.litros > 0 && linha.kmRodado > 0
        ? arredondar(linha.kmRodado / linha.litros)
        : null
    linha.custoPorKm =
      linha.kmRodado > 0
        ? arredondar((linha.custoDireto + linha.custoVeiculo) / linha.kmRodado)
        : null
    linha.receitaPorKm =
      linha.kmRodado > 0 ? arredondar(linha.receita / linha.kmRodado) : null
    return linha
  })
  linhas.sort((a, b) => b.resultado - a.resultado)

  const propria = linhas.reduce(
    (acumulado, linha) => ({
      receita: acumulado.receita + linha.receita,
      custoDireto: acumulado.custoDireto + linha.custoDireto,
      custoVeiculo: acumulado.custoVeiculo + linha.custoVeiculo,
      kmRodado: acumulado.kmRodado + linha.kmRodado,
      kmVazio: acumulado.kmVazio + linha.kmVazio,
      litros: acumulado.litros + linha.litros,
    }),
    { receita: 0, custoDireto: 0, custoVeiculo: 0, kmRodado: 0, kmVazio: 0, litros: 0 },
  )

  const receitaAgregado = arredondar(
    fretesAgregado.reduce(
      (s, f) => s + Number(f.valorComissaoAgregado ?? 0) + Number(f.valorSeguroAgregado ?? 0),
      0,
    ),
  )

  const margemPropria = arredondar(propria.receita - propria.custoDireto)
  const resultadoPropria = arredondar(margemPropria - propria.custoVeiculo - custoVeiculoSemViagem)
  const overhead = arredondar(Number(lancamentosOverhead._sum.valor ?? 0))

  return {
    inicio,
    fim,
    propria: {
      receita: arredondar(propria.receita),
      custoDireto: arredondar(propria.custoDireto),
      margemContribuicao: margemPropria,
      custoVeiculo: arredondar(propria.custoVeiculo + custoVeiculoSemViagem),
      resultado: resultadoPropria,
      kmRodado: propria.kmRodado,
      kmVazio: propria.kmVazio,
      percentualVazio:
        propria.kmRodado > 0 ? arredondar((propria.kmVazio / propria.kmRodado) * 100) : null,
      litros: arredondar(propria.litros),
      consumo:
        propria.litros > 0 && propria.kmRodado > 0
          ? arredondar(propria.kmRodado / propria.litros)
          : null,
    },
    agregado: { receita: receitaAgregado, fretes: fretesAgregado.length },
    overhead,
    lucroOperacional: arredondar(resultadoPropria + receitaAgregado - overhead),
    porVeiculo: linhas,
    custoVeiculoSemViagem: arredondar(custoVeiculoSemViagem),
  }
}

/**
 * Resultado frete a frete.
 *
 * Aqui o rateio é inevitável: diesel e pedágio são da viagem, não de um CT-e
 * específico. O critério padrão é a proporção do valor do frete — o frete que
 * responde por metade da receita da viagem carrega metade do custo dela.
 *
 * O custo do veículo entra por km: o custo do mês daquele caminhão dividido
 * pelos km que ele rodou no mês, multiplicado pelos km da viagem, e então
 * rateado entre os fretes dela.
 */
export async function calcularResultadoPorFrete(
  inicio: Date,
  fim: Date,
): Promise<LinhaFrete[]> {
  const periodo = { gte: inicio, lte: fim }

  const [viagens, lancamentosVeiculo, fretesAgregado] = await Promise.all([
    prisma.viagem.findMany({
      where: { dataSaida: periodo },
      include: {
        veiculo: { select: { id: true, apelido: true } },
        motorista: { select: { percentualComissao: true, baseComissao: true } },
        fretes: {
          include: { cliente: { select: { razaoSocial: true, nomeFantasia: true } } },
        },
        lancamentos: {
          where: { tipo: 'DESPESA', categoria: { nivelCusto: 'DIRETO_VIAGEM' } },
          select: { valor: true },
        },
      },
    }),
    prisma.lancamento.findMany({
      where: {
        tipo: 'DESPESA',
        dataCompetencia: periodo,
        categoria: { nivelCusto: 'VEICULO' },
        status: { not: 'CANCELADO' },
      },
      select: { valor: true, veiculoId: true },
    }),
    prisma.frete.findMany({
      where: { modalidade: 'AGREGADO', dataEmissao: periodo, status: { not: 'CANCELADO' } },
      include: { cliente: { select: { razaoSocial: true, nomeFantasia: true } } },
    }),
  ])

  // Custo por km de cada veículo no período.
  const custoVeiculoMes = new Map<string, number>()
  for (const l of lancamentosVeiculo) {
    if (!l.veiculoId) continue
    custoVeiculoMes.set(l.veiculoId, (custoVeiculoMes.get(l.veiculoId) ?? 0) + Number(l.valor))
  }
  const kmMes = new Map<string, number>()
  for (const v of viagens) {
    if (v.kmFinal == null) continue
    kmMes.set(v.veiculo.id, (kmMes.get(v.veiculo.id) ?? 0) + (v.kmFinal - v.kmInicial))
  }

  const linhas: LinhaFrete[] = []

  for (const viagem of viagens) {
    const receitaViagem = viagem.fretes.reduce((s, f) => s + Number(f.valorFreteReal), 0)
    const custoDiretoViagem =
      viagem.lancamentos.reduce((s, l) => s + Number(l.valor), 0) + comissaoDaViagem(viagem)

    const kmViagem = viagem.kmFinal != null ? viagem.kmFinal - viagem.kmInicial : 0
    const kmDoVeiculo = kmMes.get(viagem.veiculo.id) ?? 0
    const custoKm =
      kmDoVeiculo > 0 ? (custoVeiculoMes.get(viagem.veiculo.id) ?? 0) / kmDoVeiculo : 0
    const custoVeiculoViagem = custoKm * kmViagem

    for (const frete of viagem.fretes) {
      // Sem receita na viagem, divide igualmente para não perder o custo.
      const proporcao =
        receitaViagem > 0
          ? Number(frete.valorFreteReal) / receitaViagem
          : 1 / viagem.fretes.length

      const custoDireto = arredondar(custoDiretoViagem * proporcao)
      const custoVeiculo = arredondar(custoVeiculoViagem * proporcao)
      const receita = Number(frete.valorFreteReal)

      linhas.push({
        freteId: frete.id,
        numeroCte: frete.numeroCte,
        data: frete.dataEmissao,
        cliente: frete.cliente.nomeFantasia || frete.cliente.razaoSocial,
        rota: `${frete.origem} → ${frete.destino}`,
        veiculo: viagem.veiculo.apelido,
        receita,
        custoDiretoRateado: custoDireto,
        custoVeiculoRateado: custoVeiculo,
        margemContribuicao: arredondar(receita - custoDireto),
        resultado: arredondar(receita - custoDireto - custoVeiculo),
      })
    }
  }

  // Frete de agregado: receita é a comissão e o seguro, sem custo de frota.
  for (const frete of fretesAgregado) {
    const receita = arredondar(
      Number(frete.valorComissaoAgregado ?? 0) + Number(frete.valorSeguroAgregado ?? 0),
    )
    linhas.push({
      freteId: frete.id,
      numeroCte: frete.numeroCte,
      data: frete.dataEmissao,
      cliente: frete.cliente.nomeFantasia || frete.cliente.razaoSocial,
      rota: `${frete.origem} → ${frete.destino}`,
      veiculo: null,
      receita,
      custoDiretoRateado: 0,
      custoVeiculoRateado: 0,
      margemContribuicao: receita,
      resultado: receita,
    })
  }

  linhas.sort((a, b) => b.data.getTime() - a.data.getTime())
  return linhas
}
