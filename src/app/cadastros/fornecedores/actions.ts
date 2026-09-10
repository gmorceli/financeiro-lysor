'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { fornecedorSchema } from '@/lib/validacao'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'

export async function salvarFornecedor(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(fornecedorSchema, formData)
  if (!validado.sucesso) return validado.estado

  const payload = {
    ...validado.dados,
    cpfCnpj: validado.dados.cpfCnpj ?? null,
    tipoPessoa: validado.dados.tipoPessoa ?? null,
  }

  try {
    if (id) {
      await prisma.fornecedor.update({ where: { id }, data: payload })
    } else {
      await prisma.fornecedor.create({ data: payload })
    }
  } catch (erro) {
    return traduzirErroPrisma(erro, { cpfCnpj: 'esse CPF/CNPJ' })
  }

  revalidatePath('/cadastros/fornecedores')
  return { ok: true }
}
