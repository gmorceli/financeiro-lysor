import { exigirAcesso } from '@/lib/sessao'

/**
 * Guarda da área "cadastros". Vale para esta pasta e para tudo abaixo dela, então
 * toda tela nova nasce protegida — que é o oposto de proteger tela por tela e
 * descobrir a que ficou de fora depois.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirAcesso('cadastros')
  return children
}
