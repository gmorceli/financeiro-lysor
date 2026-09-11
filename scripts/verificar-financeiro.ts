/**
 * Verifica a fatia financeira contra o banco.
 *
 * O que mais importa aqui é o gatilho AO_RECEBER: no frete de agregado
 * intermediado, o repasse não pode ganhar vencimento antes do cliente pagar.
 * É assim que a cliente trabalha, e é o que impede o fluxo de caixa de
 * projetar uma saída sem lastro.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { gerarTitulosDoFrete, baixarTitulo } from '../src/lib/titulos'
import { arredondar, calcularCobrancaAgregado } from '../src/lib/calculos'
import { listarTitulos, resumoFinanceiro } from '../src/app/financeiro/consultas'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const MARCA = 'teste-financeiro'

async function main() {
  await prisma.baixa.deleteMany({ where: { lancamento: { descricao: { contains: MARCA } } } })
  await prisma.lancamento.deleteMany({ where: { frete: { observacoes: MARCA } } })
  await prisma.frete.deleteMany({ where: { observacoes: MARCA } })

  const cliente = await prisma.cliente.upsert({
    where: { cnpj: '99888777000166' },
    update: { prazoPagamentoDias: 15 },
    create: { razaoSocial: `Frigorífico ${MARCA}`, cnpj: '99888777000166', prazoPagamentoDias: 15 },
  })
  const agregado = await prisma.proprietario.findFirstOrThrow()
  const viagem = await prisma.viagem.findFirstOrThrow()

  // --- 1. Frete próprio gera um recebível ----------------------------------
  const frete = await prisma.frete.create({
    data: {
      viagemId: viagem.id,
      clienteId: cliente.id,
      modalidade: 'FROTA_PROPRIA',
      origem: 'Nova Mutum',
      destino: 'Várzea Grande',
      valorCte: 5970,
      valorFreteReal: 9564,
      dataEmissao: new Date('2026-09-01'),
      observacoes: MARCA,
    },
  })
  await prisma.$transaction((tx) => gerarTitulosDoFrete(tx, frete.id))

  const doFretePróprio = await prisma.lancamento.findMany({ where: { freteId: frete.id } })
  checar('frete próprio gera um título só', doFretePróprio.length === 1)
  checar('título é receita contra o cliente', doFretePróprio[0]?.tipo === 'RECEITA' && doFretePróprio[0]?.clienteId === cliente.id)
  checar(
    'valor do recebível é o frete real, não o CT-e',
    Number(doFretePróprio[0]?.valor) === 9564,
    `R$ ${Number(doFretePróprio[0]?.valor)} (CT-e é 5.970)`,
  )
  const venc = doFretePróprio[0]?.dataVencimento
  checar(
    'vencimento respeita o prazo do cliente (15 dias)',
    venc?.toISOString().slice(0, 10) === '2026-09-16',
    venc?.toISOString().slice(0, 10),
  )

  // idempotência
  await prisma.$transaction((tx) => gerarTitulosDoFrete(tx, frete.id))
  const depoisDeRepetir = await prisma.lancamento.count({ where: { freteId: frete.id } })
  checar('gerar títulos duas vezes não duplica', depoisDeRepetir === 1)

  // --- 2. Frete de agregado INTERMEDIADO: dois títulos, um com gatilho -----
  const regra = agregado.regraCobranca as { percentualCte?: number; percentualSeguroCarga?: number }
  const cobranca = calcularCobrancaAgregado(11642, 528550, regra)

  const freteAg = await prisma.frete.create({
    data: {
      clienteId: cliente.id,
      proprietarioId: agregado.id,
      modalidade: 'AGREGADO',
      fluxoFinanceiro: 'INTERMEDIADO',
      origem: 'Porto Estrela',
      destino: 'Várzea Grande',
      valorCte: 11642,
      valorFreteReal: 11642,
      valorCargaNfe: 528550,
      valorComissaoAgregado: cobranca.comissao,
      valorSeguroAgregado: cobranca.seguro,
      dataEmissao: new Date('2026-09-01'),
      observacoes: MARCA,
    },
  })
  await prisma.$transaction((tx) => gerarTitulosDoFrete(tx, freteAg.id))

  const doAgregado = await prisma.lancamento.findMany({
    where: { freteId: freteAg.id },
    orderBy: { tipo: 'asc' },
  })
  const receber = doAgregado.find((l) => l.tipo === 'RECEITA')!
  const repassar = doAgregado.find((l) => l.tipo === 'DESPESA')!

  checar('agregado intermediado gera dois títulos', doAgregado.length === 2)
  checar('recebe do cliente o valor cheio do CT-e', Number(receber.valor) === 11642)
  checar(
    'repassa ao agregado o cheio menos comissão e seguro',
    Number(repassar.valor) === arredondar(11642 - cobranca.total),
    `R$ ${Number(repassar.valor)} (11.642 − 1.481,33)`,
  )
  checar('repasse nasce SEM vencimento', repassar.dataVencimento === null)
  checar('repasse tem gatilho AO_RECEBER', repassar.gatilhoVencimento === 'AO_RECEBER')
  checar('repasse aponta para o recebível de origem', repassar.lancamentoOrigemId === receber.id)
  checar(
    'a Lysor fica com a comissão e o seguro',
    arredondar(Number(receber.valor) - Number(repassar.valor)) === cobranca.total,
    `R$ ${cobranca.total}`,
  )

  // --- 3. Baixa parcial ----------------------------------------------------
  await prisma.$transaction((tx) =>
    baixarTitulo(tx, receber.id, { data: new Date('2026-09-16'), valor: 5000 }),
  )
  const parcial = await prisma.lancamento.findUniqueOrThrow({ where: { id: receber.id } })
  const repasseAposParcial = await prisma.lancamento.findUniqueOrThrow({ where: { id: repassar.id } })
  checar('baixa parcial marca o título como PARCIAL', parcial.status === 'PARCIAL')
  checar('baixa parcial não define data de pagamento', parcial.dataPagamento === null)
  checar(
    'repasse continua travado enquanto o cliente não quitou',
    repasseAposParcial.dataVencimento === null,
  )

  // --- 4. Baixa final dispara o gatilho ------------------------------------
  const resultado = await prisma.$transaction((tx) =>
    baixarTitulo(tx, receber.id, { data: new Date('2026-09-20'), valor: 6642 }),
  )
  const quitado = await prisma.lancamento.findUniqueOrThrow({ where: { id: receber.id } })
  const repasseLiberado = await prisma.lancamento.findUniqueOrThrow({ where: { id: repassar.id } })

  checar('título quitado vira LIQUIDADO', quitado.status === 'LIQUIDADO')
  checar('valor pago soma as duas baixas', Number(quitado.valorPago) === 11642)
  checar('data de pagamento é a da última baixa', quitado.dataPagamento?.toISOString().slice(0, 10) === '2026-09-20')
  checar('a baixa relatou o dependente liberado', resultado.dependentesLiberados === 1)
  checar(
    'repasse ao agregado ganhou vencimento na data do recebimento',
    repasseLiberado.dataVencimento?.toISOString().slice(0, 10) === '2026-09-20',
    repasseLiberado.dataVencimento?.toISOString().slice(0, 10),
  )

  const baixas = await prisma.baixa.count({ where: { lancamentoId: receber.id } })
  checar('duas baixas registradas no histórico', baixas === 2)

  // --- 5. Frete de agregado DIRETO: um recebível contra o agregado ---------
  const freteDireto = await prisma.frete.create({
    data: {
      clienteId: cliente.id,
      proprietarioId: agregado.id,
      modalidade: 'AGREGADO',
      fluxoFinanceiro: 'DIRETO',
      origem: 'Santo Antônio do Leverger',
      destino: 'Várzea Grande',
      valorCte: 3000,
      valorFreteReal: 3000,
      valorCargaNfe: 150000,
      valorComissaoAgregado: 300,
      valorSeguroAgregado: 90,
      dataEmissao: new Date('2026-09-02'),
      observacoes: MARCA,
    },
  })
  await prisma.$transaction((tx) => gerarTitulosDoFrete(tx, freteDireto.id))
  const doDireto = await prisma.lancamento.findMany({ where: { freteId: freteDireto.id } })

  checar('agregado direto gera um título só', doDireto.length === 1)
  checar(
    'e é um recebível contra o agregado, não contra o cliente',
    doDireto[0]?.tipo === 'RECEITA' &&
      doDireto[0]?.proprietarioId === agregado.id &&
      doDireto[0]?.clienteId === null,
  )
  checar(
    'no fluxo direto a Lysor só recebe comissão e seguro',
    Number(doDireto[0]?.valor) === 390,
    `R$ ${Number(doDireto[0]?.valor)} (o CT-e é 3.000)`,
  )


  // --- Vencido é saldo, não valor de face ----------------------------------
  // Um título PARCIAL em atraso deve o que falta. O painel somava o valor
  // cheio, então R$ 6.000 já pagos continuavam aparecendo como dívida vencida.
  const antesDoVencido = await resumoFinanceiro()
  const categoriaAvulsa = await prisma.categoria.findFirstOrThrow({
    where: { nivelCusto: 'OVERHEAD' },
    select: { id: true },
  })
  const vencido = await prisma.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: categoriaAvulsa.id,
      descricao: `Vencido parcial ${MARCA}`,
      valor: new Prisma.Decimal(10000),
      dataCompetencia: new Date('2020-01-10'),
      dataVencimento: new Date('2020-01-20'),
    },
    select: { id: true },
  })
  await baixarTitulo(prisma, vencido.id, { data: new Date('2020-02-01'), valor: 6000 })

  const comVencido = await resumoFinanceiro()
  checar(
    'título vencido pela metade entra no painel só pelo saldo',
    arredondar(comVencido.vencidosPagar - antesDoVencido.vencidosPagar) === 4000,
    `subiu R$ ${arredondar(comVencido.vencidosPagar - antesDoVencido.vencidosPagar)}, o título é de R$ 10.000 com R$ 6.000 pagos`,
  )

  // --- Total da tela não pode depender do corte da lista -------------------
  const listaInteira = await listarTitulos('DESPESA', { apenasAbertos: true })
  const listaCortada = await listarTitulos('DESPESA', { apenasAbertos: true, limite: 1 })
  checar(
    'o corte da lista não mexe no total em aberto',
    arredondar(listaCortada.total) === arredondar(listaInteira.total),
    `cortada R$ ${arredondar(listaCortada.total)} / inteira R$ ${arredondar(listaInteira.total)}`,
  )
  checar(
    'e a tela sabe quantos títulos ficaram de fora',
    listaCortada.titulos.length === 1 &&
      listaCortada.naoExibidos === listaCortada.quantidade - 1,
    `${listaCortada.naoExibidos} fora de ${listaCortada.quantidade}`,
  )
  checar(
    'o total bate com a soma dos saldos de todos os títulos',
    arredondar(listaInteira.total) ===
      arredondar(
        listaInteira.titulos.reduce(
          (s, t) => s + (Number(t.valor) - Number(t.valorPago)),
          0,
        ),
      ),
    `R$ ${arredondar(listaInteira.total)}`,
  )

  await prisma.baixa.deleteMany({ where: { lancamentoId: vencido.id } })
  await prisma.lancamento.delete({ where: { id: vencido.id } })

  console.log(falhas === 0 ? '\nFinanceiro verificado.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
