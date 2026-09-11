/**
 * Verifica as planilhas — abrindo o arquivo gerado, não confiando nele.
 *
 * O erro clássico da exportação é silencioso: o arquivo baixa, o Excel abre, e
 * semanas depois alguém percebe que a coluna de valor está como texto e a soma
 * dá zero. Então aqui o teste monta o xlsx, lê de volta e confere que número é
 * número, que data é data, e que o total bate com o que a tela mostra.
 *
 * A porta — recusar download sem sessão — é conferida no `verificar:auth`, que
 * varre as rotas, e por HTTP no `verificar:navegador`. Aqui não dá: `cookies()`
 * do Next só existe dentro de uma requisição do framework.
 */
import ExcelJS from 'exceljs'
import { PrismaClient, Prisma } from '@prisma/client'
import { montarPlanilhaFinanceiro, montarPlanilhaResultado } from '../src/lib/planilhas'
import { calcularResultado, calcularResultadoPorFrete, limitesDoMes } from '../src/lib/resultado'
import { listarTitulos } from '../src/app/financeiro/consultas'
import { gerarTitulosDoFrete } from '../src/lib/titulos'
import { arredondar } from '../src/lib/calculos'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const MARCA = 'teste-planilha'
const ANO = 2026
const MES = 10

async function limpar() {
  const f = await prisma.frete.findMany({ where: { observacoes: MARCA }, select: { id: true } })
  const ids = f.map((x) => x.id)
  await prisma.baixa.deleteMany({ where: { lancamento: { freteId: { in: ids } } } })
  await prisma.lancamento.deleteMany({ where: { freteId: { in: ids } } })
  await prisma.frete.deleteMany({ where: { id: { in: ids } } })
  await prisma.viagem.deleteMany({ where: { observacoes: MARCA } })
  await prisma.cliente.deleteMany({ where: { cnpj: '88777666000155' } })
}

async function reabrir(livro: ExcelJS.Workbook) {
  const buffer = await livro.xlsx.writeBuffer()
  const lido = new ExcelJS.Workbook()
  await lido.xlsx.load(buffer as ArrayBuffer)
  return lido
}

async function main() {
  await limpar()

  const { inicio, fim } = limitesDoMes(ANO, MES)
  const veiculo = await prisma.veiculo.findFirstOrThrow({ where: { tipo: { not: 'CARRETA' } } })
  const motorista = await prisma.motorista.findFirstOrThrow()
  const cliente = await prisma.cliente.create({
    data: { razaoSocial: `Pecuarista ${MARCA}`, cnpj: '88777666000155', prazoPagamentoDias: 30 },
  })

  const viagem = await prisma.viagem.create({
    data: {
      veiculoId: veiculo.id, motoristaId: motorista.id,
      dataSaida: new Date('2026-10-05'), dataChegada: new Date('2026-10-06'),
      kmInicial: 900_000, kmFinal: 900_700, kmVazio: 300,
      origem: 'Nova Mutum', destino: 'Várzea Grande', status: 'FECHADA', observacoes: MARCA,
    },
  })
  const frete = await prisma.frete.create({
    data: {
      viagemId: viagem.id, clienteId: cliente.id, modalidade: 'FROTA_PROPRIA',
      origem: 'Nova Mutum', destino: 'Várzea Grande', numeroCte: '7001',
      valorCte: new Prisma.Decimal(5970), valorFreteReal: new Prisma.Decimal(9564),
      dataEmissao: new Date('2026-10-05'), observacoes: MARCA,
    },
  })
  await prisma.$transaction((tx) => gerarTitulosDoFrete(tx, frete.id))

  const [naTela, porFrete] = await Promise.all([
    calcularResultado(inicio, fim),
    calcularResultadoPorFrete(inicio, fim),
  ])

  // --- 1. Estrutura --------------------------------------------------------
  const livro = await reabrir(montarPlanilhaResultado(ANO, MES, naTela, porFrete))
  checar(
    'a planilha do resultado tem as três abas',
    livro.worksheets.map((a) => a.name).join(', ') === 'Resultado, Por caminhão, Por frete',
    livro.worksheets.map((a) => a.name).join(', '),
  )

  // --- 2. Número é número --------------------------------------------------
  const cascata = livro.getWorksheet('Resultado')!
  const rotulos: string[] = []
  cascata.eachRow((r) => rotulos.push(String(r.getCell(1).value ?? '').trim()))
  const iLucro = rotulos.indexOf('LUCRO OPERACIONAL')
  checar('a cascata traz o lucro operacional', iLucro >= 0)

  const celulaLucro = cascata.getRow(iLucro + 1).getCell(2)
  checar(
    'e ele é número, não texto',
    typeof celulaLucro.value === 'number',
    `veio como ${typeof celulaLucro.value} — texto que parece dinheiro é o motivo de a soma dar zero`,
  )
  checar(
    'com o mesmo valor que a tela mostra',
    arredondar(Number(celulaLucro.value)) === arredondar(naTela.lucroOperacional),
    `planilha ${celulaLucro.value} / tela ${naTela.lucroOperacional}`,
  )
  checar(
    'formatado como moeda',
    celulaLucro.numFmt?.includes('R$') === true,
    celulaLucro.numFmt ?? 'sem formato',
  )
  checar('e em negrito, porque é a linha de fecho', cascata.getRow(iLucro + 1).font?.bold === true)

  const iCusto = rotulos.indexOf('Custos diretos da viagem')
  checar(
    'custo entra com sinal negativo, para a coluna somar sozinha',
    Number(cascata.getRow(iCusto + 1).getCell(2).value) <= 0,
    String(cascata.getRow(iCusto + 1).getCell(2).value),
  )

  // --- 3. Aba por caminhão -------------------------------------------------
  const porCaminhao = livro.getWorksheet('Por caminhão')!
  checar('cabeçalho em negrito', porCaminhao.getRow(1).font?.bold === true)
  checar('cabeçalho congelado', porCaminhao.views?.[0]?.state === 'frozen')
  checar('com filtro ligado', porCaminhao.autoFilter !== undefined)

  let achouVeiculo = false
  porCaminhao.eachRow((r, i) => {
    if (i > 1 && r.getCell(1).value === veiculo.apelido) {
      achouVeiculo = true
      checar('o caminhão aparece com a receita do frete real', Number(r.getCell(2).value) === 9564)
      checar('km rodado como número inteiro', r.getCell(7).value === 700, String(r.getCell(7).value))
      checar('km vazio também', r.getCell(8).value === 300, String(r.getCell(8).value))
    }
  })
  checar('o caminhão do teste está na aba', achouVeiculo)

  // --- 4. Aba por frete ----------------------------------------------------
  const abaFrete = livro.getWorksheet('Por frete')!
  let achouFrete = false
  let somaResultado = 0
  abaFrete.eachRow((r, i) => {
    if (i === 1) return
    somaResultado += Number(r.getCell(9).value)
    if (String(r.getCell(2).value) === '7001') {
      achouFrete = true
      checar('a data vem como data, não texto', r.getCell(1).value instanceof Date)
      checar('o CT-e como texto, para não perder zero à esquerda', typeof r.getCell(2).value === 'string')
      checar('a receita é o valor real do frete', Number(r.getCell(6).value) === 9564)
    }
  })
  checar('o frete do teste está na aba', achouFrete)
  checar(
    'e a soma dos resultados por frete reconstrói o resultado da frota',
    arredondar(somaResultado) === arredondar(naTela.propria.resultado),
    `planilha ${arredondar(somaResultado)} / frota ${arredondar(naTela.propria.resultado)}`,
  )

  // --- 5. Financeiro -------------------------------------------------------
  const [aPagar, aReceber] = await Promise.all([
    listarTitulos('DESPESA', { apenasAbertos: true }),
    listarTitulos('RECEITA', { apenasAbertos: true }),
  ])
  const livroFin = await reabrir(montarPlanilhaFinanceiro(aPagar.titulos, aReceber.titulos))
  checar(
    'a planilha do financeiro tem as duas abas',
    livroFin.worksheets.map((a) => a.name).join(', ') === 'A pagar, A receber',
    livroFin.worksheets.map((a) => a.name).join(', '),
  )

  const receber = livroFin.getWorksheet('A receber')!
  let achouTitulo = false
  receber.eachRow((r, i) => {
    if (i > 1 && String(r.getCell(4).value).includes('7001')) {
      achouTitulo = true
      checar('o recebível traz valor numérico', typeof r.getCell(7).value === 'number')
      checar('pelo valor real, não pelo do CT-e', Number(r.getCell(7).value) === 9564)
      checar('com vencimento como data', r.getCell(1).value instanceof Date)
      checar('e situação legível', String(r.getCell(10).value) === 'Em aberto', String(r.getCell(10).value))
    }
  })
  checar('o recebível do teste está na planilha', achouTitulo)

  // Título de repasse a agregado nasce sem vencimento: a planilha não pode
  // inventar data, e a situação precisa dizer por quê.
  const semVencimento = aPagar.titulos.filter((t) => t.dataVencimento === null)
  if (semVencimento.length > 0) {
    const pagar = livroFin.getWorksheet('A pagar')!
    let conferido = false
    pagar.eachRow((r, i) => {
      if (i > 1 && r.getCell(1).value === null && !conferido) {
        conferido = true
        checar(
          'repasse sem vencimento fica com a data em branco',
          r.getCell(1).value === null,
        )
        checar(
          'e a situação explica que espera o cliente',
          String(r.getCell(10).value) === 'Espera o cliente pagar',
          String(r.getCell(10).value),
        )
      }
    })
    checar('há pelo menos um título esperando o cliente para conferir', conferido)
  }

  await limpar()
  console.log(falhas === 0 ? '\nPlanilhas verificadas.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
