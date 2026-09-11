import { prisma } from '@/lib/prisma'
import { adicionarAba, adicionarResumo, novaPlanilha, responderPlanilha } from '@/lib/planilha'
import { exigirAcessoNaRota } from '@/lib/sessao'

export const dynamic = 'force-dynamic'

/**
 * O acerto fechado, em planilha — o papel que ela entregava na mão.
 *
 * Só acerto **fechado** é exportado. Enquanto está aberto o número ainda muda,
 * e um papel com valor que depois mudou é pior que papel nenhum: alguém vai
 * guardar e cobrar por ele.
 */
export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { usuario, resposta } = await exigirAcessoNaRota('financeiro')
  if (!usuario) return resposta

  const { id } = await params
  const acerto = await prisma.acerto.findUnique({
    where: { id },
    include: {
      motorista: { select: { nome: true, cpf: true } },
      proprietario: { select: { nome: true, cpfCnpj: true } },
      fretesComissionados: {
        select: {
          dataEmissao: true, numeroCte: true, origem: true, destino: true,
          valorCte: true, valorFreteReal: true,
        },
        orderBy: { dataEmissao: 'asc' },
      },
      titulosLiquidados: {
        select: {
          dataCompetencia: true, descricao: true, valor: true,
          frete: {
            select: {
              numeroCte: true, origem: true, destino: true, valorCte: true,
              valorCargaNfe: true, valorComissaoAgregado: true, valorSeguroAgregado: true,
            },
          },
        },
        orderBy: { dataCompetencia: 'asc' },
      },
    },
  })

  if (!acerto) return new Response('Acerto não encontrado.', { status: 404 })
  if (!acerto.fechadoEm) {
    return new Response('Este acerto ainda não foi fechado.', { status: 409 })
  }

  const quem = acerto.motorista?.nome ?? acerto.proprietario?.nome ?? 'sem nome'
  const doc = acerto.motorista?.cpf ?? acerto.proprietario?.cpfCnpj ?? ''
  const dia = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '')

  const livro = novaPlanilha()

  adicionarResumo(livro, 'Acerto', [
    { rotulo: acerto.tipo === 'MOTORISTA' ? 'ACERTO DE MOTORISTA' : 'ACERTO DE AGREGADO', valor: null, destaque: true },
    { rotulo: quem, valor: null, destaque: true },
    { rotulo: 'Documento', valor: doc },
    { rotulo: 'Período', valor: `${dia(acerto.periodoInicio)} a ${dia(acerto.periodoFim)}` },
    { rotulo: 'Fechado em', valor: dia(acerto.fechadoEm) },
    { rotulo: 'Fechado por', valor: acerto.fechadoPor ?? '' },
    { rotulo: '', valor: null },
    ...(acerto.tipo === 'MOTORISTA'
      ? [
          { rotulo: 'Salário do período', valor: Number(acerto.valorSalario) },
          { rotulo: 'Comissão sobre os fretes', valor: Number(acerto.valorComissao) },
        ]
      : [
          { rotulo: 'Comissão sobre os CT-e', valor: Number(acerto.valorComissao) },
          { rotulo: 'Seguro sobre o valor da carga', valor: Number(acerto.valorSeguro) },
        ]),
    { rotulo: 'Bruto', valor: Number(acerto.valorBruto), destaque: true },
    ...(Number(acerto.adiantamentos) > 0
      ? [{ rotulo: 'Adiantamentos', valor: -Number(acerto.adiantamentos) }]
      : []),
    ...(Number(acerto.descontos) > 0
      ? [{ rotulo: 'Descontos', valor: -Number(acerto.descontos) }]
      : []),
    { rotulo: 'LÍQUIDO', valor: Number(acerto.valorLiquido), destaque: true },
    ...(acerto.observacoes ? [{ rotulo: '', valor: null }, { rotulo: 'Observação', valor: acerto.observacoes }] : []),
  ])

  if (acerto.tipo === 'MOTORISTA') {
    adicionarAba(
      livro,
      'Fretes',
      [
        { titulo: 'Data', chave: 'data', formato: 'data' },
        { titulo: 'CT-e', chave: 'cte' },
        { titulo: 'Rota', chave: 'rota', largura: 34 },
        { titulo: 'Valor do CT-e', chave: 'valorCte', formato: 'moeda', largura: 16 },
        { titulo: 'Valor combinado', chave: 'valorReal', formato: 'moeda', largura: 16 },
      ],
      acerto.fretesComissionados.map((f) => ({
        data: f.dataEmissao,
        cte: f.numeroCte ?? '',
        rota: `${f.origem} → ${f.destino}`,
        valorCte: Number(f.valorCte),
        valorReal: Number(f.valorFreteReal),
      })),
    )
  } else {
    adicionarAba(
      livro,
      'CT-e acertados',
      [
        { titulo: 'Data', chave: 'data', formato: 'data' },
        { titulo: 'CT-e', chave: 'cte' },
        { titulo: 'Rota', chave: 'rota', largura: 34 },
        { titulo: 'Valor do CT-e', chave: 'valorCte', formato: 'moeda', largura: 16 },
        { titulo: 'Valor da carga', chave: 'carga', formato: 'moeda', largura: 16 },
        { titulo: 'Comissão', chave: 'comissao', formato: 'moeda' },
        { titulo: 'Seguro', chave: 'seguro', formato: 'moeda' },
        { titulo: 'Repasse', chave: 'repasse', formato: 'moeda' },
      ],
      acerto.titulosLiquidados.map((t) => ({
        data: t.dataCompetencia,
        cte: t.frete?.numeroCte ?? '',
        rota: t.frete ? `${t.frete.origem} → ${t.frete.destino}` : t.descricao,
        valorCte: Number(t.frete?.valorCte ?? 0),
        carga: Number(t.frete?.valorCargaNfe ?? 0),
        comissao: Number(t.frete?.valorComissaoAgregado ?? 0),
        seguro: Number(t.frete?.valorSeguroAgregado ?? 0),
        repasse: Number(t.valor),
      })),
    )
  }

  const data = acerto.fechadoEm.toISOString().slice(0, 10)
  return responderPlanilha(livro, `acerto-${quem.split(' ')[0].toLowerCase()}-${data}.xlsx`)
}
