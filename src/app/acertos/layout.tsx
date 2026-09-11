import { exigirAcesso } from '@/lib/sessao'

/**
 * Guarda da área "financeiro". Acerto move dinheiro: quem é de Operação lança
 * viagem e custo, mas não fecha conta com motorista nem com agregado.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirAcesso('financeiro')
  return children
}
