/**
 * Verifica o motor de resultado com um cenário construído para ter resposta
 * conhecida de antemão.
 *
 * Um caminhão, um mês, dois fretes na mesma viagem — um valendo o dobro do
 * outro, para o rateio proporcional ter o que provar. Mais um frete de
 * agregado, que não pode carregar custo de frota nenhum.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { calcularResultado, calcularResultadoPorFrete, limitesDoMes } from '../src/lib/resultado'
import { arredondar } from '../src/lib/calculos'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const MARCA = 'teste-resultado'
// Um mês isolado, sem os dados dos outros roteiros de verificação.
const ANO = 2025
const MES = 3

async function main() {
  const { inicio, fim } = limitesDoMes(ANO, MES)

  // Limpeza do que roteiros anteriores possam ter deixado neste mês.
  await prisma.baixa.deleteMany({ where: { lancamento: { dataCompetencia: { gte: inicio, lte: fim } } } })
  await prisma.lancamento.deleteMany({ where: { dataCompetencia: { gte: inicio, lte: fim } } })
  await prisma.abastecimento.deleteMany({ where: { data: { gte: inicio, lte: fim } } })
  await prisma.frete.deleteMany({ where: { dataEmissao: { gte: inicio, lte: fim } } })
  await prisma.viagem.deleteMany({ where: { dataSaida: { gte: inicio, lte: fim } } })

  const cliente = await prisma.cliente.findFirstOrThrow()
  const agregado = await prisma.proprietario.findFirstOrThrow()
  const veiculo = await prisma.veiculo.findFirstOrThrow({ where: { tipo: 'CAVALO' } })
  const motorista = await prisma.motorista.findFirstOrThrow({
    where: { percentualComissao: { gt: 0 } },
  })
  const cat = async (nome: string) =>
    (await prisma.categoria.findUniqueOrThrow({ where: { nome } })).id

  // --- Cenário --------------------------------------------------------------
  // Viagem de 1.000 km (600 carregado, 400 vazio) com dois fretes:
  // R$ 10.000 e R$ 5.000. Custos diretos: R$ 3.000 de diesel + R$ 300 de
  // pedágio. Comissão de 12% sobre R$ 15.000 = R$ 1.800.
  // Custo do veículo no mês: R$ 5.000 de manutenção.
  // Overhead do mês: R$ 2.000.
  const viagem = await prisma.viagem.create({
    data: {
      veiculoId: veiculo.id,
      motoristaId: motorista.id,
      dataSaida: new Date(Date.UTC(ANO, MES - 1, 10)),
      dataChegada: new Date(Date.UTC(ANO, MES - 1, 12)),
      kmInicial: 100000,
      kmFinal: 101000,
      kmCarregado: 600,
      kmVazio: 400,
      origem: 'A',
      destino: 'B',
      status: 'AGUARDANDO_ACERTO',
      observacoes: MARCA,
    },
  })

  for (const [numero, valor] of [['1001', 10000], ['1002', 5000]] as const) {
    await prisma.frete.create({
      data: {
        viagemId: viagem.id,
        clienteId: cliente.id,
        modalidade: 'FROTA_PROPRIA',
        numeroCte: numero,
        origem: 'A',
        destino: 'B',
        valorCte: valor,
        valorFreteReal: valor,
        dataEmissao: new Date(Date.UTC(ANO, MES - 1, 10)),
        observacoes: MARCA,
      },
    })
  }

  const diretos = [
    { nome: 'Combustível', valor: 3000 },
    { nome: 'Pedágio', valor: 300 },
  ]
  for (const d of diretos) {
    await prisma.lancamento.create({
      data: {
        tipo: 'DESPESA',
        categoriaId: await cat(d.nome),
        descricao: `${d.nome} ${MARCA}`,
        valor: new Prisma.Decimal(d.valor),
        dataCompetencia: new Date(Date.UTC(ANO, MES - 1, 10)),
        dataVencimento: new Date(Date.UTC(ANO, MES - 1, 20)),
        viagemId: viagem.id,
        veiculoId: veiculo.id,
      },
    })
  }
  await prisma.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: await cat('Manutenção'),
      descricao: `Manutenção ${MARCA}`,
      valor: new Prisma.Decimal(5000),
      dataCompetencia: new Date(Date.UTC(ANO, MES - 1, 15)),
      dataVencimento: new Date(Date.UTC(ANO, MES - 1, 25)),
      veiculoId: veiculo.id,
    },
  })
  await prisma.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: await cat('Contador'),
      descricao: `Contador ${MARCA}`,
      valor: new Prisma.Decimal(2000),
      dataCompetencia: new Date(Date.UTC(ANO, MES - 1, 5)),
      dataVencimento: new Date(Date.UTC(ANO, MES - 1, 10)),
    },
  })
  await prisma.abastecimento.create({
    data: {
      veiculoId: veiculo.id,
      // Sem viagem: o abastecimento é do caminhão. Os litros do mês entram no
      // km/l do veículo pela data, não pelo vínculo com a viagem.
      data: new Date(Date.UTC(ANO, MES - 1, 10)),
      litros: new Prisma.Decimal(400),
      valorLitro: new Prisma.Decimal(7.5),
      valorTotal: new Prisma.Decimal(3000),
      odometro: 100500,
      tanqueCheio: true,
    },
  })
  await prisma.frete.create({
    data: {
      clienteId: cliente.id,
      proprietarioId: agregado.id,
      modalidade: 'AGREGADO',
      fluxoFinanceiro: 'INTERMEDIADO',
      origem: 'C',
      destino: 'D',
      valorCte: 8000,
      valorFreteReal: 8000,
      valorCargaNfe: 400000,
      valorComissaoAgregado: 800,
      valorSeguroAgregado: 240,
      dataEmissao: new Date(Date.UTC(ANO, MES - 1, 18)),
      observacoes: MARCA,
    },
  })

  // --- Conferência do resultado do mês -------------------------------------
  const r = await calcularResultado(inicio, fim)

  checar('receita da frota própria', r.propria.receita === 15000, `R$ ${r.propria.receita}`)
  checar(
    'custo direto = diesel + pedágio + comissão de 12%',
    r.propria.custoDireto === 5100,
    `R$ ${r.propria.custoDireto} (3.000 + 300 + 1.800)`,
  )
  checar(
    'margem de contribuição',
    r.propria.margemContribuicao === 9900,
    `R$ ${r.propria.margemContribuicao}`,
  )
  checar('custo do caminhão', r.propria.custoVeiculo === 5000, `R$ ${r.propria.custoVeiculo}`)
  checar('resultado da frota', r.propria.resultado === 4900, `R$ ${r.propria.resultado}`)
  checar(
    'manutenção NÃO entrou no custo direto',
    r.propria.custoDireto === 5100 && r.propria.custoVeiculo === 5000,
  )
  checar(
    'receita de agregado é comissão + seguro',
    r.agregado.receita === 1040,
    `R$ ${r.agregado.receita} (o CT-e é 8.000)`,
  )
  checar('overhead do mês', r.overhead === 2000, `R$ ${r.overhead}`)
  checar(
    'lucro operacional = frota + agregado − overhead',
    r.lucroOperacional === 3940,
    `R$ ${r.lucroOperacional} (4.900 + 1.040 − 2.000)`,
  )

  checar('km rodado', r.propria.kmRodado === 1000)
  checar('km vazio e percentual', r.propria.kmVazio === 400 && r.propria.percentualVazio === 40)
  checar('consumo do mês', r.propria.consumo === 2.5, `${r.propria.consumo} km/l`)

  const linhaVeiculo = r.porVeiculo[0]
  checar(
    'resultado por caminhão bate com o consolidado',
    linhaVeiculo?.resultado === 4900 && linhaVeiculo.receita === 15000,
  )
  checar(
    'R$/km e custo/km por caminhão',
    linhaVeiculo?.receitaPorKm === 15 && linhaVeiculo.custoPorKm === 10.1,
    `R$ ${linhaVeiculo?.receitaPorKm}/km de receita, R$ ${linhaVeiculo?.custoPorKm}/km de custo`,
  )

  // --- Conferência do rateio por frete -------------------------------------
  const porFrete = await calcularResultadoPorFrete(inicio, fim)
  const f1 = porFrete.find((f) => f.numeroCte === '1001')!
  const f2 = porFrete.find((f) => f.numeroCte === '1002')!
  const fAgregado = porFrete.find((f) => f.veiculo === null)!

  checar('três fretes no período', porFrete.length === 3)
  // O diesel ficou de fora deste relatório de propósito: um tanque cheio atende
  // várias viagens, e qualquer critério de divisão seria invenção com cara de
  // número exato. Sobram pedágio (R$ 300) e comissão (R$ 1.800) = R$ 2.100.
  checar(
    'o combustível NÃO entra no rateio por frete',
    arredondar(f1.custoDiretoRateado + f2.custoDiretoRateado) === 2100,
    `R$ ${arredondar(f1.custoDiretoRateado + f2.custoDiretoRateado)} (2.100 = 300 de pedágio + 1.800 de comissão)`,
  )
  checar(
    'pedágio e comissão seguem proporcionais à receita (2/3 e 1/3)',
    f1.custoDiretoRateado === 1400 && f2.custoDiretoRateado === 700,
    `R$ ${f1.custoDiretoRateado} e R$ ${f2.custoDiretoRateado} de R$ 2.100`,
  )
  checar(
    'rateio do custo do caminhão segue a mesma proporção',
    f1.custoVeiculoRateado === 3333.33 && f2.custoVeiculoRateado === 1666.67,
    `R$ ${f1.custoVeiculoRateado} e R$ ${f2.custoVeiculoRateado} de R$ 5.000`,
  )
  checar(
    'a soma dos rateios reconstrói o custo do caminhão',
    arredondar(f1.custoVeiculoRateado + f2.custoVeiculoRateado) === 5000,
  )
  checar(
    'resultado do frete maior, antes do diesel',
    f1.resultado === arredondar(10000 - 1400 - 3333.33),
    `R$ ${f1.resultado}`,
  )
  checar(
    'frete de agregado não carrega custo de frota',
    fAgregado.custoDiretoRateado === 0 && fAgregado.custoVeiculoRateado === 0,
  )
  checar(
    'e sua receita é só a comissão e o seguro',
    fAgregado.receita === 1040 && fAgregado.resultado === 1040,
  )
  // A diferença entre as duas telas é exatamente o combustível, e é a única.
  // Se um dia deixar de ser, é porque alguma outra coisa saiu do rateio sem
  // ninguém dizer.
  checar(
    'a soma por frete supera o resultado da frota exatamente pelo diesel',
    arredondar(f1.resultado + f2.resultado) - 3000 === r.propria.resultado,
    `R$ ${arredondar(f1.resultado + f2.resultado)} − 3.000 = R$ ${r.propria.resultado}`,
  )


  // --- Custo direto lançado fora da viagem ---------------------------------
  // O menu Custos grava `viagemId: null`. Antes desta verificação o DRE só lia
  // custo direto pelo `include` da viagem, então R$ 3.000 de diesel entravam no
  // contas a pagar e não mexiam um centavo no lucro do mês. A margem ficava
  // bonita em cima de um custo que existia.
  const lancarSolto = async (valor: number, comVeiculo: boolean) =>
    prisma.lancamento.create({
      data: {
        tipo: 'DESPESA',
        categoriaId: await cat('Combustível'),
        descricao: `Diesel avulso ${MARCA}`,
        valor: new Prisma.Decimal(valor),
        dataCompetencia: new Date(Date.UTC(ANO, MES - 1, 22)),
        dataVencimento: new Date(Date.UTC(ANO, MES - 1, 28)),
        viagemId: null,
        veiculoId: comVeiculo ? veiculo.id : null,
      },
    })

  await lancarSolto(900, true)
  const comSolto = await calcularResultado(inicio, fim)
  checar(
    'diesel lançado pelo menu Custos entra no custo direto do caminhão',
    comSolto.porVeiculo[0]?.custoDireto === 6000,
    `R$ ${comSolto.porVeiculo[0]?.custoDireto} (5.100 + 900)`,
  )
  checar(
    'e derruba a margem no mesmo valor',
    comSolto.propria.margemContribuicao === 9000 && comSolto.lucroOperacional === 3040,
    `margem R$ ${comSolto.propria.margemContribuicao}, lucro R$ ${comSolto.lucroOperacional}`,
  )
  checar(
    'com caminhão conhecido, nada sobra no balde de "sem viagem"',
    comSolto.custoDiretoSemViagem === 0,
    `R$ ${comSolto.custoDiretoSemViagem}`,
  )

  await lancarSolto(100, false)
  const comOrfao = await calcularResultado(inicio, fim)
  checar(
    'custo direto sem viagem e sem caminhão vai para o balde, mas entra no resultado',
    comOrfao.custoDiretoSemViagem === 100 && comOrfao.propria.custoDireto === 6100,
    `balde R$ ${comOrfao.custoDiretoSemViagem}, custo direto R$ ${comOrfao.propria.custoDireto}`,
  )
  checar(
    'e o lucro operacional cai os R$ 100',
    comOrfao.lucroOperacional === 2940,
    `R$ ${comOrfao.lucroOperacional}`,
  )

  const porFreteSolto = await calcularResultadoPorFrete(inicio, fim)
  const s1 = porFreteSolto.find((f) => f.numeroCte === '1001')!
  const s2 = porFreteSolto.find((f) => f.numeroCte === '1002')!
  // O diesel avulso é diesel: não entra aqui nem quando sabe de qual caminhão
  // é. Se entrasse, a tela diria "antes do combustível" e mostraria uma parte
  // dele — o pior dos dois mundos.
  checar(
    'diesel avulso também fica fora do rateio por frete',
    s1.custoDiretoRateado === 1400 && s2.custoDiretoRateado === 700,
    `R$ ${s1.custoDiretoRateado} e R$ ${s2.custoDiretoRateado}, os mesmos de antes do diesel avulso`,
  )
  checar(
    'e a diferença para o resultado da frota é todo o combustível do mês',
    arredondar(s1.resultado + s2.resultado) - 4000 === comOrfao.propria.resultado,
    `R$ ${arredondar(s1.resultado + s2.resultado)} − 4.000 (3.000 na viagem + 900 do caminhão + 100 sem dono) = R$ ${comOrfao.propria.resultado}`,
  )

  // --- Frete cancelado ------------------------------------------------------
  // `excluirFrete` cancela em vez de apagar quando já existe título. CT-e
  // cancelado não vale nada: nem receita, nem base de comissão.
  await prisma.frete.updateMany({
    where: { numeroCte: '1002', observacoes: MARCA },
    data: { status: 'CANCELADO' },
  })
  const semCancelado = await calcularResultado(inicio, fim)
  checar(
    'frete cancelado sai da receita',
    semCancelado.propria.receita === 10000,
    `R$ ${semCancelado.propria.receita}`,
  )
  checar(
    'e sai também da base da comissão do motorista',
    semCancelado.porVeiculo[0]?.custoDireto === 5400,
    `R$ ${semCancelado.porVeiculo[0]?.custoDireto} (3.000 + 300 + 900 + 12% de 10.000)`,
  )
  checar(
    'e some da lista por frete',
    (await calcularResultadoPorFrete(inicio, fim)).every((f) => f.numeroCte !== '1002'),
  )

  console.log(falhas === 0 ? '\nResultado verificado.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
