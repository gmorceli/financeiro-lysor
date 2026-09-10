'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { despesaViagemSchema } from '@/lib/validacao'
import { arredondar } from '@/lib/calculos'
import { rota } from '@/lib/utils'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'

/**
 * Despesa avulsa de viagem: pedágio, chapa, lavagem, alimentação.
 *
 * Vira um título apropriado à viagem e ao veículo, para entrar na camada de
 * custo direto da cascata.
 */
export async function salvarDespesaViagem(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validado = validarFormulario(despesaViagemSchema, formData)
  if (!validado.sucesso) return validado.estado

  const dados = validado.dados
  const viagem = await prisma.viagem.findUnique({
    where: { id: dados.viagemId },
    select: { veiculoId: true },
  })
  if (!viagem) return { erroGeral: 'Viagem não encontrada.' }

  try {
    await prisma.lancamento.create({
      data: {
        tipo: 'DESPESA',
        categoriaId: dados.categoriaId,
        descricao: dados.descricao,
        valor: new Prisma.Decimal(arredondar(dados.valor)),
        dataCompetencia: dados.data,
        dataVencimento: dados.dataVencimento ?? dados.data,
        viagemId: dados.viagemId,
        veiculoId: viagem.veiculoId,
        fornecedorId: dados.fornecedorId ?? null,
        formaPagamento: dados.formaPagamento,
      },
    })
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }

  revalidatePath(`/viagens/${dados.viagemId}`)
  redirect(rota(`/viagens/${dados.viagemId}`))
}

export async function excluirLancamento(id: string): Promise<EstadoFormulario> {
  try {
    const lancamento = await prisma.lancamento.findUnique({
      where: { id },
      select: { viagemId: true, dataPagamento: true },
    })
    if (!lancamento) return { erroGeral: 'Lançamento não encontrado.' }

    // Título já pago é imutável: a correção se faz por estorno.
    if (lancamento.dataPagamento) {
      return {
        erroGeral: 'Este lançamento já foi pago. Faça um estorno em vez de excluir.',
      }
    }

    await prisma.lancamento.delete({ where: { id } })
    if (lancamento.viagemId) revalidatePath(`/viagens/${lancamento.viagemId}`)
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }
  return { ok: true }
}
