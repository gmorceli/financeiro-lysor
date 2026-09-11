'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { alterarSenha } from '@/lib/autenticacao'
import { auditar } from '@/lib/auditoria'
import { criarSessao, encerrarSessao, exigirUsuario, usuarioDaSessao } from '@/lib/sessao'
import { trocaDeSenhaSchema } from '@/lib/validacao'
import { validarFormulario, type EstadoFormulario } from '@/lib/acoes'

export async function sair() {
  const usuario = await usuarioDaSessao()
  if (usuario) await auditar({ acao: 'LOGOUT', entidadeId: usuario.id, usuarioId: usuario.id })
  await encerrarSessao()
  revalidatePath('/', 'layout')
  redirect('/entrar')
}

export async function trocarSenha(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  // A flag de senha provisória desvia todo o resto do sistema para cá; esta é a
  // única action que pode rodar com ela de pé.
  const usuario = await exigirUsuario({ trocaDeSenha: true })

  const validado = validarFormulario(trocaDeSenhaSchema, formData)
  if (!validado.sucesso) return validado.estado

  const { senhaAtual, senhaNova } = validado.dados
  const resultado = await alterarSenha(usuario.id, senhaAtual, senhaNova)
  if (!resultado.ok) {
    return resultado.campo
      ? { erroGeral: resultado.erro, errosPorCampo: { [resultado.campo]: [resultado.erro] } }
      : { erroGeral: resultado.erro }
  }

  // `alterarSenha` derruba todas as sessões, inclusive esta. Sem uma nova aqui,
  // a pessoa trocaria a senha e cairia no login em seguida.
  await criarSessao(usuario.id)
  revalidatePath('/', 'layout')
  redirect('/')
}
