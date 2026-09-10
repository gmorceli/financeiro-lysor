'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { clienteSchema } from '@/lib/validacao'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'

export async function salvarCliente(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(clienteSchema, formData)
  if (!validado.sucesso) return validado.estado

  const payload = {
    ...validado.dados,
    cnpj: validado.dados.cnpj ?? null,
    prazoPagamentoDias: validado.dados.prazoPagamentoDias ?? 0,
  }

  try {
    if (id) {
      await prisma.cliente.update({ where: { id }, data: payload })
    } else {
      await prisma.cliente.create({ data: payload })
    }
  } catch (erro) {
    return traduzirErroPrisma(erro, { cnpj: 'esse CNPJ' })
  }

  revalidatePath('/cadastros/clientes')
  return { ok: true }
}
