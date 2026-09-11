/**
 * Regras de senha sem criptografia nenhuma.
 *
 * Módulo separado de propósito: a tela de troca precisa mostrar o mínimo de
 * caracteres, e é componente de cliente. Se ela importasse de `senha.ts`, o
 * `node:crypto` iria junto para o bundle do navegador — foi exatamente o que o
 * build recusou quando estavam no mesmo arquivo.
 */

/** Comprimento acima de tudo, sem exigência de caractere especial. */
export const SENHA_MINIMA = 10

export function criticarSenha(senha: string): string | null {
  if (senha.length < SENHA_MINIMA) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  }
  if (senha.length > 200) return 'A senha é longa demais.'
  if (/^\d+$/.test(senha)) return 'A senha não pode ser só números.'
  return null
}
