/**
 * Percorre o fluxo operacional inteiro contra o banco: abre viagem, lança
 * frete próprio, fecha a viagem, lança frete de agregado e confere os números.
 */
import { PrismaClient } from '@prisma/client'
import {
  calcularCobrancaAgregado,
  calcularComissaoMotorista,
  calcularKm,
} from '../src/lib/calculos'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

async function main() {
  // Limpa execuções anteriores deste roteiro.
  await prisma.frete.deleteMany({ where: { observacoes: 'teste-fluxo' } })
  await prisma.viagem.deleteMany({ where: { observacoes: 'teste-fluxo' } })

  const cliente = await prisma.cliente.upsert({
    where: { cnpj: '11222333000144' },
    update: {},
    create: {
      razaoSocial: 'Frigorífico Teste LTDA',
      cnpj: '11222333000144',
      prazoPagamentoDias: 15,
    },
  })
  const veiculo = await prisma.veiculo.findFirstOrThrow({ where: { apelido: 'FH Vermelha' } })
  const motorista = await prisma.motorista.findFirstOrThrow({
    where: { modeloRemuneracao: 'HIBRIDO' },
  })
  const agregado = await prisma.proprietario.findFirstOrThrow()

  const odometroAntes = veiculo.odometroAtual ?? 0

  // --- 1. Abre a viagem -----------------------------------------------------
  const viagem = await prisma.viagem.create({
    data: {
      veiculoId: veiculo.id,
      motoristaId: motorista.id,
      dataSaida: new Date('2026-09-10'),
      kmInicial: odometroAntes,
      origem: 'Nova Mutum',
      destino: 'Várzea Grande',
      status: 'EM_ANDAMENTO',
      observacoes: 'teste-fluxo',
    },
  })
  checar('viagem aberta com número sequencial', viagem.numero > 0, `nº ${viagem.numero}`)
  checar('km inicial veio do odômetro', viagem.kmInicial === odometroAntes)

  // --- 2. Frete próprio, com CT-e abaixo do valor combinado -----------------
  const frete = await prisma.frete.create({
    data: {
      viagemId: viagem.id,
      clienteId: cliente.id,
      modalidade: 'FROTA_PROPRIA',
      origem: 'Nova Mutum',
      destino: 'Várzea Grande',
      produto: 'Bovinos',
      cabecas: 78,
      valorCte: 5970,
      valorFreteReal: 9564, // 5.970 + 3.594 de complemento, como nas folhas
      dataEmissao: new Date('2026-09-10'),
      observacoes: 'teste-fluxo',
    },
  })
  checar('frete próprio guarda os dois valores', Number(frete.valorCte) === 5970 && Number(frete.valorFreteReal) === 9564)

  const comissao = calcularComissaoMotorista(
    Number(frete.valorFreteReal),
    Number(frete.valorCte),
    Number(motorista.percentualComissao),
    motorista.baseComissao,
  )
  checar(
    'comissão de 12% incide sobre o frete real, não sobre o CT-e',
    comissao === 1147.68,
    `R$ ${comissao} (sobre o CT-e daria R$ ${(5970 * 0.12).toFixed(2)})`,
  )

  // --- 3. Fecha a viagem ----------------------------------------------------
  const kmFinal = odometroAntes + 796 // 398 carregado + 398 vazio
  const km = calcularKm(viagem.kmInicial, kmFinal, 398)
  checar('km rodado calculado', km.rodado === 796)
  checar('km vazio sai do que não foi carregado', km.vazio === 398)

  await prisma.$transaction([
    prisma.viagem.update({
      where: { id: viagem.id },
      data: {
        dataChegada: new Date('2026-09-11'),
        kmFinal,
        kmCarregado: km.carregado,
        kmVazio: km.vazio,
        status: 'AGUARDANDO_ACERTO',
      },
    }),
    prisma.veiculo.update({
      where: { id: veiculo.id },
      data: { odometroAtual: kmFinal },
    }),
  ])

  const veiculoDepois = await prisma.veiculo.findUniqueOrThrow({ where: { id: veiculo.id } })
  checar('odômetro do veículo avançou no fechamento', veiculoDepois.odometroAtual === kmFinal)

  const viagemFechada = await prisma.viagem.findUniqueOrThrow({ where: { id: viagem.id } })
  checar('viagem foi para aguardando acerto', viagemFechada.status === 'AGUARDANDO_ACERTO')

  // --- 4. Frete de agregado -------------------------------------------------
  const regra = agregado.regraCobranca as { percentualCte?: number; percentualSeguroCarga?: number }
  const cobranca = calcularCobrancaAgregado(11642, 528550, regra)

  const freteAgregado = await prisma.frete.create({
    data: {
      clienteId: cliente.id,
      proprietarioId: agregado.id,
      modalidade: 'AGREGADO',
      fluxoFinanceiro: 'INTERMEDIADO',
      origem: 'Porto Estrela',
      destino: 'Várzea Grande',
      valorCte: 11642,
      valorFreteReal: 11642,
      valorCargaNfe: 528550,
      valorComissaoAgregado: cobranca.comissao,
      valorSeguroAgregado: cobranca.seguro,
      dataEmissao: new Date('2026-08-27'),
      observacoes: 'teste-fluxo',
    },
  })

  checar('frete de agregado não pertence a viagem', freteAgregado.viagemId === null)
  checar(
    'cobrança do agregado bate com o acerto do Dorival',
    Number(freteAgregado.valorComissaoAgregado) === 1164.2 &&
      Number(freteAgregado.valorSeguroAgregado) === 317.13,
    `R$ ${cobranca.total}`,
  )

  // --- 5. Receita por modalidade -------------------------------------------
  const proprios = await prisma.frete.findMany({
    where: { modalidade: 'FROTA_PROPRIA', observacoes: 'teste-fluxo' },
  })
  const agregados = await prisma.frete.findMany({
    where: { modalidade: 'AGREGADO', observacoes: 'teste-fluxo' },
  })
  const receitaPropria = proprios.reduce((s, f) => s + Number(f.valorFreteReal), 0)
  const receitaAgregado = agregados.reduce(
    (s, f) => s + Number(f.valorComissaoAgregado ?? 0) + Number(f.valorSeguroAgregado ?? 0),
    0,
  )
  checar('receita da frota própria é o frete real', receitaPropria === 9564)
  checar(
    'receita de agregado é só comissão + seguro, não o CT-e cheio',
    receitaAgregado === 1481.33,
    `R$ ${receitaAgregado} (o CT-e é R$ 11.642)`,
  )

  console.log(falhas === 0 ? '\nFluxo completo passou.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
