/**
 * Verifica a fatia de custos contra o banco: cada custo lançado precisa virar
 * um título financeiro apropriado à viagem e ao veículo, o parcelamento tem de
 * fechar exatamente com o total, e a margem de contribuição da viagem tem de
 * bater com receita menos custos.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { arredondar, calcularComissaoMotorista, calcularConsumo } from '../src/lib/calculos'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const MARCA = 'teste-custos'

async function main() {
  await prisma.abastecimento.deleteMany({ where: { lancamento: { observacoes: MARCA } } })
  await prisma.lancamento.deleteMany({ where: { observacoes: MARCA } })
  await prisma.lancamento.deleteMany({ where: { descricao: { contains: MARCA } } })
  await prisma.manutencao.deleteMany({ where: { descricao: { contains: MARCA } } })

  const viagem = await prisma.viagem.findFirstOrThrow({
    include: { veiculo: true, motorista: true, fretes: true },
  })
  const combustivel = await prisma.categoria.findUniqueOrThrow({ where: { nome: 'Combustível' } })
  const pedagio = await prisma.categoria.findUniqueOrThrow({ where: { nome: 'Pedágio' } })
  const manutencaoCat = await prisma.categoria.findUniqueOrThrow({ where: { nome: 'Manutenção' } })

  checar('categoria de combustível é custo direto da viagem', combustivel.nivelCusto === 'DIRETO_VIAGEM')
  checar('categoria de manutenção é custo do veículo', manutencaoCat.nivelCusto === 'VEICULO')

  // --- Abastecimento gera título -------------------------------------------
  const litros = 380
  const valorTotal = 2394
  const odometro = (viagem.kmFinal ?? viagem.kmInicial) + 50

  await prisma.$transaction(async (tx) => {
    const lanc = await tx.lancamento.create({
      data: {
        tipo: 'DESPESA',
        categoriaId: combustivel.id,
        descricao: `Abastecimento — ${viagem.veiculo.apelido}`,
        valor: new Prisma.Decimal(valorTotal),
        dataCompetencia: viagem.dataSaida,
        dataVencimento: viagem.dataSaida,
        veiculoId: viagem.veiculoId,
        viagemId: viagem.id,
        formaPagamento: 'BOLETO',
        observacoes: MARCA,
      },
    })
    await tx.abastecimento.create({
      data: {
        veiculoId: viagem.veiculoId,
        viagemId: viagem.id,
        data: viagem.dataSaida,
        litros: new Prisma.Decimal(litros),
        valorLitro: new Prisma.Decimal((valorTotal / litros).toFixed(4)),
        valorTotal: new Prisma.Decimal(valorTotal),
        odometro,
        tanqueCheio: true,
        lancamentoId: lanc.id,
      },
    })
  })

  const abast = await prisma.abastecimento.findFirstOrThrow({
    where: { lancamento: { observacoes: MARCA } },
    include: { lancamento: { include: { categoria: true } } },
  })
  checar('abastecimento gerou título financeiro', abast.lancamentoId !== null)
  checar('título ficou apropriado à viagem', abast.lancamento?.viagemId === viagem.id)
  checar('título ficou apropriado ao veículo', abast.lancamento?.veiculoId === viagem.veiculoId)
  checar('valor do título bate com o abastecimento', Number(abast.lancamento?.valor) === valorTotal)
  checar(
    'preço do litro calculado',
    Number(abast.valorLitro) === arredondar(valorTotal / litros),
    `R$ ${Number(abast.valorLitro)}/l`,
  )

  // --- Despesa de viagem ----------------------------------------------------
  await prisma.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: pedagio.id,
      descricao: `Pedágio BR-070 ${MARCA}`,
      valor: new Prisma.Decimal(186.4),
      dataCompetencia: viagem.dataSaida,
      dataVencimento: viagem.dataSaida,
      veiculoId: viagem.veiculoId,
      viagemId: viagem.id,
      formaPagamento: 'DINHEIRO',
    },
  })

  // --- Manutenção parcelada -------------------------------------------------
  // 1.000,00 em 3x não divide exato: 333,33 × 3 = 999,99. A última parcela
  // precisa absorver o centavo.
  const total = 1000
  const parcelas = 3
  const valorParcela = arredondar(total / parcelas)
  const residuo = arredondar(total - valorParcela * parcelas)

  const manut = await prisma.manutencao.create({
    data: {
      veiculoId: viagem.veiculoId,
      data: viagem.dataSaida,
      tipo: 'CORRETIVA',
      descricao: `Troca de embreagem ${MARCA}`,
      valorPecas: new Prisma.Decimal(600),
      valorServico: new Prisma.Decimal(400),
    },
  })
  for (let i = 0; i < parcelas; i++) {
    const venc = new Date(viagem.dataSaida)
    venc.setMonth(venc.getMonth() + i)
    await prisma.lancamento.create({
      data: {
        tipo: 'DESPESA',
        categoriaId: manutencaoCat.id,
        descricao: `Troca de embreagem ${MARCA} (${i + 1}/${parcelas})`,
        valor: new Prisma.Decimal(i === parcelas - 1 ? arredondar(valorParcela + residuo) : valorParcela),
        dataCompetencia: viagem.dataSaida,
        dataVencimento: venc,
        veiculoId: viagem.veiculoId,
        formaPagamento: 'CARTAO',
        parcelamentoId: manut.id,
        parcelaNumero: i + 1,
        parcelaTotal: parcelas,
      },
    })
  }

  const doParcelamento = await prisma.lancamento.findMany({
    where: { parcelamentoId: manut.id },
    orderBy: { parcelaNumero: 'asc' },
  })
  const somaParcelas = arredondar(doParcelamento.reduce((s, l) => s + Number(l.valor), 0))
  checar('parcelamento gerou 3 títulos', doParcelamento.length === 3)
  checar(
    'soma das parcelas fecha com o total, sem perder centavo',
    somaParcelas === total,
    `R$ ${somaParcelas} (parcelas de ${doParcelamento.map((l) => Number(l.valor)).join(', ')})`,
  )
  const vencimentos = doParcelamento.map((l) => l.dataVencimento!.getUTCMonth())
  checar('vencimentos são mensais', new Set(vencimentos).size === 3)
  checar(
    'manutenção não é apropriada a viagem, e sim ao veículo',
    doParcelamento.every((l) => l.viagemId === null && l.veiculoId === viagem.veiculoId),
  )

  // --- Margem de contribuição da viagem ------------------------------------
  const daViagem = await prisma.viagem.findUniqueOrThrow({
    where: { id: viagem.id },
    include: {
      fretes: true,
      motorista: true,
      lancamentos: { where: { tipo: 'DESPESA' } },
      abastecimentos: true,
    },
  })

  const receita = daViagem.fretes.reduce((s, f) => s + Number(f.valorFreteReal), 0)
  const custosLancados = daViagem.lancamentos.reduce((s, l) => s + Number(l.valor), 0)
  const comissao = daViagem.fretes.reduce(
    (s, f) =>
      s +
      calcularComissaoMotorista(
        Number(f.valorFreteReal),
        Number(f.valorCte),
        Number(daViagem.motorista.percentualComissao),
        daViagem.motorista.baseComissao,
      ),
    0,
  )
  const margem = arredondar(receita - custosLancados - comissao)

  checar(
    'só diesel e pedágio entram no custo da viagem, manutenção não',
    arredondar(custosLancados) === arredondar(valorTotal + 186.4),
    `R$ ${arredondar(custosLancados)}`,
  )
  checar(
    'margem de contribuição fecha',
    margem === arredondar(receita - valorTotal - 186.4 - comissao),
    `receita ${receita} − custos ${arredondar(custosLancados)} − comissão ${arredondar(comissao)} = ${margem}`,
  )

  const litrosViagem = daViagem.abastecimentos.reduce((s, a) => s + Number(a.litros), 0)
  const kmRodado = (daViagem.kmFinal ?? 0) - daViagem.kmInicial
  const consumo = calcularConsumo(daViagem.kmInicial, daViagem.kmFinal ?? 0, litrosViagem)
  checar(
    'consumo da viagem calculado',
    consumo !== null && consumo > 0,
    `${kmRodado} km / ${litrosViagem} l = ${consumo?.toFixed(2)} km/l`,
  )

  console.log(falhas === 0 ? '\nCustos verificados.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
