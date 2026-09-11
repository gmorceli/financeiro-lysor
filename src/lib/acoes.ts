import { Prisma } from '@prisma/client'
import type { z } from 'zod'

export type EstadoFormulario = {
  ok?: boolean
  erroGeral?: string
  errosPorCampo?: Record<string, string[]>
}

export const ESTADO_INICIAL: EstadoFormulario = {}

/**
 * Valida o FormData contra um schema Zod e devolve erros no formato que os
 * formulários consomem.
 */
export function validarFormulario<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { sucesso: true; dados: z.infer<T> } | { sucesso: false; estado: EstadoFormulario } {
  const bruto = Object.fromEntries(formData.entries())
  const resultado = schema.safeParse(bruto)

  if (!resultado.success) {
    return {
      sucesso: false,
      estado: {
        erroGeral: 'Confira os campos destacados.',
        errosPorCampo: resultado.error.flatten().fieldErrors as Record<string, string[]>,
      },
    }
  }
  return { sucesso: true, dados: resultado.data }
}

/**
 * Traduz erros do Prisma para mensagens que o operador entenda. Sem isso, uma
 * violação de unicidade chega na tela como "Unique constraint failed on the
 * fields: (`placa`)".
 */
export function traduzirErroPrisma(
  erro: unknown,
  rotulos: Record<string, string> = {},
): EstadoFormulario {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === 'P2002') {
      const campos = (erro.meta?.target as string[] | undefined) ?? []
      const nomes = campos.map((c) => rotulos[c] ?? c)
      const alvo = nomes.length ? nomes.join(' e ') : 'esse registro'
      return {
        erroGeral: `Já existe um cadastro com ${alvo}.`,
        errosPorCampo: Object.fromEntries(campos.map((c) => [c, ['Já está em uso']])),
      }
    }
    if (erro.code === 'P2003') {
      return { erroGeral: 'Registro relacionado não encontrado. Recarregue a página.' }
    }
    if (erro.code === 'P2025') {
      return { erroGeral: 'Registro não encontrado. Ele pode ter sido removido.' }
    }
  }
  console.error(erro)
  return { erroGeral: 'Não foi possível salvar. Tente de novo.' }
}
