import type ExcelJS from 'exceljs'
import { adicionarAba, adicionarResumo, novaPlanilha } from '@/lib/planilha'
import type { LinhaFrete, ResultadoPeriodo } from '@/lib/resultado'
import type { TituloListado } from '@/app/financeiro/consultas'
import { contraparte } from '@/app/financeiro/consultas'

/**
 * Montagem das planilhas, separada das rotas de download.
 *
 * A rota faz três coisas — confere a sessão, busca os dados e devolve o
 * arquivo. Nada disso é testável fora de uma requisição, porque `cookies()` só
 * existe lá dentro. O que precisa de teste é o que está aqui: se o número sai
 * como número, se o total bate com a tela, se a coluna tem formato de moeda.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function montarPlanilhaResultado(
  ano: number,
  mes: number,
  r: ResultadoPeriodo,
  porFrete: LinhaFrete[],
): ExcelJS.Workbook {
  const livro = novaPlanilha()

  // A cascata vem primeiro porque é a leitura do mês: cada linha responde uma
  // pergunta diferente, e a ordem é o argumento.
  adicionarResumo(livro, 'Resultado', [
    { rotulo: `Resultado de ${MESES[mes - 1]} de ${ano}`, valor: null, destaque: true },
    { rotulo: '', valor: null },
    { rotulo: 'FROTA PRÓPRIA', valor: null, destaque: true },
    { rotulo: 'Receita de frete', valor: r.propria.receita, recuo: true },
    { rotulo: 'Custos diretos da viagem', valor: -r.propria.custoDireto, recuo: true },
    { rotulo: 'Margem de contribuição', valor: r.propria.margemContribuicao, destaque: true, recuo: true },
    { rotulo: 'Custos do veículo', valor: -r.propria.custoVeiculo, recuo: true },
    { rotulo: 'Resultado da frota', valor: r.propria.resultado, destaque: true, recuo: true },
    { rotulo: '', valor: null },
    { rotulo: 'AGREGADOS', valor: null, destaque: true },
    { rotulo: 'Comissão e seguro cobrados', valor: r.agregado.receita, recuo: true },
    { rotulo: 'Fretes de agregado no mês', valor: r.agregado.fretes, recuo: true },
    { rotulo: '', valor: null },
    { rotulo: 'Despesas administrativas', valor: -r.overhead },
    { rotulo: 'LUCRO OPERACIONAL', valor: r.lucroOperacional, destaque: true },
  ])

  adicionarAba(
    livro,
    'Por caminhão',
    [
      { titulo: 'Caminhão', chave: 'apelido', largura: 24 },
      { titulo: 'Receita', chave: 'receita', formato: 'moeda' },
      { titulo: 'Custos diretos', chave: 'custoDireto', formato: 'moeda', largura: 16 },
      { titulo: 'Margem de contribuição', chave: 'margem', formato: 'moeda', largura: 22 },
      { titulo: 'Custos do veículo', chave: 'custoVeiculo', formato: 'moeda', largura: 18 },
      { titulo: 'Resultado', chave: 'resultado', formato: 'moeda' },
      { titulo: 'Km rodado', chave: 'kmRodado', formato: 'numero' },
      { titulo: 'Km vazio', chave: 'kmVazio', formato: 'numero' },
    ],
    r.porVeiculo.map((v) => ({
      apelido: v.apelido,
      receita: v.receita,
      custoDireto: v.custoDireto,
      margem: v.margemContribuicao,
      custoVeiculo: v.custoVeiculo,
      resultado: v.resultado,
      kmRodado: v.kmRodado,
      kmVazio: v.kmVazio,
    })),
  )

  adicionarAba(
    livro,
    'Por frete',
    [
      { titulo: 'Data', chave: 'data', formato: 'data' },
      { titulo: 'CT-e', chave: 'cte' },
      { titulo: 'Cliente', chave: 'cliente', largura: 28 },
      { titulo: 'Caminhão', chave: 'veiculo', largura: 20 },
      { titulo: 'Rota', chave: 'rota', largura: 32 },
      { titulo: 'Receita', chave: 'receita', formato: 'moeda' },
      { titulo: 'Custo direto rateado', chave: 'custoDireto', formato: 'moeda', largura: 20 },
      { titulo: 'Custo do veículo rateado', chave: 'custoVeiculo', formato: 'moeda', largura: 22 },
      { titulo: 'Resultado', chave: 'resultado', formato: 'moeda' },
    ],
    porFrete.map((f) => ({
      data: f.data,
      cte: f.numeroCte ?? '',
      cliente: f.cliente,
      veiculo: f.veiculo ?? '',
      rota: f.rota,
      receita: f.receita,
      custoDireto: f.custoDiretoRateado,
      custoVeiculo: f.custoVeiculoRateado,
      resultado: f.resultado,
    })),
  )

  return livro
}

const COLUNAS_FINANCEIRO = [
  { titulo: 'Vencimento', chave: 'vencimento', formato: 'data' as const },
  { titulo: 'Competência', chave: 'competencia', formato: 'data' as const, largura: 14 },
  { titulo: 'Quem', chave: 'quem', largura: 30 },
  { titulo: 'Descrição', chave: 'descricao', largura: 40 },
  { titulo: 'Categoria', chave: 'categoria', largura: 22 },
  { titulo: 'Caminhão', chave: 'veiculo', largura: 18 },
  { titulo: 'Valor', chave: 'valor', formato: 'moeda' as const },
  { titulo: 'Pago', chave: 'pago', formato: 'moeda' as const },
  { titulo: 'Em aberto', chave: 'aberto', formato: 'moeda' as const },
  { titulo: 'Situação', chave: 'situacao', largura: 22 },
  { titulo: 'Pago em', chave: 'pagoEm', formato: 'data' as const },
]

const SITUACAO: Record<string, string> = {
  ABERTO: 'Em aberto',
  PARCIAL: 'Parcial',
  LIQUIDADO: 'Pago',
  CANCELADO: 'Cancelado',
}

function linhasFinanceiras(titulos: TituloListado[]) {
  return titulos.map((t) => ({
    // Vencimento vazio é o repasse esperando o cliente pagar. Fica em branco de
    // propósito: inventar data aqui viraria compromisso marcado numa planilha
    // que alguém vai usar para decidir pagamento.
    vencimento: t.dataVencimento ?? null,
    competencia: t.dataCompetencia,
    quem: contraparte(t),
    descricao: t.descricao,
    categoria: t.categoria.nome,
    veiculo: t.veiculo?.apelido ?? '',
    valor: Number(t.valor),
    pago: Number(t.valorPago),
    aberto: Number(t.valor) - Number(t.valorPago),
    situacao:
      t.dataVencimento === null && t.status === 'ABERTO'
        ? 'Espera o cliente pagar'
        : (SITUACAO[t.status] ?? t.status),
    pagoEm: t.dataPagamento ?? null,
  }))
}

export function montarPlanilhaFinanceiro(
  aPagar: TituloListado[],
  aReceber: TituloListado[],
): ExcelJS.Workbook {
  const livro = novaPlanilha()
  adicionarAba(livro, 'A pagar', COLUNAS_FINANCEIRO, linhasFinanceiras(aPagar))
  adicionarAba(livro, 'A receber', COLUNAS_FINANCEIRO, linhasFinanceiras(aReceber))
  return livro
}
