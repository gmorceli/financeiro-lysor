import { prisma } from '@/lib/prisma'
import { auditar } from '@/lib/auditoria'
import { temAlgumAcesso } from '@/lib/permissoes'
import { conferirSenha, gerarHashSenha, HASH_FALSO } from '@/lib/senha'
import { criticarSenha } from '@/lib/regras-senha'
import { revogarSessoes } from '@/lib/sessao-nucleo'

/**
 * Regras de autenticação, separadas da Server Action de propósito: aqui não há
 * cookie, FormData nem redirect. É o que permite ao `verificar:auth` exercitar
 * bloqueio, expiração e troca de senha de verdade contra o banco, em vez de
 * confiar que a tela faz o certo.
 */

const MAXIMO_DE_TENTATIVAS = 5
const MINUTOS_DE_BLOQUEIO = 15

/**
 * Mesma frase para e-mail que não existe, senha errada e conta desativada. Dizer
 * qual dos três foi entrega a lista de quem tem conta.
 */
const RECUSA_GENERICA = 'E-mail ou senha incorretos.'

export type ResultadoLogin =
  | { ok: true; usuarioId: string }
  | { ok: false; erro: string }

export async function autenticar(email: string, senha: string): Promise<ResultadoLogin> {
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      senhaHash: true,
      ativo: true,
      perfil: true,
      tentativasFalhas: true,
      bloqueadoAte: true,
    },
  })

  const agora = new Date()

  if (usuario?.bloqueadoAte && usuario.bloqueadoAte > agora) {
    const minutos = Math.max(
      1,
      Math.ceil((usuario.bloqueadoAte.getTime() - agora.getTime()) / 60000),
    )
    await auditar({ acao: 'LOGIN_RECUSADO', entidadeId: usuario.id, detalhes: { motivo: 'bloqueado' } })
    // Aqui a mensagem específica é deliberada: já se sabe que a conta existe
    // (alguém errou a senha dela cinco vezes), e a pessoa precisa entender que
    // não é a senha que está errada — é o relógio.
    return {
      ok: false,
      erro: `Muitas tentativas erradas. Tente de novo em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
    }
  }

  // Sem usuário, confere contra um hash descartável: gasta o mesmo tempo de CPU
  // e o cronômetro do atacante não distingue e-mail cadastrado de inexistente.
  const senhaConfere = await conferirSenha(senha, usuario?.senhaHash ?? HASH_FALSO)

  if (!usuario || !senhaConfere) {
    if (usuario) {
      const tentativas = usuario.tentativasFalhas + 1
      const estourou = tentativas >= MAXIMO_DE_TENTATIVAS
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          tentativasFalhas: estourou ? 0 : tentativas,
          bloqueadoAte: estourou
            ? new Date(agora.getTime() + MINUTOS_DE_BLOQUEIO * 60000)
            : usuario.bloqueadoAte,
        },
      })
      await auditar({
        acao: 'LOGIN_RECUSADO',
        entidadeId: usuario.id,
        detalhes: { motivo: 'senha', tentativas, bloqueou: estourou },
      })
    }
    return { ok: false, erro: RECUSA_GENERICA }
  }

  if (!usuario.ativo) {
    await auditar({ acao: 'LOGIN_RECUSADO', entidadeId: usuario.id, detalhes: { motivo: 'inativo' } })
    return { ok: false, erro: RECUSA_GENERICA }
  }

  if (!temAlgumAcesso(usuario.perfil)) {
    await auditar({
      acao: 'LOGIN_RECUSADO',
      entidadeId: usuario.id,
      detalhes: { motivo: 'perfil sem área', perfil: usuario.perfil },
    })
    return {
      ok: false,
      erro: 'O perfil de motorista ainda não tem tela neste sistema. Fale com o administrador.',
    }
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoAcessoEm: agora },
  })
  await auditar({ acao: 'LOGIN', entidadeId: usuario.id, usuarioId: usuario.id })

  return { ok: true, usuarioId: usuario.id }
}

/**
 * Troca de senha pela própria pessoa. Exige a senha atual mesmo já havendo
 * sessão válida: é o que impede que um celular esquecido destravado vire troca
 * de senha.
 *
 * Todas as sessões caem, inclusive a de quem trocou — senha nova com sessão
 * antiga ainda de pé é senha não trocada. Quem chamar isto precisa criar uma
 * sessão nova em seguida.
 */
export async function alterarSenha(
  usuarioId: string,
  senhaAtual: string,
  senhaNova: string,
): Promise<{ ok: true } | { ok: false; erro: string; campo?: string }> {
  const critica = criticarSenha(senhaNova)
  if (critica) return { ok: false, erro: critica, campo: 'senhaNova' }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { senhaHash: true },
  })
  if (!usuario) return { ok: false, erro: 'Usuário não encontrado.' }

  if (!(await conferirSenha(senhaAtual, usuario.senhaHash))) {
    return { ok: false, erro: 'Senha atual incorreta.', campo: 'senhaAtual' }
  }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      senhaHash: await gerarHashSenha(senhaNova),
      senhaDefinidaEm: new Date(),
      trocarSenha: false,
      tentativasFalhas: 0,
      bloqueadoAte: null,
    },
  })
  await revogarSessoes(usuarioId)
  await auditar({ acao: 'SENHA_ALTERADA', entidadeId: usuarioId, usuarioId })

  return { ok: true }
}

/**
 * Senha definida por administrador (criação de usuário ou reset). Nasce
 * provisória: `trocarSenha` de pé obriga a substituição no primeiro acesso, para
 * que a senha que passou por WhatsApp não continue valendo.
 */
export async function definirSenhaProvisoria(
  usuarioId: string,
  senha: string,
  autorId?: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const critica = criticarSenha(senha)
  if (critica) return { ok: false, erro: critica }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      senhaHash: await gerarHashSenha(senha),
      senhaDefinidaEm: new Date(),
      trocarSenha: true,
      tentativasFalhas: 0,
      bloqueadoAte: null,
    },
  })
  await revogarSessoes(usuarioId)
  await auditar({ acao: 'SENHA_REDEFINIDA', entidadeId: usuarioId, usuarioId: autorId })

  return { ok: true }
}

export { MAXIMO_DE_TENTATIVAS, MINUTOS_DE_BLOQUEIO, RECUSA_GENERICA }
