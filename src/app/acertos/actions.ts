'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  calcularAcertoMotorista,
  fecharAcertoAgregado,
  fecharAcertoMotorista,
} from '@/lib/acertos'
import { exigirAcesso } from '@/lib/sessao'
import { acertoAgregadoSchema, acertoMotoristaSchema } from '@/lib/validacao'
import {
  traduzirErroPrisma,
  validarFormulario,
  type EstadoFormulario,
} from '@/lib/acoes'

export async function fecharAcertoDoMotorista(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirAcesso('financeiro')

  const validado = validarFormulario(acertoMotoristaSchema, formData)
  if (!validado.sucesso) return validado.estado
  const d = validado.dados

  try {
    // O cálculo é refeito no servidor, do zero. O que veio da tela é só o que a
    // pessoa digitou — adiantamento, desconto, data. Confiar no total que o
    // formulário mandou seria deixar o valor do acerto na mão do navegador.
    const calculado = await calcularAcertoMotorista(d.motoristaId, d.inicio, d.fim)
    await prisma.$transaction((tx) =>
      fecharAcertoMotorista(tx, {
        motoristaId: d.motoristaId,
        inicio: d.inicio,
        fim: d.fim,
        calculado,
        adiantamentos: d.adiantamentos ?? 0,
        descontos: d.descontos ?? 0,
        dataPagamento: d.dataPagamento,
        observacoes: d.observacoes ?? null,
        fechadoPor: usuario.nome,
      }),
    )
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/acertos')
  revalidatePath('/financeiro')
  return { ok: true }
}

export async function fecharAcertoDoAgregado(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirAcesso('financeiro')

  const validado = validarFormulario(acertoAgregadoSchema, formData)
  if (!validado.sucesso) return validado.estado
  const d = validado.dados

  // Checkbox repetido chega como várias entradas de mesmo nome; o schema só vê
  // a última. A lista vem daqui.
  const escolhidos = formData.getAll('titulos').map(String).filter(Boolean)

  try {
    await prisma.$transaction((tx) =>
      fecharAcertoAgregado(tx, {
        proprietarioId: d.proprietarioId,
        lancamentoIds: escolhidos,
        dataPagamento: d.dataPagamento,
        observacoes: d.observacoes ?? null,
        fechadoPor: usuario.nome,
      }),
    )
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/acertos')
  revalidatePath('/financeiro')
  return { ok: true }
}
