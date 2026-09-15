import { prisma } from '@/lib/prisma'

/**
 * Categorias que o sistema referencia por nome ao gerar lançamentos
 * automaticamente. São carregadas pelo seed com `sistema: true`.
 */
export const CATEGORIA = {
  COMBUSTIVEL: 'Combustível',
  MANUTENCAO: 'Manutenção',
  PNEUS: 'Pneus',
  PEDAGIO: 'Pedágio',
  DESPESA_VIAGEM: 'Despesa de viagem',
  RECEITA_FRETE: 'Receita de frete',
  COMISSAO_AGREGADO: 'Comissão de agregado',
  SEGURO_AGREGADO: 'Seguro cobrado de agregado',
  COMISSAO_MOTORISTA: 'Comissão de motorista',
  REPASSE_AGREGADO: 'Repasse a agregado',
  ACERTO_MOTORISTA: 'Acerto de motorista',
  SALARIOS: 'Salários e encargos',
} as const

/**
 * Resolve o id de uma categoria pelo nome.
 *
 * Falha alto de propósito: um lançamento sem categoria não aparece em nenhuma
 * camada do DRE, e um custo invisível é pior do que um erro na tela.
 */
export async function idDaCategoria(nome: string): Promise<string> {
  const categoria = await prisma.categoria.findUnique({
    where: { nome },
    select: { id: true },
  })
  if (!categoria) {
    throw new Error(
      `Categoria "${nome}" não encontrada. Rode "npm run db:seed" para carregar as categorias do sistema.`,
    )
  }
  return categoria.id
}

/**
 * Categorias que a tela de despesa avulsa não oferece.
 *
 * Cada uma tem dono em outro lugar, e oferecê-las aqui criaria um segundo
 * caminho para o mesmo dinheiro:
 *
 * - **Combustível** precisa de litros e odômetro; lançado como despesa solta,
 *   some do km/l do caminhão sem ninguém perceber.
 * - **Manutenção** e **Pneus** têm tela própria, com peças e mão de obra
 *   separadas e parcelamento.
 * - **Comissão de motorista** é apropriada pelo resultado a cada frete e paga
 *   no acerto. Lançar à mão contaria o mesmo custo duas vezes.
 * - **Repasse a agregado** nasce com o CT-e, e **Acerto de motorista** nasce
 *   quando o acerto fecha.
 */
export const CATEGORIAS_COM_TELA_PROPRIA: string[] = [
  CATEGORIA.COMBUSTIVEL,
  CATEGORIA.MANUTENCAO,
  CATEGORIA.PNEUS,
  CATEGORIA.COMISSAO_MOTORISTA,
  CATEGORIA.REPASSE_AGREGADO,
  CATEGORIA.ACERTO_MOTORISTA,
]

/** O rótulo de cada camada da cascata, do jeito que a tela explica a escolha. */
export const CAMADA_DO_CUSTO = {
  DIRETO_VIAGEM: {
    titulo: 'Custo da viagem',
    explicacao: 'Sai do lucro do frete. Pedágio, chapa, lavagem, alimentação.',
  },
  VEICULO: {
    titulo: 'Custo do caminhão',
    explicacao: 'Sai do resultado do caminhão. Seguro, licenciamento, parcela, rastreador.',
  },
  OVERHEAD: {
    titulo: 'Custo da empresa',
    explicacao: 'Sai do lucro operacional. Contador, sistema, escritório, impostos.',
  },
  LIQUIDACAO: {
    titulo: 'Liquidação',
    explicacao: 'Pagamento de custo já apropriado. Entra no caixa, não no resultado.',
  },
} as const
