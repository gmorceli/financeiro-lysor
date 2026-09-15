import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina, Card } from '@/components/ui'
import { FormularioAbastecimento } from '../../formulario-abastecimento'
import { ExcluirAbastecimento } from './excluir'

export const dynamic = 'force-dynamic'

const texto = (valor: unknown) =>
  valor === null || valor === undefined ? '' : String(valor)

const dia = (valor: Date | null) => (valor ? valor.toISOString().slice(0, 10) : '')

/**
 * Correção de um abastecimento já lançado.
 *
 * O diesel é o maior custo variável da operação e esta tela é a única fonte
 * dele. Um litro digitado a mais estraga o km/l do caminhão, o custo por km e a
 * margem da viagem — e até aqui não havia como voltar atrás.
 */
export default async function CorrigirAbastecimento({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const abastecimento = await prisma.abastecimento.findUnique({
    where: { id },
    include: {
      // Forma de pagamento, vencimento e observação moram no título: é de lá
      // que o formulário tem de reabrir.
      lancamento: {
        select: {
          valorPago: true,
          formaPagamento: true,
          dataVencimento: true,
          observacoes: true,
        },
      },
      veiculo: { select: { apelido: true } },
    },
  })
  if (!abastecimento) notFound()

  const [veiculos, motoristas, fornecedores] = await Promise.all([
    // O caminhão deste abastecimento entra mesmo se tiver saído de operação
    // depois: senão o campo abriria em branco.
    prisma.veiculo.findMany({
      where: {
        OR: [
          { status: { in: ['ATIVO', 'MANUTENCAO'] }, tipo: { in: ['CAVALO', 'TRUCK'] } },
          { id: abastecimento.veiculoId },
        ],
      },
      select: {
        id: true,
        apelido: true,
        odometroAtual: true,
        abastecimentos: {
          // O próprio abastecimento fica de fora da referência de consumo: ele
          // é o que está sendo corrigido, não a leitura anterior a ele.
          where: { tanqueCheio: true, id: { not: id } },
          orderBy: { odometro: 'desc' },
          take: 1,
          select: { odometro: true },
        },
      },
      orderBy: { apelido: 'asc' },
    }),
    prisma.motorista.findMany({
      where: {
        OR: [
          { ativo: true },
          ...(abastecimento.motoristaId ? [{ id: abastecimento.motoristaId }] : []),
        ],
      },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.fornecedor.findMany({
      where: {
        OR: [
          { ativo: true },
          ...(abastecimento.fornecedorId ? [{ id: abastecimento.fornecedorId }] : []),
        ],
      },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const pago = Number(abastecimento.lancamento?.valorPago ?? 0) > 0

  return (
    <>
      <CabecalhoPagina
        titulo="Corrigir abastecimento"
        descricao={`${abastecimento.veiculo.apelido} · ${abastecimento.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
      />

      {pago ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-texto">
          <strong className="font-medium text-alerta">
            Este abastecimento já foi pago.
          </strong>{' '}
          Corrigir aqui teria de apagar a conta a pagar para refazê-la, e isso sumiria
          com um pagamento que passou pela conta de verdade. Estorne a baixa no
          financeiro e volte.
        </Card>
      ) : (
        <FormularioAbastecimento
          veiculos={veiculos.map((v) => ({
            id: v.id,
            apelido: v.apelido,
            odometroAtual: v.odometroAtual,
            ultimoTanqueCheio: v.abastecimentos[0] ?? null,
          }))}
          motoristas={motoristas}
          fornecedores={fornecedores}
          viagemId={abastecimento.viagemId ?? undefined}
          abastecimento={{
            id: abastecimento.id,
            veiculoId: abastecimento.veiculoId,
            motoristaId: texto(abastecimento.motoristaId),
            fornecedorId: texto(abastecimento.fornecedorId),
            data: dia(abastecimento.data),
            litros: texto(abastecimento.litros),
            valorTotal: texto(abastecimento.valorTotal),
            odometro: texto(abastecimento.odometro),
            tanqueCheio: abastecimento.tanqueCheio,
            formaPagamento: abastecimento.lancamento?.formaPagamento ?? 'BOLETO',
            dataVencimento: dia(abastecimento.lancamento?.dataVencimento ?? null),
            observacoes: texto(abastecimento.lancamento?.observacoes),
          }}
        />
      )}

      <ExcluirAbastecimento
        abastecimentoId={abastecimento.id}
        apelido={abastecimento.veiculo.apelido}
        litros={Number(abastecimento.litros)}
        pago={pago}
      />
    </>
  )
}
