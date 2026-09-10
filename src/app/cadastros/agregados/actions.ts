'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { proprietarioSchema } from '@/lib/validacao'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'

export async function salvarAgregado(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(proprietarioSchema, formData)
  if (!validado.sucesso) return validado.estado

  const {
    percentualCte,
    percentualSeguroCarga,
    quemPagaCombustivel,
    quemPagaPedagio,
    ...dados
  } = validado.dados

  const payload = {
    ...dados,
    // O agregado PAGA a Lysor: esta é a regra de cobrança, não de remuneração.
    regraCobranca: {
      modelo: 'PERCENTUAL_CTE_MAIS_SEGURO',
      percentualCte,
      basePercentual: 'CTE_BRUTO',
      percentualSeguroCarga,
      quemPagaCombustivel,
      quemPagaPedagio,
      descontosAplicaveis: [],
      momentoAcerto: 'AO_RECEBER',
    },
  }

  try {
    if (id) {
      await prisma.proprietario.update({ where: { id }, data: payload })
    } else {
      await prisma.proprietario.create({ data: payload })
    }
  } catch (erro) {
    return traduzirErroPrisma(erro, { cpfCnpj: 'esse CPF/CNPJ' })
  }

  revalidatePath('/cadastros/agregados')
  return { ok: true }
}
