'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fecharViagemSchema, viagemSchema } from '@/lib/validacao'
import { calcularKm } from '@/lib/calculos'
import { rota } from '@/lib/utils'
import { traduzirErroPrisma, validarFormulario, type EstadoFormulario } from '@/lib/acoes'
import { exigirAcesso } from '@/lib/sessao'
import {
  excluirViagemLogicamente,
  MOTIVOS_EXCLUSAO,
  restaurarViagem,
  type DestinoDespesas,
  type MotivoExclusao,
} from '@/lib/viagens'

export async function criarViagem(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  const validado = validarFormulario(viagemSchema, formData)
  if (!validado.sucesso) return validado.estado

  let novoId: string
  try {
    const viagem = await prisma.viagem.create({
      data: { ...validado.dados, status: 'EM_ANDAMENTO' },
      select: { id: true },
    })
    novoId = viagem.id
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/viagens')
  // Vai direto para o detalhe: o próximo passo é lançar o frete.
  redirect(rota(`/viagens/${novoId}`))
}

export async function atualizarViagem(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  const id = formData.get('id')?.toString()
  if (!id) return { erroGeral: 'Viagem não identificada.' }

  const validado = validarFormulario(viagemSchema, formData)
  if (!validado.sucesso) return validado.estado

  try {
    await prisma.viagem.update({ where: { id }, data: validado.dados })
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }

  revalidatePath(`/viagens/${id}`)
  revalidatePath('/viagens')
  return { ok: true }
}

/**
 * Fecha a viagem e adianta o odômetro do veículo.
 *
 * As duas escritas vão numa transação: um odômetro que avança sem a viagem ter
 * fechado corrompe o cálculo de custo por km de todas as viagens seguintes.
 */
export async function fecharViagem(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  const id = formData.get('id')?.toString()
  if (!id) return { erroGeral: 'Viagem não identificada.' }

  const validado = validarFormulario(fecharViagemSchema, formData)
  if (!validado.sucesso) return validado.estado

  const viagem = await prisma.viagem.findUnique({
    where: { id },
    select: { kmInicial: true, veiculoId: true, veiculo: { select: { tipo: true } } },
  })
  if (!viagem) return { erroGeral: 'Viagem não encontrada.' }

  const { kmFinal, kmCarregado, dataChegada, kmImprodutivo, motivoKmImprodutivo } =
    validado.dados

  // Quem fecha a viagem está com o painel à vista: é a hora de corrigir também
  // a saída, que numa viagem importada de MDF-e veio do cadastro do caminhão.
  const kmSaida = validado.dados.kmInicial ?? viagem.kmInicial

  if (kmFinal < kmSaida) {
    return {
      erroGeral: 'Confira os campos destacados.',
      errosPorCampo: {
        kmFinal: [
          `A chegada não pode ser menor que a saída (${kmSaida.toLocaleString('pt-BR')} km).`,
        ],
      },
    }
  }

  const km = calcularKm(kmSaida, kmFinal, kmCarregado)

  try {
    await prisma.$transaction([
      prisma.viagem.update({
        where: { id },
        data: {
          dataChegada,
          kmInicial: kmSaida,
          kmFinal,
          kmCarregado: km.carregado ?? null,
          kmVazio: km.vazio ?? null,
          kmImprodutivo: kmImprodutivo ?? null,
          motivoKmImprodutivo: motivoKmImprodutivo ?? null,
          status: 'AGUARDANDO_ACERTO',
        },
      }),
      // Carreta não tem odômetro próprio.
      ...(viagem.veiculo.tipo === 'CARRETA'
        ? []
        : [
            prisma.veiculo.update({
              where: { id: viagem.veiculoId },
              data: { odometroAtual: kmFinal },
            }),
          ]),
    ])
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }

  revalidatePath(`/viagens/${id}`)
  revalidatePath('/viagens')
  return { ok: true }
}

/**
 * Reabre uma viagem fechada.
 *
 * É o caminho de volta para o custo que chegou depois: nota do borracheiro na
 * semana seguinte, pedágio que veio na fatura do mês. Sem isso o custo ia parar
 * no menu Custos sem viagem, e a margem daquela viagem ficava alta para sempre.
 *
 * Viagem cujo frete já entrou num acerto de motorista não reabre: mexer nos
 * valores depois do acerto fechado deixaria um pagamento sem lastro.
 */
export async function reabrirViagem(id: string): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  try {
    const acertados = await prisma.frete.count({
      where: { viagemId: id, acertoMotoristaId: { not: null } },
    })
    if (acertados > 0) {
      return {
        erroGeral:
          'Os fretes desta viagem já entraram num acerto de motorista. Refaça o acerto antes de reabrir.',
      }
    }
    const viagem = await prisma.viagem.findUnique({
      where: { id },
      select: { excluidaEm: true },
    })
    if (!viagem) return { erroGeral: 'Viagem não encontrada.' }
    if (viagem.excluidaEm) {
      return { erroGeral: 'Esta viagem foi excluída. Restaure antes de reabrir.' }
    }
    await prisma.viagem.update({ where: { id }, data: { status: 'EM_ANDAMENTO' } })
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }
  revalidatePath(`/viagens/${id}`)
  revalidatePath('/viagens')
  return { ok: true }
}

/**
 * Exclui a viagem lançada por engano.
 *
 * Exige o motivo porque a exclusão é irreversível na prática, mesmo sendo
 * reversível no banco: quem restaura três semanas depois não lembra por que
 * excluiu, e o motivo é a única coisa que responde isso. "Outro" pede texto
 * pelo mesmo motivo — uma lista de quatro opções nunca cobre tudo, e a opção
 * de escape sem explicação vira o atalho que todo mundo escolhe.
 */
export async function excluirViagem(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirAcesso('operacao')

  const id = formData.get('id')?.toString()
  if (!id) return { erroGeral: 'Viagem não identificada.' }

  const escolha = formData.get('motivo')?.toString() as MotivoExclusao | undefined
  if (!escolha || !(escolha in MOTIVOS_EXCLUSAO)) {
    return {
      erroGeral: 'Confira os campos destacados.',
      errosPorCampo: { motivo: ['Diga por que está excluindo'] },
    }
  }

  const detalhe = formData.get('motivoTexto')?.toString().trim() ?? ''
  if (escolha === 'OUTRO' && detalhe === '') {
    return {
      erroGeral: 'Confira os campos destacados.',
      errosPorCampo: { motivoTexto: ['Escreva o motivo'] },
    }
  }

  const motivo =
    escolha === 'OUTRO' ? detalhe : detalhe ? `${MOTIVOS_EXCLUSAO[escolha]} — ${detalhe}` : MOTIVOS_EXCLUSAO[escolha]

  const despesas = (formData.get('despesas')?.toString() ?? 'manter') as DestinoDespesas

  try {
    await prisma.$transaction((tx) =>
      excluirViagemLogicamente(tx, id, { motivo, usuario: usuario.nome, despesas }),
    )
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/viagens')
  revalidatePath(`/viagens/${id}`)
  revalidatePath('/fretes')
  revalidatePath('/financeiro')
  revalidatePath('/relatorios')
  revalidatePath('/')
  // Redireciona no servidor, e não pelo `ok` do formulário: a própria tela de
  // exclusão se redesenha assim que a viagem sai, e por um instante ela dizia
  // "esta viagem já foi excluída" — o que, logo depois de confirmar, lê como
  // erro. A lista é o lugar certo para cair.
  redirect(rota('/viagens'))
}

/** Desfaz a exclusão, para quando o clique caiu na linha de cima. */
export async function restaurarViagemExcluida(id: string): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
  try {
    await prisma.$transaction((tx) => restaurarViagem(tx, id))
  } catch (erro) {
    if (erro instanceof Error && !('code' in erro)) return { erroGeral: erro.message }
    return traduzirErroPrisma(erro)
  }
  revalidatePath('/viagens')
  revalidatePath(`/viagens/${id}`)
  revalidatePath('/fretes')
  revalidatePath('/financeiro')
  revalidatePath('/relatorios')
  revalidatePath('/')
  return { ok: true }
}
