import Link from 'next/link'
import { CabecalhoPagina, Card, Tabela, Td, Th } from '@/components/ui'
import { rota } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Ajuda dentro do sistema.
 *
 * Nasceu de um guia que foi mandado por link e não abriu no celular da cliente.
 * Documento de fora depende de a pessoa achar a mensagem, ter conta e o link
 * sobreviver ao WhatsApp; aqui ela já está logada, e a dúvida aparece no mesmo
 * lugar onde ela trava.
 *
 * Fica de fora o que é transitório — "estas quatro linhas estão erradas" é
 * assunto de conversa, não de tela. O que fica é a regra que continua valendo
 * no mês que vem.
 */

const DEGRAUS = [
  {
    nome: 'Custo da viagem',
    sai: 'sai do lucro do frete',
    exemplos: 'Diesel, pedágio, chapa, lavagem, alimentação na estrada.',
    recuo: '',
  },
  {
    nome: 'Custo do caminhão',
    sai: 'sai do resultado do caminhão',
    exemplos: 'Oficina, peça, pneu, seguro, licenciamento, parcela, rastreador.',
    recuo: 'sm:ml-8',
  },
  {
    nome: 'Custo da empresa',
    sai: 'sai do lucro operacional',
    exemplos: 'Contador, sistema, internet, escritório, impostos.',
    recuo: 'sm:ml-16',
  },
]

const ONDE_LANCAR = [
  {
    gasto: 'Diesel',
    tela: 'Abastecimentos',
    href: '/custos/abastecimentos/novo',
    porque: 'Precisa dos litros e do km do painel para calcular o km/l.',
  },
  {
    gasto: 'Oficina, peça, mão de obra, pneu',
    tela: 'Manutenções',
    href: '/custos/manutencoes/novo',
    porque: 'Separa peça de serviço e aceita parcelamento.',
  },
  {
    gasto: 'Pedágio, chapa, lavagem, alimentação',
    tela: 'Despesas',
    href: '/custos/despesas/nova',
    porque: 'Escolha o tipo em “Custo da viagem” e marque a viagem.',
  },
  {
    gasto: 'Seguro, IPVA, licenciamento, rastreador, parcela',
    tela: 'Despesas',
    href: '/custos/despesas/nova',
    porque: 'Tipos em “Custo do caminhão”. Marque o caminhão.',
  },
  {
    gasto: 'Contador, sistema, internet, imposto',
    tela: 'Despesas',
    href: '/custos/despesas/nova',
    porque: 'Tipos em “Custo da empresa”. Sem caminhão e sem viagem.',
  },
]

export default async function Ajuda() {
  return (
    <>
      <CabecalhoPagina
        titulo="Ajuda"
        descricao="Onde lançar cada custo, e como desfazer o que foi lançado errado."
      />

      <Card className="mb-4 p-4">
        <h2 className="text-sm font-semibold text-texto">O custo desce em três degraus</h2>
        <p className="mt-1 text-sm text-texto-suave">
          O relatório de resultado desconta os custos em ordem. Cada degrau responde uma
          pergunta diferente — por isso o mesmo dinheiro conta uma história diferente
          dependendo de onde entra.
        </p>

        <div className="mt-3 flex flex-col gap-1">
          {DEGRAUS.map((degrau) => (
            <div
              key={degrau.nome}
              className={`rounded-lg border border-borda bg-fundo px-3 py-2 ${degrau.recuo}`}
            >
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-texto">{degrau.nome}</span>
                <span className="text-xs font-medium text-primaria">{degrau.sai}</span>
              </p>
              <p className="mt-0.5 text-sm text-texto-suave">{degrau.exemplos}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-texto-suave">
          Um pedágio lançado como manutenção não some do resultado — ele desce um degrau
          abaixo do lugar dele. O frete parece ter dado mais lucro do que deu, e o
          caminhão parece caro de manter por causa de pedágio.
        </p>
      </Card>

      <Card className="mb-4">
        <div className="border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">Qual tela para cada coisa</h2>
        </div>
        <Tabela>
          <thead>
            <tr>
              <Th>Se o gasto foi…</Th>
              <Th>Lance em</Th>
              <Th>Por quê</Th>
            </tr>
          </thead>
          <tbody>
            {ONDE_LANCAR.map((linha) => (
              <tr key={linha.gasto} className="hover:bg-fundo">
                <Td className="font-medium text-texto">{linha.gasto}</Td>
                <Td>
                  <Link
                    href={rota(linha.href)}
                    className="-my-3 inline-flex min-h-11 items-center font-medium text-primaria hover:underline sm:my-0 sm:min-h-0"
                  >
                    {linha.tela}
                  </Link>
                </Td>
                <Td className="text-texto-suave">{linha.porque}</Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
        <p className="border-t border-borda px-4 py-3 text-xs text-texto-suave">
          Atalho: pedágio, chapa e lavagem de uma viagem específica também podem ser
          lançados de dentro da própria viagem, no botão Despesa. Dá no mesmo — é só
          menos cliques quando você já está com a viagem aberta.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-texto">Errou? Nada fica travado</h2>
        <div className="mt-2 flex flex-col gap-2 text-sm text-texto-suave">
          <p>
            Frete, viagem, abastecimento, manutenção e despesa: cada linha da lista tem um{' '}
            <strong className="font-medium text-texto">Corrigir</strong> na ponta direita.
            Dentro da tela de correção há também o botão de excluir.
          </p>
          <p>
            Corrigir o valor corrige a conta a pagar junto — não precisa mexer no
            financeiro depois. Excluir leva a conta a pagar junto também.
          </p>
          <p>
            <strong className="font-medium text-texto">
              Quando já existe pagamento registrado, o sistema recusa
            </strong>{' '}
            e explica na tela. Não é trava: é que apagar ali sumiria com um valor que
            passou pela conta de verdade. Nesse caso a correção é por estorno — chame
            quem cuida do sistema.
          </p>
          <p>Errar de tela não quebra nada. Tudo dá para desfazer.</p>
        </div>
      </Card>
    </>
  )
}
