/**
 * Verifica o acerto de motorista e de agregado contra o banco.
 *
 * A asserção que sustenta a fatia inteira é uma só: **fechar um acerto não pode
 * mudar o resultado do período**. A comissão do motorista já entrou no custo no
 * dia de cada frete; se o título do acerto entrasse de novo, o lucro do mês
 * cairia por um custo que já estava lá — e o erro só apareceria no fechamento,
 * quando ninguém mais lembra do que mudou.
 *
 * Do lado do agregado, a asserção gêmea: fechar não cria título nenhum. Os
 * títulos já nasceram com o CT-e, e criar outro duplicaria o dinheiro.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import {
  calcularAcertoAgregado,
  calcularAcertoMotorista,
  fecharAcertoAgregado,
  fecharAcertoMotorista,
} from '../src/lib/acertos'
import { calcularResultado } from '../src/lib/resultado'
import { gerarTitulosDoFrete, baixarTitulo } from '../src/lib/titulos'
import { arredondar, calcularCobrancaAgregado } from '../src/lib/calculos'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const MARCA = 'teste-acertos'
const INICIO = new Date('2026-11-01')
const FIM = new Date('2026-11-30')

async function limpar() {
  const fretes = await prisma.frete.findMany({
    where: { observacoes: MARCA },
    select: { id: true },
  })
  const ids = fretes.map((f) => f.id)
  await prisma.baixa.deleteMany({ where: { lancamento: { freteId: { in: ids } } } })
  await prisma.baixa.deleteMany({ where: { lancamento: { descricao: { contains: MARCA } } } })
  await prisma.lancamento.updateMany({ where: { freteId: { in: ids } }, data: { acertoId: null } })
  await prisma.frete.updateMany({ where: { id: { in: ids } }, data: { acertoMotoristaId: null } })
  await prisma.acerto.deleteMany({ where: { observacoes: MARCA } })
  await prisma.lancamento.deleteMany({ where: { freteId: { in: ids } } })
  await prisma.lancamento.deleteMany({ where: { descricao: { contains: MARCA } } })
  await prisma.frete.deleteMany({ where: { id: { in: ids } } })
  await prisma.viagem.deleteMany({ where: { observacoes: MARCA } })
}

async function main() {
  await limpar()

  const veiculo = await prisma.veiculo.findFirstOrThrow({ where: { tipo: { not: 'CARRETA' } } })
  const motorista = await prisma.motorista.findFirstOrThrow({
    where: { modeloRemuneracao: 'HIBRIDO' },
  })
  const cliente = await prisma.cliente.upsert({
    where: { cnpj: '77666555000144' },
    update: { prazoPagamentoDias: 30 },
    create: { razaoSocial: `Pecuarista ${MARCA}`, cnpj: '77666555000144', prazoPagamentoDias: 30 },
  })
  const agregado = await prisma.proprietario.findFirstOrThrow()
  const regra = agregado.regraCobranca as { percentualCte: number; percentualSeguroCarga: number }

  // --- 1. Dois fretes próprios num mês ------------------------------------
  const viagem = await prisma.viagem.create({
    data: {
      veiculoId: veiculo.id,
      motoristaId: motorista.id,
      dataSaida: new Date('2026-11-05'),
      dataChegada: new Date('2026-11-06'),
      kmInicial: 500_000,
      kmFinal: 500_800,
      origem: 'Santo Antônio do Leverger',
      destino: 'Paranatinga',
      status: 'FECHADA',
      observacoes: MARCA,
    },
  })

  for (const [cte, real, n] of [
    [5970, 9564, '9001'],
    [4000, 4000, '9002'],
  ] as const) {
    const frete = await prisma.frete.create({
      data: {
        viagemId: viagem.id,
        clienteId: cliente.id,
        modalidade: 'FROTA_PROPRIA',
        origem: 'Santo Antônio do Leverger',
        destino: 'Paranatinga',
        numeroCte: n,
        valorCte: cte,
        valorFreteReal: real,
        dataEmissao: new Date('2026-11-05'),
        observacoes: MARCA,
      },
    })
    await prisma.$transaction((tx) => gerarTitulosDoFrete(tx, frete.id))
  }

  const calc = await calcularAcertoMotorista(motorista.id, INICIO, FIM)
  const esperada = arredondar((9564 + 4000) * (Number(motorista.percentualComissao) / 100))
  checar('acerto do motorista pega os dois fretes do período', calc.fretes.length === 2)
  checar(
    'comissão incide sobre o frete real, não sobre o CT-e',
    calc.comissaoTotal === esperada,
    `R$ ${calc.comissaoTotal} (sobre CT-e seria R$ ${arredondar((5970 + 4000) * 0.12)})`,
  )
  checar(
    'híbrido soma o salário do mês ao comissionamento',
    calc.salario === Number(motorista.salarioFixo) &&
      calc.bruto === arredondar(calc.salario + calc.comissaoTotal),
    `salário ${calc.salario} + comissão ${calc.comissaoTotal} = ${calc.bruto}`,
  )

  // --- 2. A invariante: fechar não mexe no resultado -----------------------
  const antes = await calcularResultado(INICIO, FIM)
  const fechado = await prisma.$transaction((tx) =>
    fecharAcertoMotorista(tx, {
      motoristaId: motorista.id,
      inicio: INICIO,
      fim: FIM,
      calculado: calc,
      adiantamentos: 500,
      descontos: 0,
      dataPagamento: new Date('2026-12-05'),
      observacoes: MARCA,
    }),
  )
  const depois = await calcularResultado(INICIO, FIM)

  checar(
    'adiantamento é abatido do líquido',
    fechado.liquido === arredondar(calc.bruto - 500),
    `bruto ${calc.bruto} − 500 = ${fechado.liquido}`,
  )
  checar(
    'FECHAR O ACERTO NÃO MUDA O LUCRO OPERACIONAL',
    antes.lucroOperacional === depois.lucroOperacional,
    `antes ${antes.lucroOperacional} / depois ${depois.lucroOperacional}`,
  )
  checar(
    'nem o custo direto da frota própria',
    antes.propria.custoDireto === depois.propria.custoDireto,
    `${antes.propria.custoDireto} = ${depois.propria.custoDireto}`,
  )
  checar(
    'nem a margem de contribuição',
    antes.propria.margemContribuicao === depois.propria.margemContribuicao,
  )

  const titulo = await prisma.lancamento.findUniqueOrThrow({
    where: { id: fechado.lancamentoId },
    include: { categoria: true },
  })
  checar(
    'o título do acerto é uma conta a pagar de verdade',
    titulo.tipo === 'DESPESA' && titulo.status === 'ABERTO' && Number(titulo.valor) === fechado.liquido,
  )
  checar(
    'e nasce no nível LIQUIDACAO, que o DRE não lê',
    titulo.categoria.nivelCusto === 'LIQUIDACAO',
    titulo.categoria.nome,
  )
  checar('o título aponta para o motorista', titulo.motoristaId === motorista.id)

  // --- 3. Não paga duas vezes ---------------------------------------------
  const segunda = await calcularAcertoMotorista(motorista.id, INICIO, FIM)
  checar(
    'os fretes acertados somem do próximo acerto',
    segunda.fretes.length === 0 && segunda.comissaoTotal === 0,
  )
  let recusou = false
  try {
    await prisma.$transaction((tx) =>
      fecharAcertoMotorista(tx, {
        motoristaId: motorista.id,
        inicio: INICIO,
        fim: FIM,
        calculado: { ...segunda, salario: 0, bruto: 0 },
        adiantamentos: 0,
        descontos: 0,
        dataPagamento: new Date('2026-12-05'),
      }),
    )
  } catch {
    recusou = true
  }
  checar('e fechar um acerto vazio é recusado', recusou)

  let recusouNegativo = false
  try {
    await prisma.$transaction((tx) =>
      fecharAcertoMotorista(tx, {
        motoristaId: motorista.id,
        inicio: INICIO,
        fim: FIM,
        calculado: { ...segunda, salario: 1000, bruto: 1000 },
        adiantamentos: 5000,
        descontos: 0,
        dataPagamento: new Date('2026-12-05'),
      }),
    )
  } catch {
    recusouNegativo = true
  }
  checar('desconto maior que o acerto é recusado, não vira número negativo', recusouNegativo)

  // --- 4. Agregado ---------------------------------------------------------
  const fretesAgregado: string[] = []
  for (const [cte, carga, n] of [
    [1700, 81000, '9101'],
    [1220, 36000, '9102'],
    [832, 71400, '9103'],
  ] as const) {
    const cobranca = calcularCobrancaAgregado(cte, carga, regra)
    const f = await prisma.frete.create({
      data: {
        clienteId: cliente.id,
        proprietarioId: agregado.id,
        modalidade: 'AGREGADO',
        fluxoFinanceiro: 'INTERMEDIADO',
        origem: 'Nova Mutum',
        destino: 'Várzea Grande',
        numeroCte: n,
        valorCte: cte,
        valorFreteReal: cte,
        valorCargaNfe: carga,
        valorComissaoAgregado: new Prisma.Decimal(cobranca.comissao),
        valorSeguroAgregado: new Prisma.Decimal(cobranca.seguro),
        dataEmissao: new Date('2026-11-10'),
        observacoes: MARCA,
      },
    })
    await prisma.$transaction((tx) => gerarTitulosDoFrete(tx, f.id))
    fretesAgregado.push(f.id)
  }

  const aberto = await calcularAcertoAgregado(agregado.id)
  const meus = aberto.titulos.filter((t) => fretesAgregado.includes(t.freteId ?? ''))
  checar('os três repasses do agregado aparecem em aberto', meus.length === 3)
  checar(
    'e vêm marcados como "cliente ainda não pagou"',
    meus.every((t) => !t.clientePagou),
    'a regra da casa é acertar quando o cliente paga',
  )

  const somaCte = 1700 + 1220 + 832
  const somaCarga = 81000 + 36000 + 71400
  const comissaoEsperada = arredondar(somaCte * (regra.percentualCte / 100))
  const seguroEsperado = arredondar(somaCarga * (regra.percentualSeguroCarga / 100))
  checar(
    'a comissão dos três CT-e bate com a regra do agregado',
    arredondar(meus.reduce((s, t) => s + t.comissao, 0)) === comissaoEsperada,
    `R$ ${comissaoEsperada} sobre R$ ${somaCte}`,
  )
  checar(
    'e o seguro bate com o valor da carga',
    arredondar(meus.reduce((s, t) => s + t.seguro, 0)) === seguroEsperado,
    `R$ ${seguroEsperado} sobre R$ ${somaCarga.toLocaleString('pt-BR')}`,
  )
  checar(
    'o repasse é o CT-e menos comissão e seguro',
    arredondar(meus.reduce((s, t) => s + t.valor, 0)) ===
      arredondar(somaCte - comissaoEsperada - seguroEsperado),
  )

  // O cliente paga um dos três: o repasse correspondente ganha vencimento.
  const origem = await prisma.lancamento.findFirstOrThrow({
    where: { freteId: fretesAgregado[0], tipo: 'RECEITA' },
  })
  await prisma.$transaction((tx) =>
    baixarTitulo(tx, origem.id, { data: new Date('2026-11-25'), valor: Number(origem.valor) }),
  )
  const depoisDoPagamento = await calcularAcertoAgregado(agregado.id)
  const pago = depoisDoPagamento.titulos.find((t) => t.freteId === fretesAgregado[0])
  checar('quando o cliente paga, a linha vira "pode acertar"', pago?.clientePagou === true)
  checar('e o repasse ganha vencimento', pago?.dataVencimento !== null)

  // --- 5. Fechar o acerto do agregado --------------------------------------
  const titulosAntes = await prisma.lancamento.count()
  const fechadoAg = await prisma.$transaction((tx) =>
    fecharAcertoAgregado(tx, {
      proprietarioId: agregado.id,
      lancamentoIds: meus.map((t) => t.lancamentoId),
      dataPagamento: new Date('2026-11-26'),
      observacoes: MARCA,
    }),
  )
  const titulosDepois = await prisma.lancamento.count()

  checar(
    'FECHAR O ACERTO DO AGREGADO NÃO CRIA TÍTULO NENHUM',
    titulosAntes === titulosDepois,
    `${titulosAntes} títulos antes e depois`,
  )
  checar('os três títulos ficaram liquidados', fechadoAg.titulos === 3)
  const liquidados = await prisma.lancamento.findMany({
    where: { id: { in: meus.map((t) => t.lancamentoId) } },
    select: { status: true, acertoId: true, dataPagamento: true },
  })
  checar(
    'e cada um aponta para o acerto que o fechou',
    liquidados.every((l) => l.status === 'LIQUIDADO' && l.acertoId === fechadoAg.acertoId),
  )
  checar(
    'com a data em que foi pago',
    liquidados.every((l) => l.dataPagamento?.toISOString().slice(0, 10) === '2026-11-26'),
  )

  const sobrou = await calcularAcertoAgregado(agregado.id)
  checar(
    'o que foi acertado some da lista de abertos',
    !sobrou.titulos.some((t) => fretesAgregado.includes(t.freteId ?? '')),
  )

  let recusouRepetido = false
  try {
    await prisma.$transaction((tx) =>
      fecharAcertoAgregado(tx, {
        proprietarioId: agregado.id,
        lancamentoIds: meus.map((t) => t.lancamentoId),
        dataPagamento: new Date('2026-11-27'),
      }),
    )
  } catch {
    recusouRepetido = true
  }
  checar('acertar de novo os mesmos títulos é recusado', recusouRepetido)

  const acertoAg = await prisma.acerto.findUniqueOrThrow({ where: { id: fechadoAg.acertoId } })
  checar(
    'o acerto guarda a quebra entre comissão e seguro',
    arredondar(Number(acertoAg.valorComissao)) === comissaoEsperada &&
      arredondar(Number(acertoAg.valorSeguro)) === seguroEsperado,
    `comissão ${acertoAg.valorComissao} + seguro ${acertoAg.valorSeguro}`,
  )

  await limpar()
  console.log(falhas === 0 ? '\nAcertos verificados.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
