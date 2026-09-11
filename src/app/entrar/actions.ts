'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { autenticar } from '@/lib/autenticacao'
import { criarSessao } from '@/lib/sessao'
import { loginSchema } from '@/lib/validacao'
import { validarFormulario, type EstadoFormulario } from '@/lib/acoes'
import { rota } from '@/lib/utils'

/**
 * Só caminho interno é aceito como destino pós-login. Sem isto, `?destino=` num
 * link de e-mail levaria a pessoa a digitar a senha e ser cuspida num site
 * qualquer — que é como phishing costuma pegar carona em tela de login.
 */
function destinoSeguro(valor: string | undefined) {
  if (!valor) return '/'
  if (!valor.startsWith('/')) return '/'
  if (valor.startsWith('//') || valor.includes('\\')) return '/'
  return valor
}

export async function entrar(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validado = validarFormulario(loginSchema, formData)
  if (!validado.sucesso) {
    return { erroGeral: 'Confira o e-mail e a senha.', errosPorCampo: validado.estado.errosPorCampo }
  }

  const { email, senha, destino } = validado.dados
  const resultado = await autenticar(email, senha)
  if (!resultado.ok) return { erroGeral: resultado.erro }

  await criarSessao(resultado.usuarioId)

  // O menu do layout raiz depende de quem está logado: sem invalidar o layout,
  // a primeira tela depois do login volta sem navegação.
  revalidatePath('/', 'layout')
  redirect(rota(destinoSeguro(destino)))
}
