import type { PerfilUsuario } from '@prisma/client'

/**
 * Permissão por área, não por tela.
 *
 * Tela é detalhe que muda toda semana; área é a divisão real do trabalho na
 * Lysor. A tabela abaixo é a única fonte da verdade — o menu, os layouts e as
 * actions todos leem daqui, então não existe o caso de a tela esconder um botão
 * que a action ainda aceita.
 */
export const AREAS = {
  /** Viagem, frete, abastecimento, manutenção, despesa de viagem. */
  operacao: ['ADMIN', 'FINANCEIRO', 'OPERACAO'],
  /** Veículo, motorista, cliente, agregado, fornecedor. */
  cadastros: ['ADMIN', 'FINANCEIRO', 'OPERACAO'],
  /** Contas a pagar e a receber, baixa de título, fluxo de caixa. */
  financeiro: ['ADMIN', 'FINANCEIRO'],
  /** O DRE em cascata, por caminhão e por frete. */
  resultado: ['ADMIN', 'FINANCEIRO'],
  /** Criar usuário, trocar perfil, redefinir senha. */
  usuarios: ['ADMIN'],
} as const satisfies Record<string, readonly PerfilUsuario[]>

export type Area = keyof typeof AREAS

export function podeAcessar(perfil: PerfilUsuario, area: Area): boolean {
  return (AREAS[area] as readonly PerfilUsuario[]).includes(perfil)
}

/**
 * MOTORISTA existe no enum para o app do motorista, que não faz parte deste
 * MVP — não há uma única área que esse perfil alcance. Em vez de deixar a
 * pessoa entrar e encontrar tudo bloqueado, o login recusa na porta e diz o
 * motivo.
 */
export function temAlgumAcesso(perfil: PerfilUsuario): boolean {
  return (Object.keys(AREAS) as Area[]).some((area) => podeAcessar(perfil, area))
}

export const ROTULOS_PERFIL: Record<PerfilUsuario, string> = {
  ADMIN: 'Administrador',
  FINANCEIRO: 'Financeiro',
  OPERACAO: 'Operação',
  MOTORISTA: 'Motorista',
}

export const DESCRICOES_PERFIL: Record<PerfilUsuario, string> = {
  ADMIN: 'Tudo, mais o cadastro de usuários.',
  FINANCEIRO: 'Operação, financeiro e resultado. Não mexe em usuários.',
  OPERACAO: 'Viagem, frete, custo e cadastros. Não vê financeiro nem resultado.',
  MOTORISTA: 'Reservado para o aplicativo do motorista, que ainda não existe.',
}

type ItemNavegacao = { href: string; rotulo: string; area: Area }

const NAVEGACAO: readonly ItemNavegacao[] = [
  { href: '/viagens', rotulo: 'Viagens', area: 'operacao' },
  { href: '/fretes', rotulo: 'Fretes', area: 'operacao' },
  { href: '/custos', rotulo: 'Custos', area: 'operacao' },
  { href: '/financeiro', rotulo: 'Financeiro', area: 'financeiro' },
  { href: '/acertos', rotulo: 'Acertos', area: 'financeiro' },
  { href: '/relatorios', rotulo: 'Resultado', area: 'resultado' },
  { href: '/cadastros/veiculos', rotulo: 'Veículos', area: 'cadastros' },
  { href: '/cadastros/motoristas', rotulo: 'Motoristas', area: 'cadastros' },
  { href: '/cadastros/clientes', rotulo: 'Clientes', area: 'cadastros' },
  { href: '/cadastros/agregados', rotulo: 'Agregados', area: 'cadastros' },
  { href: '/cadastros/fornecedores', rotulo: 'Fornecedores', area: 'cadastros' },
  { href: '/usuarios', rotulo: 'Usuários', area: 'usuarios' },
]

export function navegacaoDoPerfil(perfil: PerfilUsuario) {
  return NAVEGACAO.filter((item) => podeAcessar(perfil, item.area))
}
