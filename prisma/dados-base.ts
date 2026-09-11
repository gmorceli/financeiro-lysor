/**
 * Dados que não são exemplo: existem no sistema de qualquer instalação.
 *
 * Ficam separados do resto do seed porque o preparo de produção precisa deles e
 * NÃO precisa da frota — plantar oito caminhões com placa de exemplo no banco
 * da cliente daria trabalho para ela desfazer, e veículo não se apaga: sai de
 * operação mudando de status, e continua na lista para sempre.
 */
import { TipoLancamento, NivelCusto } from '@prisma/client'

/** Categorias de transporte. `nivelCusto` define a camada da cascata do DRE. */
export const CATEGORIAS: Array<{
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
  // Nível LIQUIDACAO: entra no caixa, não no resultado. A comissão que este
  // título paga já foi apropriada frete a frete quando o frete aconteceu.
  { nome: 'Acerto de motorista', tipo: 'DESPESA', nivelCusto: 'LIQUIDACAO' },
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

/** Cabeçalho de relatório e parâmetros de rateio. Uma linha só: single-tenant. */
export const EMPRESA = {
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
}
