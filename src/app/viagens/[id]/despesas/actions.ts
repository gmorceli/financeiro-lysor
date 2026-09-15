'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { despesaViagemSchema } from '@/lib/validacao'
import { apagarDespesa, gravarDespesa } from '@/lib/custos'
import { rota } from '@/lib/utils'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'
import { exigirAcesso } from '@/lib/sessao'

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
  await exigirAcesso('operacao')
  const validado = validarFormulario(despesaViagemSchema, formData)
  if (!validado.sucesso) return validado.estado

  const dados = validado.dados
  const viagem = await prisma.viagem.findUnique({
    where: { id: dados.viagemId },
    select: { veiculoId: true },
  })
  if (!viagem) return { erroGeral: 'Viagem não encontrada.' }

  try {
    // Mesma gravação da tela de Despesas do menu Custos: uma função só, para as
    // duas portas não divergirem com o tempo.
    await prisma.$transaction((tx) =>
      gravarDespesa(tx, {
        dados: {
          ...dados,
          viagemId: dados.viagemId,
          fornecedorId: dados.fornecedorId ?? null,
          dataVencimento: dados.dataVencimento ?? null,
        },
      }),
    )
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }

  revalidatePath(`/viagens/${dados.viagemId}`)
  redirect(rota(`/viagens/${dados.viagemId}`))
}

export async function excluirLancamento(id: string): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  try {
    const lancamento = await prisma.lancamento.findUnique({
      where: { id },
      select: { viagemId: true },
    })
    if (!lancamento) return { erroGeral: 'Lançamento não encontrado.' }

    /*
      Delegado para a mesma função da tela de Despesas, que recusa o que tem
      dono em outro lugar. Antes esta ação apagava qualquer título: o do
      abastecimento ia junto, deixando o abastecimento apontando para um
      registro que não existia mais — ou estourando a referência com um erro
      que não dizia nada.
    */
    await prisma.$transaction((tx) => apagarDespesa(tx, id))
    if (lancamento.viagemId) revalidatePath(`/viagens/${lancamento.viagemId}`)
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }
  return { ok: true }
}
