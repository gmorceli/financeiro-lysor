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
    porque: 'O abastecimento é do caminhão, não da viagem — um tanque atende várias.',
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
    porque: 'Escolha o tipo em “Custo da viagem” e marque a viagem. Diesel não vai aqui.',
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
          lançados de dentro da própria viagem, no botão Lançar despesa. Dá no mesmo — é
          só menos cliques quando você já está com a viagem aberta. O diesel é a exceção:
          ele não tem botão dentro da viagem, e é de propósito.
        </p>
      </Card>

      <Card className="mb-4 p-4">
        <h2 className="text-sm font-semibold text-texto">
          Por que o diesel não entra na viagem
        </h2>
        <div className="mt-2 flex flex-col gap-2 text-sm text-texto-suave">
          <p>
            Um tanque cheio roda duas, três viagens. Escolher uma delas jogava o diesel
            inteiro na primeira que o motorista anotou — aquela viagem aparecia no
            prejuízo e as outras, lucrando lindamente. Nenhum dos dois números era
            verdade.
          </p>
          <p>
            Agora o abastecimento é lançado em{' '}
            <Link
              href={rota('/custos/abastecimentos/novo')}
              className="-my-3 inline-flex min-h-11 items-center font-medium text-primaria hover:underline sm:my-0 sm:min-h-0"
            >
              Custos → Abastecimentos
            </Link>
            , amarrado ao caminhão. Ele entra pelo valor exato no resultado daquele
            caminhão no mês, sem divisão nenhuma.
          </p>
          <p>
            O <strong className="font-medium text-texto">resultado por frete</strong>{' '}
            passou a mostrar o lucro <em>antes do diesel</em>: frete menos pedágio, menos
            despesa de estrada, menos comissão. Serve para comparar fretes entre si. Para
            saber se o caminhão está se pagando, é o relatório por caminhão do mês.
          </p>
          <p>
            O km do painel virou opcional — lance mesmo quando o motorista não anotou. Só
            o km/l daquele intervalo deixa de fechar; o custo entra igual.
          </p>
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <h2 className="text-sm font-semibold text-texto">Viagem lançada por engano</h2>
        <div className="mt-2 flex flex-col gap-2 text-sm text-texto-suave">
          <p>
            Na lista de{' '}
            <Link
              href={rota('/viagens')}
              className="-my-3 inline-flex min-h-11 items-center font-medium text-primaria hover:underline sm:my-0 sm:min-h-0"
            >
              Viagens
            </Link>
            , cada linha tem <strong className="font-medium text-texto">Excluir</strong> na
            ponta direita. A tela seguinte mostra data, CT-e, motorista, placa, rota e
            valor antes de confirmar — confira se é essa mesmo, porque o erro comum não é
            excluir sem querer, é excluir a linha de cima.
          </p>
          <p>
            A viagem some das listas, dos relatórios de lucro, do contas a receber e do
            cálculo de comissão. Mas não é apagada: fica registrada com a data, o seu nome
            e o motivo, e o botão{' '}
            <strong className="font-medium text-texto">Mostrar excluídas</strong> no topo
            da lista devolve todas, com{' '}
            <strong className="font-medium text-texto">Restaurar</strong> em cada uma.
          </p>
          <p>
            Se já havia recebimento lançado, ele é estornado junto, e a tela avisa antes.
            Se havia pedágio ou outra despesa na viagem, você escolhe: manter como custo
            do caminhão (o padrão — o dinheiro saiu mesmo) ou excluir junto, quando a
            viagem inteira era duplicata.
          </p>
          <p>
            Uma viagem cuja comissão já foi paga num acerto fechado não exclui. Refaça o
            acerto primeiro — senão fica um pagamento ao motorista sem frete que o
            justifique.
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-texto">Errou? Nada fica travado</h2>
        <div className="mt-2 flex flex-col gap-2 text-sm text-texto-suave">
          <p>
            Frete, abastecimento, manutenção e despesa: cada linha da lista tem um{' '}
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
