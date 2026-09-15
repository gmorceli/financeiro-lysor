'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { abastecimentoSchema, manutencaoSchema } from '@/lib/validacao'
import {
  apagarAbastecimento,
  apagarManutencao,
  gravarAbastecimento,
  gravarManutencao,
} from '@/lib/custos'
import { CATEGORIA, idDaCategoria } from '@/lib/categorias'
import { rota } from '@/lib/utils'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'
import { exigirAcesso } from '@/lib/sessao'

/**
 * Todo custo lançado vira um título financeiro na mesma transação.
 *
 * É o desenho central do sistema: não existe "registrar a despesa" e depois
 * "lançar a conta a pagar". Um registro só, com competência, vencimento e
 * pagamento separados — assim o relatório gerencial e o financeiro não têm
 * como divergir.
 *
 * O miolo — gravar, refazer os títulos e apagar — mora em `@/lib/custos`.
 * Aqui fica só o que é da requisição: permissão, validação e para onde voltar.
 */
export async function salvarAbastecimento(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(abastecimentoSchema, formData)
  if (!validado.sucesso) return validado.estado

  const dados = validado.dados
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: dados.veiculoId },
    select: { tipo: true, apelido: true, odometroAtual: true },
  })
  if (!veiculo) return { erroGeral: 'Veículo não encontrado.' }

  const categoriaId = await idDaCategoria(CATEGORIA.COMBUSTIVEL)

  try {
    await prisma.$transaction((tx) =>
      gravarAbastecimento(tx, {
        id,
        categoriaId,
        veiculo,
        dados: {
          ...dados,
          valorLitro: dados.valorTotal / dados.litros,
          viagemId: dados.viagemId ?? null,
          motoristaId: dados.motoristaId ?? null,
          fornecedorId: dados.fornecedorId ?? null,
          dataVencimento: dados.dataVencimento ?? null,
          observacoes: dados.observacoes ?? null,
        },
      }),
    )
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/custos/abastecimentos')
  if (dados.viagemId) revalidatePath(`/viagens/${dados.viagemId}`)
  revalidatePath('/financeiro')
  redirect(rota(dados.viagemId ? `/viagens/${dados.viagemId}` : '/custos/abastecimentos'))
}

export async function excluirAbastecimento(id: string): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  try {
    await prisma.$transaction((tx) => apagarAbastecimento(tx, id))
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }
  revalidatePath('/custos/abastecimentos')
  revalidatePath('/financeiro')
  return { ok: true }
}

/**
 * Manutenção. Peças e mão de obra viram um título só, opcionalmente
 * parcelado — as folhas da cliente trazem "parcelado cartão" e "parcelado
 * boleto" ao lado das despesas de oficina.
 */
/**
 * Manutenção. Peças e mão de obra viram um título só, opcionalmente
 * parcelado — as folhas da cliente trazem "parcelado cartão" e "parcelado
 * boleto" ao lado das despesas de oficina.
 */
export async function salvarManutencao(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  const id = formData.get('id')?.toString() || undefined
  const validado = validarFormulario(manutencaoSchema, formData)
  if (!validado.sucesso) return validado.estado

  const dados = validado.dados
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: dados.veiculoId },
    select: { apelido: true },
  })
  if (!veiculo) return { erroGeral: 'Veículo não encontrado.' }

  const categoriaId = await idDaCategoria(
    dados.tipo === 'PNEU' ? CATEGORIA.PNEUS : CATEGORIA.MANUTENCAO,
  )

  try {
    await prisma.$transaction((tx) =>
      gravarManutencao(tx, {
        id,
        categoriaId,
        apelidoVeiculo: veiculo.apelido,
        dados: {
          ...dados,
          fornecedorId: dados.fornecedorId ?? null,
          odometro: dados.odometro ?? null,
          dataVencimento: dados.dataVencimento ?? null,
        },
      }),
    )
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/custos/manutencoes')
  revalidatePath('/financeiro')
  redirect(rota('/custos/manutencoes'))
}

export async function excluirManutencao(id: string): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  try {
    await prisma.$transaction((tx) => apagarManutencao(tx, id))
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }
  revalidatePath('/custos/manutencoes')
  revalidatePath('/financeiro')
  return { ok: true }
}
