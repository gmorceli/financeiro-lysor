/**
 * Seed inicial da Lysor Transportes.
 *
 * Carrega o plano de categorias de transporte (fixo na v1, sem configuração
 * pelo usuário) e os cadastros já confirmados pela cliente em
 * docs/10-respostas-confirmacoes-2026-09-10.md.
 *
 * Idempotente: pode rodar mais de uma vez.
 */
import {
  PrismaClient,
  TipoVeiculo,
  TipoPosse,
  VinculoMotorista,
  ModeloRemuneracao,
  BaseComissao,
} from '@prisma/client'
import { CATEGORIAS, EMPRESA } from './dados-base'

const prisma = new PrismaClient()

const VEICULOS: Array<{
  apelido: string
  placa: string
  tipo: TipoVeiculo
  isentoIpva: boolean
}> = [
  { apelido: 'Scania 440', placa: 'A-DEFINIR-1', tipo: 'CAVALO', isentoIpva: false },
  { apelido: 'Scania Amarela JS4', placa: 'A-DEFINIR-2', tipo: 'CAVALO', isentoIpva: false },
  { apelido: 'FH Cinza', placa: 'A-DEFINIR-3', tipo: 'CAVALO', isentoIpva: true },
  { apelido: 'FH Vermelha', placa: 'A-DEFINIR-4', tipo: 'CAVALO', isentoIpva: true },
  { apelido: 'Truck 1', placa: 'A-DEFINIR-5', tipo: 'TRUCK', isentoIpva: true },
  { apelido: 'Truck 2', placa: 'A-DEFINIR-6', tipo: 'TRUCK', isentoIpva: true },
  { apelido: 'Carreta Viloças', placa: 'A-DEFINIR-7', tipo: 'CARRETA', isentoIpva: false },
  { apelido: 'Carreta 2 andares', placa: 'A-DEFINIR-8', tipo: 'CARRETA', isentoIpva: true },
]

/**
 * Remuneração dos motoristas: 2 só com comissão de 12%, 2 com salário de
 * R$ 2.805,50 mais os mesmos 12%. A comissão incide sobre o frete real.
 */
const MOTORISTAS: Array<{
  nome: string
  cpf: string
  modeloRemuneracao: ModeloRemuneracao
  salarioFixo: number
}> = [
  { nome: 'Motorista 1', cpf: 'A-DEFINIR-1', modeloRemuneracao: 'COMISSAO', salarioFixo: 0 },
  { nome: 'Motorista 2', cpf: 'A-DEFINIR-2', modeloRemuneracao: 'COMISSAO', salarioFixo: 0 },
  { nome: 'Motorista 3', cpf: 'A-DEFINIR-3', modeloRemuneracao: 'HIBRIDO', salarioFixo: 2805.5 },
  { nome: 'Motorista 4', cpf: 'A-DEFINIR-4', modeloRemuneracao: 'HIBRIDO', salarioFixo: 2805.5 },
]

/** Regra de cobrança do agregado: 10% do CT-e + 0,06% do valor da carga. */
const REGRA_COBRANCA_AGREGADO = {
  modelo: 'PERCENTUAL_CTE_MAIS_SEGURO',
  percentualCte: 10.0,
  basePercentual: 'CTE_BRUTO',
  percentualSeguroCarga: 0.06,
  quemPagaCombustivel: 'AGREGADO',
  quemPagaPedagio: 'AGREGADO',
  descontosAplicaveis: [],
  momentoAcerto: 'AO_RECEBER',
} as const

async function main() {
  await prisma.empresa.upsert({
    where: { cnpj: EMPRESA.cnpj },
    update: {},
    create: EMPRESA,
  })

  for (const categoria of CATEGORIAS) {
    await prisma.categoria.upsert({
      where: { nome: categoria.nome },
      update: { tipo: categoria.tipo, nivelCusto: categoria.nivelCusto },
      create: { ...categoria, sistema: true },
    })
  }

  for (const veiculo of VEICULOS) {
    await prisma.veiculo.upsert({
      where: { apelido: veiculo.apelido },
      update: {},
      create: {
        ...veiculo,
        tipoPosse: TipoPosse.PROPRIO,
        isentoLicenciamento: veiculo.isentoIpva,
        odometroAtual: veiculo.tipo === TipoVeiculo.CARRETA ? null : 0,
      },
    })
  }

  for (const motorista of MOTORISTAS) {
    await prisma.motorista.upsert({
      where: { cpf: motorista.cpf },
      update: {},
      create: {
        ...motorista,
        vinculo: VinculoMotorista.CLT,
        percentualComissao: 12,
        baseComissao: BaseComissao.FRETE_REAL,
      },
    })
  }

  await prisma.proprietario.upsert({
    where: { cpfCnpj: 'A-DEFINIR-DORIVAL' },
    update: {},
    create: {
      nome: 'Dorival Osti',
      cpfCnpj: 'A-DEFINIR-DORIVAL',
      tipoPessoa: 'PF',
      regraCobranca: REGRA_COBRANCA_AGREGADO,
    },
  })

  const totais = {
    categorias: await prisma.categoria.count(),
    veiculos: await prisma.veiculo.count(),
    motoristas: await prisma.motorista.count(),
    proprietarios: await prisma.proprietario.count(),
  }
  console.log('Seed concluído:', totais)
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
