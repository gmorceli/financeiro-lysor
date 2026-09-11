'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auditar } from '@/lib/auditoria'
import { definirSenhaProvisoria } from '@/lib/autenticacao'
import { gerarHashSenha } from '@/lib/senha'
import { criticarSenha } from '@/lib/regras-senha'
import { exigirAcesso, revogarSessoes } from '@/lib/sessao'
import { impedimentoDeAdmin } from '@/lib/usuarios'
import { redefinirSenhaSchema, usuarioSchema } from '@/lib/validacao'
import {
  traduzirErroPrisma,
  validarFormulario,
  type EstadoFormulario,
} from '@/lib/acoes'

const ROTULOS = { email: 'esse e-mail', motoristaId: 'esse motorista' }

export async function salvarUsuario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const autor = await exigirAcesso('usuarios')

  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(usuarioSchema, formData)
  if (!validado.sucesso) return validado.estado

  const { motoristaId, ...dados } = validado.dados
  const payload = { ...dados, motoristaId: motoristaId ?? null }

  try {
    if (id) {
      const impedimento = await impedimentoDeAdmin(id, autor.id, dados.perfil, dados.ativo)
      if (impedimento) return { erroGeral: impedimento }

      await prisma.usuario.update({ where: { id }, data: payload })
      // Desativar tem que valer agora, não na próxima expiração de cookie.
      if (!dados.ativo) await revogarSessoes(id)
      await auditar({
        acao: 'USUARIO_ALTERADO',
        entidadeId: id,
        usuarioId: autor.id,
        detalhes: { perfil: dados.perfil, ativo: dados.ativo },
      })
    } else {
      const senha = formData.get('senha')?.toString() ?? ''
      const critica = criticarSenha(senha)
      if (critica) {
        return { erroGeral: critica, errosPorCampo: { senha: [critica] } }
      }

      const criado = await prisma.usuario.create({
        data: { ...payload, senhaHash: await gerarHashSenha(senha), trocarSenha: true },
        select: { id: true },
      })
      await auditar({
        acao: 'USUARIO_CRIADO',
        entidadeId: criado.id,
        usuarioId: autor.id,
        detalhes: { email: dados.email, perfil: dados.perfil },
      })
    }
  } catch (erro) {
    return traduzirErroPrisma(erro, ROTULOS)
  }

  revalidatePath('/usuarios')
  return { ok: true }
}

export async function redefinirSenha(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const autor = await exigirAcesso('usuarios')

  const validado = validarFormulario(redefinirSenhaSchema, formData)
  if (!validado.sucesso) return validado.estado

  const { usuarioId, senhaNova } = validado.dados
  const resultado = await definirSenhaProvisoria(usuarioId, senhaNova, autor.id)
  if (!resultado.ok) {
    return { erroGeral: resultado.erro, errosPorCampo: { senhaNova: [resultado.erro] } }
  }

  revalidatePath('/usuarios')
  return { ok: true }
}
