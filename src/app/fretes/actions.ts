'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { freteAgregadoSchema, freteProprioSchema } from '@/lib/validacao'
import { calcularCobrancaAgregado, type RegraCobrancaAgregado } from '@/lib/calculos'
import { gerarTitulosDoFrete } from '@/lib/titulos'
import { rota } from '@/lib/utils'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'
import { exigirAcesso } from '@/lib/sessao'

const ROTULOS = { chaveCte: 'essa chave de CT-e' }

/** Frete rodado por caminhão da Lysor, sempre dentro de uma viagem. */
export async function salvarFreteProprio(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(freteProprioSchema, formData)
  if (!validado.sucesso) return validado.estado

  const { viagemId, ...dados } = validado.dados
  const payload = {
    ...dados,
    viagemId,
    modalidade: 'FROTA_PROPRIA' as const,
    chaveCte: dados.chaveCte ?? null,
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (id) {
        await tx.frete.update({ where: { id }, data: payload })
      } else {
        const frete = await tx.frete.create({ data: payload, select: { id: true } })
        // O recebível do cliente nasce junto com o frete.
        await gerarTitulosDoFrete(tx, frete.id)
      }
    })
  } catch (erro) {
    return traduzirErroPrisma(erro, ROTULOS)
  }

  revalidatePath(`/viagens/${viagemId}`)
  revalidatePath('/fretes')
  revalidatePath('/financeiro')
  redirect(rota(`/viagens/${viagemId}`))
}

/**
 * Frete rodado por agregado. Não há viagem da Lysor: o caminhão é dele.
 *
 * A comissão e o seguro são recalculados aqui a partir da regra cadastrada, e
 * não aceitos do formulário — o que a tela mostra é conferência, não entrada.
 */
export async function salvarFreteAgregado(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(freteAgregadoSchema, formData)
  if (!validado.sucesso) return validado.estado

  const { proprietarioId, valorCargaNfe, valorCte, ...dados } = validado.dados

  const proprietario = await prisma.proprietario.findUnique({
    where: { id: proprietarioId },
    select: { regraCobranca: true },
  })
  if (!proprietario) {
    return {
      erroGeral: 'Confira os campos destacados.',
      errosPorCampo: { proprietarioId: ['Agregado não encontrado'] },
    }
  }

  const cobranca = calcularCobrancaAgregado(
    valorCte,
    valorCargaNfe,
    proprietario.regraCobranca as RegraCobrancaAgregado,
  )

  const payload = {
    ...dados,
    proprietarioId,
    valorCte,
    valorCargaNfe,
    // No frete de agregado o valor do CT-e é o do documento; a Lysor não
    // negocia o frete, então não há um "valor real" distinto a registrar.
    valorFreteReal: valorCte,
    valorComissaoAgregado: cobranca.comissao,
    valorSeguroAgregado: cobranca.seguro,
    modalidade: 'AGREGADO' as const,
    chaveCte: dados.chaveCte ?? null,
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (id) {
        await tx.frete.update({ where: { id }, data: payload })
      } else {
        const frete = await tx.frete.create({ data: payload, select: { id: true } })
        await gerarTitulosDoFrete(tx, frete.id)
      }
    })
  } catch (erro) {
    return traduzirErroPrisma(erro, ROTULOS)
  }

  revalidatePath('/fretes')
  revalidatePath('/financeiro')
  redirect(rota('/fretes'))
}

export async function excluirFrete(id: string): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  try {
    const frete = await prisma.frete.findUnique({
      where: { id },
      select: { viagemId: true, _count: { select: { lancamentos: true } } },
    })
    if (!frete) return { erroGeral: 'Frete não encontrado.' }

    // Frete que já gerou título financeiro não se apaga: cancela.
    if (frete._count.lancamentos > 0) {
      await prisma.frete.update({ where: { id }, data: { status: 'CANCELADO' } })
    } else {
      await prisma.frete.delete({ where: { id } })
    }

    if (frete.viagemId) revalidatePath(`/viagens/${frete.viagemId}`)
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/fretes')
  return { ok: true }
}
