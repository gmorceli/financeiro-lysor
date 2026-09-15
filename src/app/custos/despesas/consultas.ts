import { prisma } from '@/lib/prisma'
import { CAMADA_DO_CUSTO, CATEGORIAS_COM_TELA_PROPRIA } from '@/lib/categorias'
import type { GrupoDeCategorias } from '../formulario-despesa'

/**
 * As opções do formulário de despesa, montadas no servidor.
 *
 * O agrupamento é por camada da cascata, na ordem em que a cascata é lida:
 * viagem, caminhão, empresa. Quem escolhe "Pedágio" vê, ao lado, que aquilo sai
 * do lucro do frete — que é a informação que faltava quando tudo virava
 * "manutenção".
 */
const ORDEM = ['DIRETO_VIAGEM', 'VEICULO', 'OVERHEAD'] as const

export async function opcoesDaDespesa() {
  const [categorias, viagens, veiculos, fornecedores] = await Promise.all([
    prisma.categoria.findMany({
      where: {
        tipo: 'DESPESA',
        ativo: true,
        nome: { notIn: CATEGORIAS_COM_TELA_PROPRIA },
        nivelCusto: { in: [...ORDEM] },
      },
      select: { id: true, nome: true, nivelCusto: true },
      orderBy: { nome: 'asc' },
    }),
    // Viagens recentes bastam: pedágio de viagem de seis meses atrás não se
    // lança hoje, e uma lista com tudo não rola no celular.
    prisma.viagem.findMany({
      orderBy: { dataSaida: 'desc' },
      take: 40,
      select: {
        id: true,
        numero: true,
        dataSaida: true,
        origem: true,
        destino: true,
        veiculo: { select: { apelido: true } },
      },
    }),
    prisma.veiculo.findMany({
      where: { status: { in: ['ATIVO', 'MANUTENCAO'] } },
      select: { id: true, apelido: true },
      orderBy: { apelido: 'asc' },
    }),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const grupos: GrupoDeCategorias[] = ORDEM.map((camada) => ({
    titulo: CAMADA_DO_CUSTO[camada].titulo,
    explicacao: CAMADA_DO_CUSTO[camada].explicacao,
    categorias: categorias
      .filter((c) => c.nivelCusto === camada)
      .map((c) => ({ id: c.id, nome: c.nome, camada })),
  })).filter((g) => g.categorias.length > 0)

  return {
    grupos,
    viagens: viagens.map((v) => ({
      id: v.id,
      rotulo: `${v.numero} · ${v.veiculo.apelido} · ${v.origem} → ${v.destino} · ${v.dataSaida.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
    })),
    veiculos,
    fornecedores,
  }
}
