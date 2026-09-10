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
