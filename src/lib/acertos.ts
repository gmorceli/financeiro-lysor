import { Prisma, type PrismaClient } from '@prisma/client'
import { arredondar, calcularComissaoMotorista } from '@/lib/calculos'
import { CATEGORIA } from '@/lib/categorias'
import { prisma } from '@/lib/prisma'
import { baixarTitulo } from '@/lib/titulos'

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Acerto — a conta que a cliente fechava no papel.
 *
 * Os dois tipos fecham de formas opostas, e a diferença não é detalhe:
 *
 * - **Motorista**: a comissão nunca existiu como título. Ela é calculada frete
 *   a frete e aparece no resultado por competência, mas ninguém deve nada a
 *   ninguém até o acerto. Fechar é o que cria a conta a pagar.
 * - **Agregado**: os títulos já nasceram junto com o CT-e. Fechar não cria
 *   nada — agrupa, mostra a conta e dá baixa. Criar título aqui duplicaria o
 *   dinheiro, que é o erro clássico deste tipo de tela.
 */

// --------------------------------------------------------------- Motorista

export type FreteDoAcerto = {
  freteId: string
  data: Date
  referencia: string
  rota: string
  valorFreteReal: number
  valorCte: number
  comissao: number
}

export type AcertoMotoristaCalculado = {
  motoristaId: string
  nome: string
  modeloRemuneracao: string
  percentual: number
  base: string
  salario: number
  fretes: FreteDoAcerto[]
  comissaoTotal: number
  bruto: number
}

/**
 * Monta o acerto de um motorista num período.
 *
 * Entram os fretes de **frota própria** das viagens que ele rodou e cuja
 * comissão ainda não foi paga. Frete de agregado não entra: quem dirigiu foi o
 * agregado, e o motorista da Lysor não tem comissão sobre ele.
 *
 * O salário é do modelo de remuneração, não do período: quem é `COMISSAO` puro
 * recebe zero de fixo, e quem é `HIBRIDO` ou `FIXO_MENSAL` recebe o mês cheio.
 * Não há proporcional por dias trabalhados — a cliente não faz isso, e inventar
 * regra que ninguém pediu é como um sistema começa a mentir.
 */
export async function calcularAcertoMotorista(
  motoristaId: string,
  inicio: Date,
  fim: Date,
): Promise<AcertoMotoristaCalculado> {
  const motorista = await prisma.motorista.findUniqueOrThrow({
    where: { id: motoristaId },
    select: {
      id: true,
      nome: true,
      modeloRemuneracao: true,
      salarioFixo: true,
      percentualComissao: true,
      baseComissao: true,
    },
  })

  const fretes = await prisma.frete.findMany({
    where: {
      modalidade: 'FROTA_PROPRIA',
      status: { not: 'CANCELADO' },
      acertoMotoristaId: null,
      dataEmissao: { gte: inicio, lte: fim },
      viagem: { motoristaId },
    },
    select: {
      id: true,
      dataEmissao: true,
      numeroCte: true,
      origem: true,
      destino: true,
      valorFreteReal: true,
      valorCte: true,
    },
    orderBy: { dataEmissao: 'asc' },
  })

  const percentual = Number(motorista.percentualComissao)
  const linhas: FreteDoAcerto[] = fretes.map((f) => ({
    freteId: f.id,
    data: f.dataEmissao,
    referencia: f.numeroCte ? `CT-e ${f.numeroCte}` : '—',
    rota: `${f.origem} → ${f.destino}`,
    valorFreteReal: Number(f.valorFreteReal),
    valorCte: Number(f.valorCte),
    comissao: calcularComissaoMotorista(
      Number(f.valorFreteReal),
      Number(f.valorCte),
      percentual,
      motorista.baseComissao,
    ),
  }))

  const comissaoTotal = arredondar(linhas.reduce((s, l) => s + l.comissao, 0))
  const salario =
    motorista.modeloRemuneracao === 'COMISSAO' ? 0 : Number(motorista.salarioFixo)

  return {
    motoristaId: motorista.id,
    nome: motorista.nome,
    modeloRemuneracao: motorista.modeloRemuneracao,
    percentual,
    base: motorista.baseComissao,
    salario,
    fretes: linhas,
    comissaoTotal,
    bruto: arredondar(salario + comissaoTotal),
  }
}

/**
 * Fecha o acerto do motorista: cria o título a pagar e marca os fretes.
 *
 * O título nasce na categoria de **liquidação**, não na de comissão. A comissão
 * já entrou no resultado no dia de cada frete; contá-la de novo aqui faria o
 * lucro do mês cair por um custo que já estava lá. A verificação cobra esse
 * ponto: fechar um acerto não pode mexer no resultado do período.
 */
export async function fecharAcertoMotorista(
  tx: Tx,
  dados: {
    motoristaId: string
    inicio: Date
    fim: Date
    calculado: AcertoMotoristaCalculado
    adiantamentos: number
    descontos: number
    dataPagamento: Date
    observacoes?: string | null
    fechadoPor?: string | null
  },
) {
  const { calculado } = dados
  const liquido = arredondar(
    calculado.bruto - dados.adiantamentos - dados.descontos,
  )
  if (liquido < 0) {
    throw new Error('Adiantamentos e descontos passam do valor do acerto.')
  }
  if (calculado.fretes.length === 0 && calculado.salario === 0) {
    throw new Error('Não há nada a acertar neste período.')
  }

  const categoria = await tx.categoria.findUniqueOrThrow({
    where: { nome: CATEGORIA.ACERTO_MOTORISTA },
    select: { id: true },
  })

  const titulo = await tx.lancamento.create({
    data: {
      tipo: 'DESPESA',
      categoriaId: categoria.id,
      descricao: `Acerto ${calculado.nome} — ${rotuloPeriodo(dados.inicio, dados.fim)}`,
      valor: new Prisma.Decimal(liquido),
      dataCompetencia: dados.fim,
      dataVencimento: dados.dataPagamento,
      motoristaId: dados.motoristaId,
    },
    select: { id: true },
  })

  const acerto = await tx.acerto.create({
    data: {
      tipo: 'MOTORISTA',
      motoristaId: dados.motoristaId,
      periodoInicio: dados.inicio,
      periodoFim: dados.fim,
      valorSalario: new Prisma.Decimal(calculado.salario),
      valorComissao: new Prisma.Decimal(calculado.comissaoTotal),
      valorBruto: new Prisma.Decimal(calculado.bruto),
      adiantamentos: new Prisma.Decimal(dados.adiantamentos),
      descontos: new Prisma.Decimal(dados.descontos),
      valorLiquido: new Prisma.Decimal(liquido),
      observacoes: dados.observacoes ?? null,
      lancamentoId: titulo.id,
      fechadoEm: new Date(),
      fechadoPor: dados.fechadoPor ?? null,
    },
    select: { id: true },
  })

  // A trava contra pagar duas vezes. Feita na mesma transação do título: ou as
  // duas coisas acontecem, ou nenhuma.
  await tx.frete.updateMany({
    where: { id: { in: calculado.fretes.map((f) => f.freteId) } },
    data: { acertoMotoristaId: acerto.id },
  })

  return { acertoId: acerto.id, lancamentoId: titulo.id, liquido }
}

// ---------------------------------------------------------------- Agregado

export type TituloDoAcerto = {
  lancamentoId: string
  freteId: string | null
  data: Date
  referencia: string
  rota: string
  valorCte: number
  valorCarga: number
  comissao: number
  seguro: number
  /** O que a Lysor paga (INTERMEDIADO) ou recebe (DIRETO) neste título. */
  valor: number
  tipo: 'DESPESA' | 'RECEITA'
  clientePagou: boolean
  dataVencimento: Date | null
}

export type AcertoAgregadoCalculado = {
  proprietarioId: string
  nome: string
  percentualCte: number
  percentualSeguro: number
  titulos: TituloDoAcerto[]
}

/**
 * Lista o que está em aberto com um agregado.
 *
 * Traz também os títulos cujo cliente ainda não pagou, e diz isso em cada
 * linha. É deliberado: a regra da casa é acertar quando o cliente paga, mas
 * quem decide é a pessoa — e esconder a linha faria ela abrir o extrato do
 * banco para descobrir por que o CT-e sumiu da tela.
 */
export async function calcularAcertoAgregado(
  proprietarioId: string,
): Promise<AcertoAgregadoCalculado> {
  const proprietario = await prisma.proprietario.findUniqueOrThrow({
    where: { id: proprietarioId },
    select: { id: true, nome: true, regraCobranca: true },
  })

  const abertos = await prisma.lancamento.findMany({
    where: {
      proprietarioId,
      acertoId: null,
      status: { in: ['ABERTO', 'PARCIAL'] },
      categoria: {
        nome: { in: [CATEGORIA.REPASSE_AGREGADO, CATEGORIA.COMISSAO_AGREGADO] },
      },
    },
    select: {
      id: true,
      tipo: true,
      valor: true,
      valorPago: true,
      dataCompetencia: true,
      dataVencimento: true,
      freteId: true,
      lancamentoOrigem: { select: { status: true } },
      frete: {
        select: {
          numeroCte: true,
          origem: true,
          destino: true,
          valorCte: true,
          valorCargaNfe: true,
          valorComissaoAgregado: true,
          valorSeguroAgregado: true,
          fluxoFinanceiro: true,
        },
      },
    },
    orderBy: { dataCompetencia: 'asc' },
  })

  const regra = (proprietario.regraCobranca ?? {}) as {
    percentualCte?: number
    percentualSeguroCarga?: number
  }

  return {
    proprietarioId: proprietario.id,
    nome: proprietario.nome,
    percentualCte: Number(regra.percentualCte ?? 0),
    percentualSeguro: Number(regra.percentualSeguroCarga ?? 0),
    titulos: abertos.map((l) => ({
      lancamentoId: l.id,
      freteId: l.freteId,
      data: l.dataCompetencia,
      referencia: l.frete?.numeroCte ? `CT-e ${l.frete.numeroCte}` : '—',
      rota: l.frete ? `${l.frete.origem} → ${l.frete.destino}` : '—',
      valorCte: Number(l.frete?.valorCte ?? 0),
      valorCarga: Number(l.frete?.valorCargaNfe ?? 0),
      comissao: Number(l.frete?.valorComissaoAgregado ?? 0),
      seguro: Number(l.frete?.valorSeguroAgregado ?? 0),
      valor: arredondar(Number(l.valor) - Number(l.valorPago)),
      tipo: l.tipo as 'DESPESA' | 'RECEITA',
      // No fluxo direto não existe título de origem: o agregado recebeu do
      // cliente, então não há o que esperar.
      clientePagou: l.lancamentoOrigem ? l.lancamentoOrigem.status === 'LIQUIDADO' : true,
      dataVencimento: l.dataVencimento,
    })),
  }
}

/**
 * Fecha o acerto do agregado dando baixa nos títulos escolhidos.
 *
 * Nenhum título novo é criado. Os que existem já carregam o valor certo desde a
 * emissão do CT-e; o acerto é o documento que diz quais foram fechados juntos e
 * em que dia.
 */
export async function fecharAcertoAgregado(
  tx: Tx,
  dados: {
    proprietarioId: string
    lancamentoIds: string[]
    dataPagamento: Date
    contaBancariaId?: string | null
    observacoes?: string | null
    fechadoPor?: string | null
  },
) {
  if (dados.lancamentoIds.length === 0) {
    throw new Error('Escolha pelo menos um CT-e para acertar.')
  }

  const titulos = await tx.lancamento.findMany({
    where: {
      id: { in: dados.lancamentoIds },
      proprietarioId: dados.proprietarioId,
      acertoId: null,
      status: { in: ['ABERTO', 'PARCIAL'] },
    },
    select: {
      id: true,
      tipo: true,
      valor: true,
      valorPago: true,
      dataCompetencia: true,
      frete: { select: { valorComissaoAgregado: true, valorSeguroAgregado: true } },
    },
  })

  if (titulos.length !== dados.lancamentoIds.length) {
    throw new Error('Algum título já foi acertado ou não é deste agregado. Recarregue a tela.')
  }

  let bruto = 0
  let comissao = 0
  let seguro = 0
  for (const t of titulos) {
    bruto += arredondar(Number(t.valor) - Number(t.valorPago))
    comissao += Number(t.frete?.valorComissaoAgregado ?? 0)
    seguro += Number(t.frete?.valorSeguroAgregado ?? 0)
  }
  bruto = arredondar(bruto)

  const datas = titulos.map((t) => t.dataCompetencia.getTime())
  const acerto = await tx.acerto.create({
    data: {
      tipo: 'AGREGADO',
      proprietarioId: dados.proprietarioId,
      periodoInicio: new Date(Math.min(...datas)),
      periodoFim: new Date(Math.max(...datas)),
      valorComissao: new Prisma.Decimal(arredondar(comissao)),
      valorSeguro: new Prisma.Decimal(arredondar(seguro)),
      valorBruto: new Prisma.Decimal(bruto),
      valorLiquido: new Prisma.Decimal(bruto),
      observacoes: dados.observacoes ?? null,
      fechadoEm: new Date(),
      fechadoPor: dados.fechadoPor ?? null,
    },
    select: { id: true },
  })

  for (const t of titulos) {
    await baixarTitulo(tx, t.id, {
      data: dados.dataPagamento,
      valor: arredondar(Number(t.valor) - Number(t.valorPago)),
      contaBancariaId: dados.contaBancariaId ?? null,
      observacoes: `Acerto de agregado`,
    })
    await tx.lancamento.update({ where: { id: t.id }, data: { acertoId: acerto.id } })
  }

  return { acertoId: acerto.id, titulos: titulos.length, bruto }
}

// ------------------------------------------------------------------ Comum

export function rotuloPeriodo(inicio: Date, fim: Date) {
  const f = (d: Date) =>
    d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
  return `${f(inicio)} a ${f(fim)}`
}
