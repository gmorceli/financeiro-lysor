/**
 * Verifica a exclusão e a restauração de viagem.
 *
 * O que está em jogo aqui é o arrasto. Excluir a viagem é fácil; o difícil é
 * garantir que tudo que ela criou sai junto — o recebível do cliente, a base de
 * comissão do motorista, a receita do mês — e que nada que **não** era dela
 * some no caminho. Um recebível cancelado a mais é uma cobrança perdida; um a
 * menos é uma cobrança viva de um frete que o sistema diz que não existiu.
 *
 * O roteiro monta um mês isolado com uma viagem, dois CT-e e um pedágio, mede
 * o resultado, exclui, mede de novo e restaura — conferindo que o mês volta
 * exatamente ao que era.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { excluirViagemLogicamente, restaurarViagem, resumoParaExclusao } from '../src/lib/viagens'
import { gerarTitulosDoFrete, baixarTitulo } from '../src/lib/titulos'
import { calcularResultado, calcularResultadoPorFrete, limitesDoMes } from '../src/lib/resultado'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const MARCA = 'teste-viagens'
// Mês isolado dos outros roteiros.
const ANO = 2025
const MES = 5

const dia = (n: number) => new Date(Date.UTC(ANO, MES - 1, n))

async function main() {
  const { inicio, fim } = limitesDoMes(ANO, MES)

  await prisma.baixa.deleteMany({
    where: { lancamento: { dataCompetencia: { gte: inicio, lte: fim } } },
  })
  await prisma.lancamento.deleteMany({ where: { dataCompetencia: { gte: inicio, lte: fim } } })
  await prisma.abastecimento.deleteMany({ where: { data: { gte: inicio, lte: fim } } })
  await prisma.frete.deleteMany({ where: { dataEmissao: { gte: inicio, lte: fim } } })
  await prisma.viagem.deleteMany({ where: { dataSaida: { gte: inicio, lte: fim } } })

  const cliente = await prisma.cliente.findFirstOrThrow()
  const veiculo = await prisma.veiculo.findFirstOrThrow({ where: { tipo: 'CAVALO' } })
  const motorista = await prisma.motorista.findFirstOrThrow({
    where: { percentualComissao: { gt: 0 } },
  })
  const catPedagio = await prisma.categoria.findUniqueOrThrow({ where: { nome: 'Pedágio' } })

  // --- Cenário -------------------------------------------------------------
  // Viagem com dois CT-e (R$ 10.000 e R$ 5.000) e R$ 300 de pedágio.
  const viagem = await prisma.viagem.create({
    data: {
      veiculoId: veiculo.id,
      motoristaId: motorista.id,
      dataSaida: dia(10),
      dataChegada: dia(12),
      kmInicial: 200000,
      kmFinal: 201000,
      origem: 'A',
      destino: 'B',
      status: 'AGUARDANDO_ACERTO',
      observacoes: MARCA,
    },
  })

  const fretes: string[] = []
  for (const [numero, valor] of [['5001', 10000], ['5002', 5000]] as const) {
    const frete = await prisma.frete.create({
      data: {
        viagemId: viagem.id,
        clienteId: cliente.id,
        modalidade: 'FROTA_PROPRIA',
        numeroCte: numero,
        origem: 'A',
        destino: 'B',
        valorCte: valor,
        valorFreteReal: valor,
        dataEmissao: dia(10),
        observacoes: MARCA,
      },
      select: { id: true },
    })
    await prisma.$transaction((tx) => gerarTitulosDoFrete(tx, frete.id))
    fretes.push(frete.id)
  }

  const pedagio = await prisma.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: catPedagio.id,
      descricao: `Pedágio ${MARCA}`,
      valor: new Prisma.Decimal(300),
      dataCompetencia: dia(10),
      dataVencimento: dia(20),
      viagemId: viagem.id,
      veiculoId: veiculo.id,
    },
    select: { id: true },
  })

  const antes = await calcularResultado(inicio, fim)
  checar('o mês começa com a receita dos dois CT-e', antes.propria.receita === 15000,
    `R$ ${antes.propria.receita}`)
  const receberAntes = await prisma.lancamento.count({
    where: { freteId: { in: fretes }, tipo: 'RECEITA', status: { not: 'CANCELADO' } },
  })
  checar('e com os recebíveis do cliente em aberto', receberAntes === 2, `${receberAntes}`)

  // --- Resumo da confirmação -----------------------------------------------
  const resumo = await resumoParaExclusao(viagem.id)
  checar('o resumo traz os dois CT-e e o valor', resumo?.fretes.length === 2 && resumo.receita === 15000)
  checar('o resumo traz a despesa da viagem', resumo?.despesas.length === 1 &&
    resumo.despesas[0]?.valor === 300)
  checar('e a placa, para não excluir a viagem da linha de cima',
    resumo?.placa === veiculo.placa, resumo?.placa)

  // --- Exclusão, mantendo a despesa ----------------------------------------
  await prisma.$transaction((tx) =>
    excluirViagemLogicamente(tx, viagem.id, {
      motivo: 'Lançamento duplicado',
      usuario: 'Ana',
      despesas: 'manter',
    }),
  )

  const depois = await calcularResultado(inicio, fim)
  checar('a receita do mês zera', depois.propria.receita === 0, `R$ ${depois.propria.receita}`)
  checar(
    'e com ela a comissão do motorista',
    depois.porVeiculo.every((l) => l.receita === 0),
  )
  const porFrete = await calcularResultadoPorFrete(inicio, fim)
  checar('os fretes somem do relatório por frete', porFrete.length === 0, `${porFrete.length}`)

  const receberDepois = await prisma.lancamento.count({
    where: { freteId: { in: fretes }, tipo: 'RECEITA', status: { not: 'CANCELADO' } },
  })
  checar('os recebíveis do cliente são cancelados', receberDepois === 0, `${receberDepois}`)

  // O pedágio foi pago de verdade. Some da viagem e vira custo do caminhão.
  const pedagioDepois = await prisma.lancamento.findUniqueOrThrow({ where: { id: pedagio.id } })
  checar(
    'a despesa mantida perde a viagem e continua valendo',
    pedagioDepois.viagemId === null && pedagioDepois.status !== 'CANCELADO',
  )
  checar(
    'e reaparece no resultado como custo do caminhão',
    depois.propria.custoDireto === 300,
    `R$ ${depois.propria.custoDireto}`,
  )

  const excluida = await prisma.viagem.findUniqueOrThrow({ where: { id: viagem.id } })
  checar(
    'a viagem guarda quem excluiu e por quê',
    excluida.excluidaEm != null && excluida.excluidaPor === 'Ana' &&
      excluida.motivoExclusao === 'Lançamento duplicado',
  )

  let recusouDeNovo = false
  try {
    await prisma.$transaction((tx) =>
      excluirViagemLogicamente(tx, viagem.id, { motivo: 'x', usuario: 'Ana', despesas: 'manter' }),
    )
  } catch (erro) {
    recusouDeNovo = erro instanceof Error && erro.message.includes('já está excluída')
  }
  checar('excluir duas vezes é recusado', recusouDeNovo)

  // --- Restauração ---------------------------------------------------------
  await prisma.$transaction((tx) => restaurarViagem(tx, viagem.id))

  const restaurado = await calcularResultado(inicio, fim)
  checar(
    'restaurar devolve a receita exatamente como era',
    restaurado.propria.receita === antes.propria.receita,
    `R$ ${restaurado.propria.receita}`,
  )
  checar(
    'e a margem volta ao mesmo número',
    restaurado.propria.margemContribuicao === antes.propria.margemContribuicao,
    `R$ ${restaurado.propria.margemContribuicao} = R$ ${antes.propria.margemContribuicao}`,
  )
  const receberRestaurado = await prisma.lancamento.count({
    where: { freteId: { in: fretes }, tipo: 'RECEITA', status: { not: 'CANCELADO' } },
  })
  checar('os recebíveis do cliente voltam', receberRestaurado === 2, `${receberRestaurado}`)

  // --- Frete cancelado antes da exclusão não ressuscita ---------------------
  await prisma.frete.update({ where: { id: fretes[1]! }, data: { status: 'CANCELADO' } })
  await prisma.$transaction((tx) =>
    excluirViagemLogicamente(tx, viagem.id, {
      motivo: 'CT-e cancelado',
      usuario: 'Ana',
      despesas: 'manter',
    }),
  )
  await prisma.$transaction((tx) => restaurarViagem(tx, viagem.id))
  const oCancelado = await prisma.frete.findUniqueOrThrow({ where: { id: fretes[1]! } })
  checar(
    'o CT-e que já estava cancelado continua cancelado depois de restaurar',
    oCancelado.status === 'CANCELADO' && oCancelado.canceladoComViagem === false,
    oCancelado.status,
  )
  const oVivo = await prisma.frete.findUniqueOrThrow({ where: { id: fretes[0]! } })
  checar('e o outro volta a valer', oVivo.status !== 'CANCELADO', oVivo.status)

  // --- Recebimento baixado é estornado -------------------------------------
  const titulo = await prisma.lancamento.findFirstOrThrow({
    where: { freteId: fretes[0]!, tipo: 'RECEITA', status: { not: 'CANCELADO' } },
  })
  await prisma.$transaction((tx) => baixarTitulo(tx, titulo.id, { data: dia(25), valor: 4000 }))
  await prisma.$transaction((tx) =>
    excluirViagemLogicamente(tx, viagem.id, {
      motivo: 'Dados lançados errados',
      usuario: 'Ana',
      despesas: 'manter',
    }),
  )
  const estornado = await prisma.lancamento.findUniqueOrThrow({ where: { id: titulo.id } })
  const baixas = await prisma.baixa.count({ where: { lancamentoId: titulo.id } })
  checar(
    'o recebimento baixado é estornado junto com a viagem',
    Number(estornado.valorPago) === 0 && baixas === 0 && estornado.status === 'CANCELADO',
    `pago R$ ${estornado.valorPago}, ${baixas} baixa(s), ${estornado.status}`,
  )
  await prisma.$transaction((tx) => restaurarViagem(tx, viagem.id))

  // --- Comissão já paga trava a exclusão -----------------------------------
  const acerto = await prisma.acerto.create({
    data: {
      tipo: 'MOTORISTA',
      motoristaId: motorista.id,
      periodoInicio: inicio,
      periodoFim: fim,
      valorBruto: new Prisma.Decimal(1200),
      valorLiquido: new Prisma.Decimal(1200),
      observacoes: MARCA,
    },
    select: { id: true },
  })
  await prisma.frete.update({
    where: { id: fretes[0]! },
    data: { acertoMotoristaId: acerto.id },
  })

  let travou = false
  try {
    await prisma.$transaction((tx) =>
      excluirViagemLogicamente(tx, viagem.id, {
        motivo: 'Lançamento duplicado',
        usuario: 'Ana',
        despesas: 'manter',
      }),
    )
  } catch (erro) {
    travou = erro instanceof Error && erro.message.includes('acerto de motorista')
  }
  checar('viagem com comissão já paga num acerto não exclui', travou)
  checar(
    'e a viagem continua de pé',
    (await prisma.viagem.findUniqueOrThrow({ where: { id: viagem.id } })).excluidaEm === null,
  )

  await prisma.frete.update({ where: { id: fretes[0]! }, data: { acertoMotoristaId: null } })
  await prisma.acerto.delete({ where: { id: acerto.id } })

  // --- Excluir as despesas junto -------------------------------------------
  // O pedágio original já saiu da viagem na primeira exclusão ("manter"), e
  // restaurar não o devolve — devolver contaria o mesmo pedágio duas vezes.
  // Então o cenário precisa de um custo novo, lançado na viagem restaurada.
  const chapa = await prisma.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: catPedagio.id,
      descricao: `Chapa ${MARCA}`,
      valor: new Prisma.Decimal(500),
      dataCompetencia: dia(11),
      dataVencimento: dia(21),
      viagemId: viagem.id,
      veiculoId: veiculo.id,
    },
    select: { id: true },
  })

  await prisma.$transaction((tx) =>
    excluirViagemLogicamente(tx, viagem.id, {
      motivo: 'Lançamento duplicado',
      usuario: 'Ana',
      despesas: 'excluir',
    }),
  )
  const chapaApagada = await prisma.lancamento.findUniqueOrThrow({ where: { id: chapa.id } })
  checar(
    'escolhendo "excluir junto", a despesa é cancelada',
    chapaApagada.status === 'CANCELADO',
    chapaApagada.status,
  )
  const zerado = await calcularResultado(inicio, fim)
  // Sobra só o pedágio que a primeira exclusão mandou para o caminhão. Sem
  // viagem no mês, ele cai no balde de "custo sem dono de frete" — e continua
  // no resultado, que é o ponto: o dinheiro saiu.
  checar(
    'e sobra no mês só o custo que já tinha virado do caminhão antes',
    zerado.custoDiretoSemViagem === 300 && zerado.propria.custoDireto === 300,
    `custo direto R$ ${zerado.propria.custoDireto}, balde R$ ${zerado.custoDiretoSemViagem}`,
  )

  console.log(falhas === 0 ? '\nViagens verificadas.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
