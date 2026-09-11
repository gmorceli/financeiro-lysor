import ExcelJS from 'exceljs'

/**
 * Planilhas para o Excel.
 *
 * Duas decisões que valem explicação:
 *
 * 1. **`.xlsx` de verdade, não CSV.** CSV em português é uma armadilha: o Excel
 *    brasileiro espera ponto e vírgula, vírgula decimal e BOM, e errar qualquer
 *    um dos três joga a planilha inteira numa coluna só. Com xlsx o número
 *    chega como número e a data como data, e a pessoa pode somar sem limpar
 *    nada antes.
 *
 * 2. **Número é número.** Valor vai como `Decimal` do JS com formato de moeda
 *    aplicado na célula, nunca como texto "R$ 1.234,56". Texto que parece
 *    dinheiro é o motivo de a soma dar zero.
 */

const MOEDA = 'R$ #,##0.00'
const DATA = 'dd/mm/yyyy'
const NUMERO = '#,##0'
const DECIMAL = '#,##0.00'

export type Coluna = {
  titulo: string
  chave: string
  largura?: number
  formato?: 'moeda' | 'data' | 'numero' | 'decimal' | 'texto'
}

export function novaPlanilha() {
  const livro = new ExcelJS.Workbook()
  livro.creator = 'Lysor Transportes'
  livro.created = new Date()
  return livro
}

/**
 * Acrescenta uma aba com cabeçalho fixo e colunas formatadas.
 *
 * O cabeçalho é congelado porque toda tabela aqui passa de uma tela de altura, e
 * rolar sem saber que coluna é qual é como ler o relatório de outra empresa.
 */
export function adicionarAba(
  livro: ExcelJS.Workbook,
  nome: string,
  colunas: Coluna[],
  linhas: Record<string, unknown>[],
) {
  const aba = livro.addWorksheet(nome.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  aba.columns = colunas.map((c) => ({
    header: c.titulo,
    key: c.chave,
    width: c.largura ?? Math.max(12, c.titulo.length + 4),
  }))

  aba.getRow(1).font = { bold: true }
  aba.getRow(1).alignment = { vertical: 'middle' }

  for (const linha of linhas) aba.addRow(linha)

  colunas.forEach((c, i) => {
    const coluna = aba.getColumn(i + 1)
    if (c.formato === 'moeda') coluna.numFmt = MOEDA
    else if (c.formato === 'data') coluna.numFmt = DATA
    else if (c.formato === 'numero') coluna.numFmt = NUMERO
    else if (c.formato === 'decimal') coluna.numFmt = DECIMAL
  })

  if (linhas.length > 0) {
    aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } }
  }
  return aba
}

/** Aba de duas colunas — rótulo e valor. Serve para a cascata e para o acerto. */
export function adicionarResumo(
  livro: ExcelJS.Workbook,
  nome: string,
  linhas: Array<{ rotulo: string; valor: number | string | null; destaque?: boolean; recuo?: boolean }>,
) {
  const aba = livro.addWorksheet(nome.slice(0, 31))
  aba.columns = [
    { header: '', key: 'rotulo', width: 44 },
    { header: '', key: 'valor', width: 18 },
  ]
  for (const l of linhas) {
    const linha = aba.addRow({ rotulo: (l.recuo ? '    ' : '') + l.rotulo, valor: l.valor })
    if (typeof l.valor === 'number') linha.getCell(2).numFmt = MOEDA
    if (l.destaque) linha.font = { bold: true }
  }
  return aba
}

/**
 * Transforma o livro numa resposta de download.
 *
 * O nome do arquivo vai sem acento: acento em `Content-Disposition` depende de
 * codificação que nem todo navegador trata igual, e um arquivo chamado
 * `relatÃ³rio.xlsx` na pasta de downloads é pior que um sem acento.
 */
export async function responderPlanilha(livro: ExcelJS.Workbook, nomeArquivo: string) {
  const buffer = await livro.xlsx.writeBuffer()
  const seguro = nomeArquivo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '-')

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${seguro}"`,
      'Cache-Control': 'no-store',
    },
  })
}
