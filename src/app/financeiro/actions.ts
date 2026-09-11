'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { baixarTitulo, gerarTitulosDoFrete } from '@/lib/titulos'
import { traduzirErroPrisma, type EstadoFormulario } from '@/lib/acoes'
import { exigirAcesso } from '@/lib/sessao'

/**
 * Registra o pagamento ou o recebimento de um título.
 *
 * Quando o título liquidado é um recebível de frete de agregado, a baixa
 * também libera o repasse que estava esperando — é o "acerta quando o cliente
 * paga" virando mecânica.
 */
export async function registrarBaixa(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('financeiro')
  const id = formData.get('lancamentoId')?.toString()
  const dataTexto = formData.get('data')?.toString()
  const valorTexto = formData.get('valor')?.toString()

  if (!id) return { erroGeral: 'Título não identificado.' }
  if (!dataTexto) {
    return { erroGeral: 'Confira os campos.', errosPorCampo: { data: ['Informe a data'] } }
  }

  const valor = Number(valorTexto)
  if (!Number.isFinite(valor) || valor <= 0) {
    return {
      erroGeral: 'Confira os campos.',
      errosPorCampo: { valor: ['Informe um valor maior que zero'] },
    }
  }

  const lancamento = await prisma.lancamento.findUnique({
    where: { id },
    select: { valor: true, valorPago: true, status: true },
  })
  if (!lancamento) return { erroGeral: 'Título não encontrado.' }
  if (lancamento.status === 'LIQUIDADO') {
    return { erroGeral: 'Este título já está liquidado.' }
  }

  const restante = Number(lancamento.valor) - Number(lancamento.valorPago)
  if (valor > restante + 0.01) {
    return {
      erroGeral: 'Confira os campos.',
      errosPorCampo: {
        valor: [
          `Restam apenas ${restante.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })} neste título.`,
        ],
      },
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await baixarTitulo(tx, id, {
        data: new Date(dataTexto),
        valor,
        contaBancariaId: formData.get('contaBancariaId')?.toString() || null,
        observacoes: formData.get('observacoes')?.toString() || null,
      })
    })
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/financeiro')
  revalidatePath('/financeiro/receber')
  revalidatePath('/financeiro/pagar')
  revalidatePath('/')
  return { ok: true }
}

/**
 * Gera os títulos dos fretes lançados antes desta funcionalidade existir.
 * Idempotente por frete: quem já tem título é ignorado.
 */
export async function gerarTitulosPendentes(): Promise<EstadoFormulario> {
  await exigirAcesso('financeiro')
  try {
    const semTitulo = await prisma.frete.findMany({
      where: { status: { not: 'CANCELADO' }, lancamentos: { none: {} } },
      select: { id: true },
    })

    let gerados = 0
    for (const frete of semTitulo) {
      await prisma.$transaction(async (tx) => {
        gerados += await gerarTitulosDoFrete(tx, frete.id)
      })
    }

    revalidatePath('/financeiro')
    revalidatePath('/financeiro/receber')
    return {
      ok: true,
      erroGeral:
        gerados === 0 ? 'Todos os fretes já tinham títulos gerados.' : undefined,
    }
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }
}
