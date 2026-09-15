/**
 * Verifica a fatia de custos contra o banco: cada custo lançado precisa virar
 * um título financeiro apropriado à viagem e ao veículo, o parcelamento tem de
 * fechar exatamente com o total, e a margem de contribuição da viagem tem de
 * bater com receita menos custos.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { arredondar, calcularComissaoMotorista, calcularConsumo } from '../src/lib/calculos'
import {
  apagarAbastecimento,
  apagarManutencao,
  gravarAbastecimento,
  gravarManutencao,
} from '../src/lib/custos'
import { baixarTitulo } from '../src/lib/titulos'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const MARCA = 'teste-custos'

async function main() {
  await prisma.abastecimento.deleteMany({ where: { OR: [{ lancamento: { observacoes: MARCA } }, { viagem: { observacoes: MARCA } }] } })
  await prisma.lancamento.deleteMany({ where: { observacoes: MARCA } })
  await prisma.lancamento.deleteMany({ where: { descricao: { contains: MARCA } } })
  await prisma.lancamento.deleteMany({ where: { viagem: { observacoes: MARCA } } })
  await prisma.manutencao.deleteMany({ where: { descricao: { contains: MARCA } } })
  await prisma.frete.deleteMany({ where: { viagem: { observacoes: MARCA } } })
  await prisma.viagem.deleteMany({ where: { observacoes: MARCA } })

  /**
   * Viagem própria deste script, em vez da primeira que aparecer no banco.
   *
   * Com `findFirstOrThrow` a margem era calculada sobre o que outro script
   * tivesse deixado na mesma viagem — rodar a suíte inteira em sequência fazia
   * duas asserções falharem, e rodar só este arquivo fazia passar. Teste que
   * depende da ordem de execução não vale como teste.
   */
  const veiculo = await prisma.veiculo.findFirstOrThrow({ where: { tipo: { not: 'CARRETA' } } })
  const motorista = await prisma.motorista.findFirstOrThrow({
    where: { modeloRemuneracao: 'COMISSAO' },
  })
  const clienteDoTeste = await prisma.cliente.upsert({
    where: { cnpj: '11222333000199' },
    update: {},
    create: { razaoSocial: `Frigorífico ${MARCA}`, cnpj: '11222333000199' },
  })

  const viagem = await prisma.viagem.create({
    data: {
      veiculoId: veiculo.id,
      motoristaId: motorista.id,
      dataSaida: new Date('2026-09-02'),
      dataChegada: new Date('2026-09-03'),
      kmInicial: 100_000,
      kmFinal: 100_796,
      origem: 'Nova Mutum',
      destino: 'Várzea Grande',
      status: 'FECHADA',
      observacoes: MARCA,
      fretes: {
        create: {
          clienteId: clienteDoTeste.id,
          modalidade: 'FROTA_PROPRIA',
          origem: 'Nova Mutum',
          destino: 'Várzea Grande',
          valorCte: 5970,
          valorFreteReal: 9564,
          dataEmissao: new Date('2026-09-02'),
        },
      },
    },
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

  // --- Corrigir o custo tem que corrigir o título --------------------------
  // A cliente lançou manutenção com valor errado no primeiro dia de uso e não
  // tinha como voltar atrás. Pior que a linha feia na lista: a conta a pagar e
  // o custo do caminhão ficavam errados junto.
  const apelido = (await prisma.veiculo.findUniqueOrThrow({
    where: { id: viagem.veiculoId },
    select: { apelido: true },
  })).apelido

  const baseManutencao = {
    veiculoId: viagem.veiculoId,
    data: viagem.dataSaida,
    tipo: 'CORRETIVA' as const,
    descricao: `Grade da frente ${MARCA}`,
    formaPagamento: 'PIX' as const,
    dataVencimento: viagem.dataSaida,
  }

  const corrigivel = await prisma.$transaction((tx) =>
    gravarManutencao(tx, {
      categoriaId: manutencaoCat.id,
      apelidoVeiculo: apelido,
      dados: { ...baseManutencao, valorPecas: 350, valorServico: 0, parcelas: 1 },
    }),
  )
  const titulosDe = (id: string) =>
    prisma.lancamento.findMany({
      where: { parcelamentoId: id },
      orderBy: { dataVencimento: 'asc' },
      select: { id: true, valor: true, descricao: true, dataVencimento: true },
    })

  checar(
    'manutenção à vista também carimba o título, para poder achá-lo de volta',
    (await titulosDe(corrigivel)).length === 1,
  )

  await prisma.$transaction((tx) =>
    gravarManutencao(tx, {
      id: corrigivel,
      categoriaId: manutencaoCat.id,
      apelidoVeiculo: apelido,
      dados: { ...baseManutencao, valorPecas: 3500, valorServico: 0, parcelas: 1 },
    }),
  )
  const depoisDaCorrecao = await titulosDe(corrigivel)
  checar(
    'corrigir o valor da manutenção corrige a conta a pagar',
    depoisDaCorrecao.length === 1 && Number(depoisDaCorrecao[0]?.valor) === 3500,
    `${depoisDaCorrecao.length} título(s) de R$ ${Number(depoisDaCorrecao[0]?.valor)}`,
  )
  checar(
    'e a manutenção continua apontando para o título que existe',
    (await prisma.manutencao.findUniqueOrThrow({ where: { id: corrigivel } })).lancamentoId ===
      depoisDaCorrecao[0]?.id,
  )

  // Mudar a quantidade de parcelas é outro conjunto de títulos, não uma edição
  // de valores: é o caso em que remendar parcela a parcela erraria.
  await prisma.$transaction((tx) =>
    gravarManutencao(tx, {
      id: corrigivel,
      categoriaId: manutencaoCat.id,
      apelidoVeiculo: apelido,
      dados: { ...baseManutencao, valorPecas: 3500, valorServico: 0, parcelas: 4 },
    }),
  )
  const emQuatro = await titulosDe(corrigivel)
  checar(
    'à vista vira parcelado e o contas a pagar acompanha',
    emQuatro.length === 4 &&
      arredondar(emQuatro.reduce((s, l) => s + Number(l.valor), 0)) === 3500,
    `${emQuatro.length} parcelas somando R$ ${arredondar(emQuatro.reduce((s, l) => s + Number(l.valor), 0))}`,
  )
  checar(
    'e os vencimentos voltam a ser mensais, sem sobrar parcela antiga',
    new Set(emQuatro.map((l) => l.dataVencimento!.toISOString())).size === 4,
  )

  // --- Linha lançada antes do carimbo --------------------------------------
  // As manutenções que a cliente já lançou têm `parcelamentoId` nulo, porque à
  // vista o campo não era gravado. Se a correção só olhasse o carimbo, essas
  // linhas — justamente as que ela precisa corrigir — ficariam órfãs.
  const antiga = await prisma.manutencao.create({
    data: {
      veiculoId: viagem.veiculoId,
      data: viagem.dataSaida,
      tipo: 'PREVENTIVA',
      descricao: `Pedágio lançado como manutenção ${MARCA}`,
      valorPecas: new Prisma.Decimal(0),
      valorServico: new Prisma.Decimal(65),
    },
    select: { id: true },
  })
  const tituloAntigo = await prisma.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: manutencaoCat.id,
      descricao: `Pedágio lançado como manutenção ${MARCA} — ${apelido}`,
      valor: new Prisma.Decimal(65),
      dataCompetencia: viagem.dataSaida,
      dataVencimento: viagem.dataSaida,
      veiculoId: viagem.veiculoId,
      formaPagamento: 'PIX',
      // Sem parcelamentoId: é exatamente a forma antiga.
    },
    select: { id: true },
  })
  await prisma.manutencao.update({
    where: { id: antiga.id },
    data: { lancamentoId: tituloAntigo.id },
  })

  await prisma.$transaction((tx) =>
    gravarManutencao(tx, {
      id: antiga.id,
      categoriaId: manutencaoCat.id,
      apelidoVeiculo: apelido,
      dados: {
        veiculoId: viagem.veiculoId,
        data: viagem.dataSaida,
        tipo: 'PREVENTIVA',
        descricao: `Pedágio lançado como manutenção ${MARCA}`,
        valorServico: 130,
        formaPagamento: 'PIX',
        dataVencimento: viagem.dataSaida,
        parcelas: 1,
      },
    }),
  )
  const depoisDaAntiga = await titulosDe(antiga.id)
  checar(
    'linha lançada antes do carimbo também se corrige, sem deixar título órfão',
    depoisDaAntiga.length === 1 && Number(depoisDaAntiga[0]?.valor) === 130,
    `${depoisDaAntiga.length} título(s) de R$ ${Number(depoisDaAntiga[0]?.valor)}`,
  )
  checar(
    'e o título velho foi apagado, não duplicado',
    (await prisma.lancamento.count({ where: { id: tituloAntigo.id } })) === 0,
  )

  // --- Excluir leva a conta a pagar junto ----------------------------------
  await prisma.$transaction((tx) => apagarManutencao(tx, antiga.id))
  checar(
    'excluir a manutenção apaga a conta a pagar que ela criou',
    (await prisma.manutencao.count({ where: { id: antiga.id } })) === 0 &&
      (await titulosDe(antiga.id)).length === 0,
  )

  // --- Título com baixa não se refaz ---------------------------------------
  const comBaixa = await titulosDe(corrigivel)
  await baixarTitulo(prisma, comBaixa[0]!.id, { data: viagem.dataSaida, valor: 100 })
  let recusouCorrigir = false
  try {
    await prisma.$transaction((tx) =>
      gravarManutencao(tx, {
        id: corrigivel,
        categoriaId: manutencaoCat.id,
        apelidoVeiculo: apelido,
        dados: { ...baseManutencao, valorPecas: 1, valorServico: 0, parcelas: 1 },
      }),
    )
  } catch (erro) {
    recusouCorrigir = erro instanceof Error && erro.message.includes('Estorne')
  }
  checar('manutenção com parcela paga recusa a correção', recusouCorrigir)
  checar(
    'e as quatro parcelas continuam de pé',
    (await titulosDe(corrigivel)).length === 4,
  )

  let recusouExcluir = false
  try {
    await prisma.$transaction((tx) => apagarManutencao(tx, corrigivel))
  } catch (erro) {
    recusouExcluir = erro instanceof Error && erro.message.includes('Estorne')
  }
  checar('e a exclusão também é recusada', recusouExcluir)

  // --- Abastecimento -------------------------------------------------------
  const veiculoDoTanque = await prisma.veiculo.findUniqueOrThrow({
    where: { id: viagem.veiculoId },
    select: { apelido: true, tipo: true, odometroAtual: true },
  })
  const tanque = await prisma.$transaction((tx) =>
    gravarAbastecimento(tx, {
      categoriaId: combustivel.id,
      veiculo: veiculoDoTanque,
      dados: {
        veiculoId: viagem.veiculoId,
        data: viagem.dataSaida,
        litros: 400,
        valorTotal: 3000,
        valorLitro: 7.5,
        odometro: (veiculoDoTanque.odometroAtual ?? 0) + 500,
        tanqueCheio: true,
        formaPagamento: 'PIX',
        observacoes: MARCA,
      },
    }),
  )
  const tituloDoTanque = async () =>
    (await prisma.abastecimento.findUniqueOrThrow({
      where: { id: tanque },
      include: { lancamento: { select: { id: true, valor: true } } },
    }))

  checar(
    'abastecimento nasce com o título pelo valor pago',
    Number((await tituloDoTanque()).lancamento?.valor) === 3000,
  )

  await prisma.$transaction((tx) =>
    gravarAbastecimento(tx, {
      id: tanque,
      categoriaId: combustivel.id,
      veiculo: veiculoDoTanque,
      dados: {
        veiculoId: viagem.veiculoId,
        data: viagem.dataSaida,
        litros: 300,
        valorTotal: 2250,
        valorLitro: 7.5,
        odometro: (veiculoDoTanque.odometroAtual ?? 0) + 500,
        tanqueCheio: true,
        formaPagamento: 'PIX',
        observacoes: MARCA,
      },
    }),
  )
  const corrigido = await tituloDoTanque()
  checar(
    'corrigir os litros corrige o valor e o título junto',
    Number(corrigido.litros) === 300 && Number(corrigido.lancamento?.valor) === 2250,
    `${Number(corrigido.litros)} l / R$ ${Number(corrigido.lancamento?.valor)}`,
  )
  checar(
    'e não sobra título solto do valor antigo',
    (await prisma.lancamento.count({
      where: { descricao: `Abastecimento — ${apelido}`, valor: new Prisma.Decimal(3000) },
    })) === 0,
  )

  const idDoTitulo = corrigido.lancamento!.id
  await prisma.$transaction((tx) => apagarAbastecimento(tx, tanque))
  checar(
    'excluir o abastecimento apaga a conta a pagar junto',
    (await prisma.abastecimento.count({ where: { id: tanque } })) === 0 &&
      (await prisma.lancamento.count({ where: { id: idDoTitulo } })) === 0,
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
