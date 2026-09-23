import { exigirUsuario } from '@/lib/sessao'

/**
 * Guarda da ajuda.
 *
 * `exigirUsuario` e não `exigirAcesso`: ajuda não é área. Quem opera, quem
 * cuida do financeiro e quem administra têm a mesma dúvida sobre onde lançar um
 * pedágio, e recortar isso por perfil só esconderia a resposta de quem precisa.
 * Estar logado basta — e continua sendo uma guarda.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirUsuario()
  return children
}
