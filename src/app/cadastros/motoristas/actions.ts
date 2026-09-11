'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { motoristaSchema } from '@/lib/validacao'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'
import { exigirAcesso } from '@/lib/sessao'

export async function salvarMotorista(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('cadastros')
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(motoristaSchema, formData)
  if (!validado.sucesso) return validado.estado

  const { veiculoPadraoId, ...dados } = validado.dados
  const payload = {
    ...dados,
    salarioFixo: dados.salarioFixo ?? 0,
    percentualComissao: dados.percentualComissao ?? 0,
    valorDiaria: dados.valorDiaria ?? 0,
    veiculoPadraoId: veiculoPadraoId ?? null,
  }

  try {
    if (id) {
      await prisma.motorista.update({ where: { id }, data: payload })
    } else {
      await prisma.motorista.create({ data: payload })
    }
  } catch (erro) {
    return traduzirErroPrisma(erro, { cpf: 'esse CPF' })
  }

  revalidatePath('/cadastros/motoristas')
  return { ok: true }
}
