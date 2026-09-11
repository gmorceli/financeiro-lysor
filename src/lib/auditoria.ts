import { prisma } from '@/lib/prisma'

/**
 * Trilha de acesso e de alteração de conta.
 *
 * Grava na tabela `auditoria`, que já existia no modelo e até agora estava
 * vazia. O que interessa aqui não é auditoria contábil: é poder responder "quem
 * entrou, de onde, e quando a senha de alguém mudou" quando a cliente
 * desconfiar de algo. Tentativa que falha é o registro mais útil dos três.
 */
export type AcaoAuditada =
  | 'LOGIN'
  | 'LOGIN_RECUSADO'
  | 'LOGOUT'
  | 'SENHA_ALTERADA'
  | 'SENHA_REDEFINIDA'
  | 'USUARIO_CRIADO'
  | 'USUARIO_ALTERADO'

export async function auditar(dados: {
  acao: AcaoAuditada
  entidadeId: string
  usuarioId?: string | null
  detalhes?: Record<string, unknown>
}) {
  try {
    await prisma.auditoria.create({
      data: {
        entidade: 'usuario',
        entidadeId: dados.entidadeId,
        acao: dados.acao,
        usuarioId: dados.usuarioId ?? null,
        dadosDepois: dados.detalhes ? (dados.detalhes as object) : undefined,
      },
    })
  } catch (erro) {
    // Falha em auditar não pode derrubar o login. Registrar é desejável;
    // impedir a pessoa de trabalhar por causa disso, não.
    console.error('falha ao auditar', dados.acao, erro)
  }
}
