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
  TipoLancamento,
  NivelCusto,
  TipoVeiculo,
  TipoPosse,
  VinculoMotorista,
  ModeloRemuneracao,
  BaseComissao,
} from '@prisma/client'

const prisma = new PrismaClient()

/** Categorias de transporte. `nivelCusto` define a camada da cascata do DRE. */
const CATEGORIAS: Array<{
  nome: string
  tipo: TipoLancamento
  nivelCusto: NivelCusto
}> = [
  // Receita
  { nome: 'Receita de frete', tipo: 'RECEITA', nivelCusto: 'DIRETO_VIAGEM' },
  { nome: 'Comissão de agregado', tipo: 'RECEITA', nivelCusto: 'DIRETO_VIAGEM' },
  { nome: 'Seguro cobrado de agregado', tipo: 'RECEITA', nivelCusto: 'DIRETO_VIAGEM' },

  // Custo direto da viagem
  { nome: 'Combustível', tipo: 'DESPESA', nivelCusto: 'DIRETO_VIAGEM' },
  { nome: 'Pedágio', tipo: 'DESPESA', nivelCusto: 'DIRETO_VIAGEM' },
  { nome: 'Comissão de motorista', tipo: 'DESPESA', nivelCusto: 'DIRETO_VIAGEM' },
  { nome: 'Despesa de viagem', tipo: 'DESPESA', nivelCusto: 'DIRETO_VIAGEM' },
  { nome: 'Repasse a agregado', tipo: 'DESPESA', nivelCusto: 'DIRETO_VIAGEM' },

  // Custo do veículo
  { nome: 'Manutenção', tipo: 'DESPESA', nivelCusto: 'VEICULO' },
  { nome: 'Pneus', tipo: 'DESPESA', nivelCusto: 'VEICULO' },
  { nome: 'Seguro do veículo', tipo: 'DESPESA', nivelCusto: 'VEICULO' },
  { nome: 'IPVA e licenciamento', tipo: 'DESPESA', nivelCusto: 'VEICULO' },
  { nome: 'ANTT / RNTRC', tipo: 'DESPESA', nivelCusto: 'VEICULO' },
  { nome: 'Financiamento de veículo', tipo: 'DESPESA', nivelCusto: 'VEICULO' },
  { nome: 'Rastreamento', tipo: 'DESPESA', nivelCusto: 'VEICULO' },

  // Overhead
  { nome: 'Salários e encargos', tipo: 'DESPESA', nivelCusto: 'OVERHEAD' },
  { nome: 'Contador', tipo: 'DESPESA', nivelCusto: 'OVERHEAD' },
  { nome: 'Sistemas e software', tipo: 'DESPESA', nivelCusto: 'OVERHEAD' },
  { nome: 'Internet e telefonia', tipo: 'DESPESA', nivelCusto: 'OVERHEAD' },
  { nome: 'Seguro RCTR-C', tipo: 'DESPESA', nivelCusto: 'OVERHEAD' },
  { nome: 'Impostos', tipo: 'DESPESA', nivelCusto: 'OVERHEAD' },
  { nome: 'Administrativo', tipo: 'DESPESA', nivelCusto: 'OVERHEAD' },
]

/**
 * Frota confirmada: 4 cavalos + 2 trucks + 2 carretas.
 * Apelidos vêm das folhas manuscritas — é como a cliente identifica cada um.
 * Placas ficam em branco até o cadastro assistido.
 */
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
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      razaoSocial: 'Lysor Transportes LTDA',
      nomeFantasia: 'Lysor Transportes',
      cnpj: '00.000.000/0001-00',
      dataCorte: new Date('2026-09-01'),
      configRateio: {
        criterioViagemParaFrete: 'VALOR_FRETE',
        criterioVeiculoParaViagem: 'KM_RODADO',
        criterioOverhead: 'PERCENTUAL_RECEITA',
        incluirDepreciacao: false,
      },
    },
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
