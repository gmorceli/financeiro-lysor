import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { regerarTitulosDoFrete } from '@/lib/titulos'
import { calcularComissaoMotorista } from '@/lib/calculos'

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Exclusão e restauração de viagem.
 *
 * Viagem lançada por engano é rotina: CT-e duplicado, placa trocada, valor
 * digitado com um zero a mais. Até aqui não havia saída — o registro errado
 * ficava para sempre no resultado do mês, e a única alternativa era abrir o
 * banco.
 *
 * A exclusão é **lógica**. Apagar de verdade destruiria o rastro de um CT-e que
 * existiu no mundo e cujo número foi para a SEFAZ; e, pior, impediria o desfazer
 * de uma exclusão feita na linha errada da lista, que é justamente o erro que a
 * pressa produz. A viagem sai de tudo — listas, fechamentos, contas a receber,
 * lucro por caminhão, lucro por frete, comissão — e continua existindo com data,
 * hora, usuário e motivo.
 *
 * O arrasto é o que exige cuidado. Uma viagem não é um registro solto: ela
 * carrega fretes, que carregam recebíveis, que podem já ter baixa. A regra
 * adotada é a que a cliente pediu: a exclusão vai até o fim e estorna o que
 * precisa, mas só depois de dizer na tela, em português, o que vai acontecer
 * com cada um desses pedaços.
 */

export const MOTIVOS_EXCLUSAO = {
  DUPLICADO: 'Lançamento duplicado',
  DADOS_ERRADOS: 'Dados lançados errados',
  CTE_CANCELADO: 'CT-e cancelado',
  OUTRO: 'Outro',
} as const

export type MotivoExclusao = keyof typeof MOTIVOS_EXCLUSAO

/** O que fazer com o pedágio e a despesa de estrada já lançados na viagem. */
export type DestinoDespesas = 'excluir' | 'manter'

export type ResumoExclusao = {
  id: string
  numero: number
  dataSaida: Date
  veiculo: string
  placa: string
  motorista: string
  rota: string
  receita: number
  comissao: number
  fretes: Array<{ numeroCte: string | null; cliente: string; valor: number }>
  /** Títulos do frete com dinheiro já baixado — serão estornados. */
  recebimentos: Array<{ descricao: string; valorPago: number }>
  /** Despesas apropriadas à viagem, que a pessoa decide o que fazer com. */
  despesas: Array<{ id: string; descricao: string; categoria: string; valor: number }>
  /** Fretes cuja comissão já entrou num acerto fechado — trava a exclusão. */
  fretesAcertados: number
  excluida: { em: Date; por: string | null; motivo: string | null } | null
}

/**
 * Tudo o que a tela de confirmação precisa mostrar antes de excluir.
 *
 * O resumo existe para evitar o erro que a confirmação sozinha não evita:
 * clicar na linha de cima. Data, CT-e, motorista, placa, rota e valor na mesma
 * frase é o que deixa óbvio que a viagem em tela é outra.
 */
export async function resumoParaExclusao(id: string): Promise<ResumoExclusao | null> {
  const viagem = await prisma.viagem.findUnique({
    where: { id },
    include: {
      veiculo: { select: { apelido: true, placa: true } },
      motorista: { select: { nome: true, percentualComissao: true, baseComissao: true } },
      fretes: {
        include: {
          cliente: { select: { razaoSocial: true, nomeFantasia: true } },
          lancamentos: { select: { descricao: true, valorPago: true } },
        },
        orderBy: { dataEmissao: 'asc' },
      },
      lancamentos: {
        where: { tipo: 'DESPESA', status: { not: 'CANCELADO' } },
        include: { categoria: { select: { nome: true } } },
        orderBy: { dataCompetencia: 'asc' },
      },
    },
  })
  if (!viagem) return null

  const valendo = viagem.fretes.filter((f) => f.status !== 'CANCELADO')

  return {
    id: viagem.id,
    numero: viagem.numero,
    dataSaida: viagem.dataSaida,
    veiculo: viagem.veiculo.apelido,
    placa: viagem.veiculo.placa,
    motorista: viagem.motorista.nome,
    rota: `${viagem.origem} → ${viagem.destino}`,
    receita: valendo.reduce((s, f) => s + Number(f.valorFreteReal), 0),
    comissao: valendo.reduce(
      (s, f) =>
        s +
        calcularComissaoMotorista(
          Number(f.valorFreteReal),
          Number(f.valorCte),
          Number(viagem.motorista.percentualComissao),
          viagem.motorista.baseComissao,
        ),
      0,
    ),
    fretes: valendo.map((f) => ({
      numeroCte: f.numeroCte,
      cliente: f.cliente.nomeFantasia || f.cliente.razaoSocial,
      valor: Number(f.valorFreteReal),
    })),
    recebimentos: valendo
      .flatMap((f) => f.lancamentos)
      .filter((l) => Number(l.valorPago) > 0)
      .map((l) => ({ descricao: l.descricao, valorPago: Number(l.valorPago) })),
    despesas: viagem.lancamentos.map((l) => ({
      id: l.id,
      descricao: l.descricao,
      categoria: l.categoria.nome,
      valor: Number(l.valor),
    })),
    fretesAcertados: valendo.filter((f) => f.acertoMotoristaId != null).length,
    excluida: viagem.excluidaEm
      ? { em: viagem.excluidaEm, por: viagem.excluidaPor, motivo: viagem.motivoExclusao }
      : null,
  }
}

/**
 * Marca a viagem como excluída e desfaz o que ela criou.
 *
 * Roda inteira ou não roda: um recebível cancelado sem a viagem sair da lista
 * deixaria a cliente cobrando um frete que o sistema diz que não existe.
 */
export async function excluirViagemLogicamente(
  tx: Tx,
  id: string,
  entrada: { motivo: string; usuario: string; despesas: DestinoDespesas },
): Promise<void> {
  const viagem = await tx.viagem.findUnique({
    where: { id },
    select: {
      excluidaEm: true,
      fretes: {
        select: {
          id: true,
          status: true,
          acertoMotoristaId: true,
          lancamentos: { select: { id: true, valorPago: true } },
        },
      },
      lancamentos: { where: { tipo: 'DESPESA' }, select: { id: true, valorPago: true } },
    },
  })
  if (!viagem) throw new Error('Viagem não encontrada.')
  if (viagem.excluidaEm) throw new Error('Esta viagem já está excluída.')

  // Comissão já paga num acerto fechado é a única trava de verdade. Tirar o
  // frete da base de cálculo depois do pagamento deixaria um acerto sem lastro:
  // dinheiro que saiu da conta e nenhum frete para justificar.
  const acertados = viagem.fretes.filter(
    (f) => f.status !== 'CANCELADO' && f.acertoMotoristaId != null,
  )
  if (acertados.length > 0) {
    throw new Error(
      'A comissão desta viagem já entrou num acerto de motorista fechado. Refaça o acerto antes de excluir a viagem.',
    )
  }

  // O recebimento baixado é estornado, e não impede a exclusão — foi o que a
  // cliente pediu, e é coerente: se o frete não existiu, o que entrou foi
  // adiantamento ou pagamento de outro frete, e precisa voltar para o aberto.
  const titulosDoFrete = viagem.fretes.flatMap((f) => f.lancamentos.map((l) => l.id))
  if (titulosDoFrete.length > 0) {
    await tx.baixa.deleteMany({ where: { lancamentoId: { in: titulosDoFrete } } })
    await tx.lancamento.updateMany({
      where: { id: { in: titulosDoFrete } },
      data: { valorPago: 0, dataPagamento: null, status: 'CANCELADO' },
    })
  }

  // Cancelamento por arrasto: o frete que já estava cancelado por outro motivo
  // fica como está, e é a flag que separa os dois casos na restauração.
  await tx.frete.updateMany({
    where: { viagemId: id, status: { not: 'CANCELADO' } },
    data: { status: 'CANCELADO', canceladoComViagem: true },
  })

  if (viagem.lancamentos.length > 0) {
    if (entrada.despesas === 'excluir') {
      // Despesa já paga não se apaga: sumiria do caixa um valor que saiu da
      // conta de verdade. Ela fica, como custo do caminhão.
      const pagas = viagem.lancamentos.filter((l) => Number(l.valorPago) > 0).map((l) => l.id)
      const zeradas = viagem.lancamentos.filter((l) => Number(l.valorPago) === 0).map((l) => l.id)
      if (zeradas.length > 0) {
        await tx.lancamento.updateMany({
          where: { id: { in: zeradas } },
          data: { status: 'CANCELADO', viagemId: null },
        })
      }
      if (pagas.length > 0) {
        await tx.lancamento.updateMany({
          where: { id: { in: pagas } },
          data: { viagemId: null },
        })
      }
    } else {
      // Mantidas: perdem a viagem e seguem como custo do caminhão no mês. O
      // dinheiro saiu — o pedágio foi pago mesmo que o CT-e estivesse errado.
      await tx.lancamento.updateMany({
        where: { viagemId: id, tipo: 'DESPESA' },
        data: { viagemId: null },
      })
    }
  }

  await tx.viagem.update({
    where: { id },
    data: {
      excluidaEm: new Date(),
      excluidaPor: entrada.usuario,
      motivoExclusao: entrada.motivo,
    },
  })
}

/**
 * Desfaz a exclusão.
 *
 * Volta os fretes que caíram por arrasto e regrava os recebíveis deles a partir
 * do frete. Regravar em vez de reabrir o título cancelado é de propósito: é a
 * mesma função que a correção de frete usa, e uma função só significa uma
 * verdade só sobre quanto se cobra de quem.
 *
 * As despesas não voltam para a viagem. Elas viraram custo do caminhão, e o
 * relatório já as conta lá; devolvê-las aqui contaria o mesmo pedágio duas
 * vezes no mês em que a restauração acontecesse.
 */
export async function restaurarViagem(tx: Tx, id: string): Promise<void> {
  const viagem = await tx.viagem.findUnique({
    where: { id },
    select: { excluidaEm: true, fretes: { where: { canceladoComViagem: true }, select: { id: true } } },
  })
  if (!viagem) throw new Error('Viagem não encontrada.')
  if (!viagem.excluidaEm) throw new Error('Esta viagem não está excluída.')

  for (const frete of viagem.fretes) {
    await tx.frete.update({
      where: { id: frete.id },
      data: { status: 'ABERTO', canceladoComViagem: false },
    })
    await regerarTitulosDoFrete(tx, frete.id)
  }

  await tx.viagem.update({
    where: { id },
    data: { excluidaEm: null, excluidaPor: null, motivoExclusao: null },
  })
}
