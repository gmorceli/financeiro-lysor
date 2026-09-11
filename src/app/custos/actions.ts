'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { abastecimentoSchema, manutencaoSchema } from '@/lib/validacao'
import { arredondar } from '@/lib/calculos'
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
 */
export async function salvarAbastecimento(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAcesso('operacao')
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
    await prisma.$transaction(async (tx) => {
      const lancamento = await tx.lancamento.create({
        data: {
          tipo: 'DESPESA',
          categoriaId,
          descricao: `Abastecimento — ${veiculo.apelido}`,
          valor: new Prisma.Decimal(arredondar(dados.valorTotal)),
          dataCompetencia: dados.data,
          dataVencimento: dados.dataVencimento ?? dados.data,
          veiculoId: dados.veiculoId,
          viagemId: dados.viagemId ?? null,
          fornecedorId: dados.fornecedorId ?? null,
          formaPagamento: dados.formaPagamento,
          observacoes: dados.observacoes ?? null,
        },
        select: { id: true },
      })

      await tx.abastecimento.create({
        data: {
          veiculoId: dados.veiculoId,
          viagemId: dados.viagemId ?? null,
          motoristaId: dados.motoristaId ?? null,
          fornecedorId: dados.fornecedorId ?? null,
          data: dados.data,
          litros: new Prisma.Decimal(dados.litros),
          valorLitro: new Prisma.Decimal(dados.valorLitro.toFixed(4)),
          valorTotal: new Prisma.Decimal(arredondar(dados.valorTotal)),
          odometro: dados.odometro,
          tanqueCheio: dados.tanqueCheio,
          lancamentoId: lancamento.id,
        },
      })

      // O odômetro só avança; um abastecimento antigo lançado depois não pode
      // puxar a leitura do veículo para trás.
      if (
        veiculo.tipo !== 'CARRETA' &&
        dados.odometro > (veiculo.odometroAtual ?? 0)
      ) {
        await tx.veiculo.update({
          where: { id: dados.veiculoId },
          data: { odometroAtual: dados.odometro },
        })
      }
    })
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/custos/abastecimentos')
  if (dados.viagemId) revalidatePath(`/viagens/${dados.viagemId}`)
  redirect(rota(dados.viagemId ? `/viagens/${dados.viagemId}` : '/custos/abastecimentos'))
}

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
  const validado = validarFormulario(manutencaoSchema, formData)
  if (!validado.sucesso) return validado.estado

  const dados = validado.dados
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: dados.veiculoId },
    select: { apelido: true },
  })
  if (!veiculo) return { erroGeral: 'Veículo não encontrado.' }

  const total = arredondar((dados.valorPecas ?? 0) + (dados.valorServico ?? 0))
  const parcelas = Math.max(1, Math.trunc(dados.parcelas ?? 1))
  const categoriaId = await idDaCategoria(
    dados.tipo === 'PNEU' ? CATEGORIA.PNEUS : CATEGORIA.MANUTENCAO,
  )
  const primeiroVencimento = dados.dataVencimento ?? dados.data

  try {
    await prisma.$transaction(async (tx) => {
      const manutencao = await tx.manutencao.create({
        data: {
          veiculoId: dados.veiculoId,
          fornecedorId: dados.fornecedorId ?? null,
          data: dados.data,
          odometro: dados.odometro ?? null,
          tipo: dados.tipo,
          descricao: dados.descricao,
          valorPecas: new Prisma.Decimal(arredondar(dados.valorPecas ?? 0)),
          valorServico: new Prisma.Decimal(arredondar(dados.valorServico ?? 0)),
        },
        select: { id: true },
      })

      const parcelamentoId = parcelas > 1 ? manutencao.id : null
      // A última parcela absorve o resíduo do arredondamento, para a soma das
      // parcelas fechar exatamente com o total.
      const valorParcela = arredondar(total / parcelas)
      const residuo = arredondar(total - valorParcela * parcelas)

      for (let i = 0; i < parcelas; i++) {
        const vencimento = new Date(primeiroVencimento)
        vencimento.setMonth(vencimento.getMonth() + i)
        const ehUltima = i === parcelas - 1

        const lancamento = await tx.lancamento.create({
          data: {
            tipo: 'DESPESA',
            categoriaId,
            descricao:
              parcelas > 1
                ? `${dados.descricao} — ${veiculo.apelido} (${i + 1}/${parcelas})`
                : `${dados.descricao} — ${veiculo.apelido}`,
            valor: new Prisma.Decimal(
              ehUltima ? arredondar(valorParcela + residuo) : valorParcela,
            ),
            dataCompetencia: dados.data,
            dataVencimento: vencimento,
            veiculoId: dados.veiculoId,
            fornecedorId: dados.fornecedorId ?? null,
            formaPagamento: dados.formaPagamento,
            parcelamentoId,
            parcelaNumero: parcelas > 1 ? i + 1 : null,
            parcelaTotal: parcelas > 1 ? parcelas : null,
          },
          select: { id: true },
        })

        // A manutenção aponta para o primeiro título do parcelamento.
        if (i === 0) {
          await tx.manutencao.update({
            where: { id: manutencao.id },
            data: { lancamentoId: lancamento.id },
          })
        }
      }
    })
  } catch (erro) {
    return traduzirErroPrisma(erro)
  }

  revalidatePath('/custos/manutencoes')
  redirect(rota('/custos/manutencoes'))
}
