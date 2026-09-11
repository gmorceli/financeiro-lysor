import { exigirAcesso } from '@/lib/sessao'

/**
 * Guarda da área "resultado". Vale para esta pasta e para tudo abaixo dela, então
 * toda tela nova nasce protegida — que é o oposto de proteger tela por tela e
 * descobrir a que ficou de fora depois.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirAcesso('resultado')
  return children
}
