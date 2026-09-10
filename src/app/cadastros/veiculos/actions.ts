'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { veiculoSchema } from '@/lib/validacao'
import {
  traduzirErroPrisma,
  validarFormulario,
  type EstadoFormulario,
} from '@/lib/acoes'

const ROTULOS = { apelido: 'esse apelido', placa: 'essa placa' }

export async function salvarVeiculo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(veiculoSchema, formData)
  if (!validado.sucesso) return validado.estado

  const { proprietarioId, ...dados } = validado.dados
  const payload = {
    ...dados,
    // Carreta é rebocada: nunca acumula odômetro próprio.
    odometroAtual: dados.tipo === 'CARRETA' ? null : (dados.odometroAtual ?? 0),
    proprietarioId: dados.tipoPosse === 'AGREGADO' ? proprietarioId : null,
  }

  try {
    if (id) {
      await prisma.veiculo.update({ where: { id }, data: payload })
    } else {
      await prisma.veiculo.create({ data: payload })
    }
  } catch (erro) {
    return traduzirErroPrisma(erro, ROTULOS)
  }

  revalidatePath('/cadastros/veiculos')
  return { ok: true }
}

/**
 * Veículo nunca é apagado: ele carrega histórico de viagem e de custo. Sair de
 * operação é mudança de status.
 */
export async function inativarVeiculo(id: string): Promise<EstadoFormulario> {
  try {
    await prisma.veiculo.update({ where: { id }, data: { status: 'INATIVO' } })
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }
  revalidatePath('/cadastros/veiculos')
  return { ok: true }
}

export async function reativarVeiculo(id: string): Promise<EstadoFormulario> {
  try {
    await prisma.veiculo.update({ where: { id }, data: { status: 'ATIVO' } })
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }
  revalidatePath('/cadastros/veiculos')
  return { ok: true }
}
