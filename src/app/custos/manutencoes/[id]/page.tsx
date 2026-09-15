import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina, Card } from '@/components/ui'
import { FormularioManutencao } from '../../formulario-manutencao'
import { ExcluirManutencao } from './excluir'

export const dynamic = 'force-dynamic'

const texto = (valor: unknown) =>
  valor === null || valor === undefined ? '' : String(valor)

const dia = (valor: Date | null) => (valor ? valor.toISOString().slice(0, 10) : '')

/**
 * Correção de uma manutenção já lançada.
 *
 * Salvar aqui refaz as parcelas no contas a pagar: uma manutenção de R$ 3.500
 * digitada como R$ 350 deixava, além da linha errada na lista, uma conta a
 * pagar errada e um resultado errado. Refazer é recusado se alguma parcela já
 * tem baixa — nesse caso o caminho é estorno, não correção.
 */
export default async function CorrigirManutencao({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const manutencao = await prisma.manutencao.findUnique({ where: { id } })
  if (!manutencao) notFound()

  // Os títulos desta manutenção: as parcelas carimbadas e, nas linhas antigas,
  // o primeiro título apontado pela própria manutenção.
  const titulos = await prisma.lancamento.findMany({
    where: {
      OR: [
        { parcelamentoId: manutencao.id },
        ...(manutencao.lancamentoId ? [{ id: manutencao.lancamentoId }] : []),
      ],
    },
    select: {
      id: true,
      valorPago: true,
      parcelaTotal: true,
      dataVencimento: true,
      formaPagamento: true,
    },
    orderBy: { dataVencimento: 'asc' },
  })

  const [veiculos, fornecedores] = await Promise.all([
    // O veículo desta manutenção entra mesmo se tiver sido vendido ou
    // inativado depois — senão o campo abriria em branco e a correção de um
    // valor viraria, sem querer, a troca do caminhão.
    prisma.veiculo.findMany({
      where: {
        OR: [{ status: { in: ['ATIVO', 'MANUTENCAO'] } }, { id: manutencao.veiculoId }],
      },
      select: { id: true, apelido: true, odometroAtual: true, tipo: true },
      orderBy: { apelido: 'asc' },
    }),
    prisma.fornecedor.findMany({
      where: {
        OR: [
          { ativo: true },
          ...(manutencao.fornecedorId ? [{ id: manutencao.fornecedorId }] : []),
        ],
      },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const pago = titulos.some((t) => Number(t.valorPago) > 0)
  // Forma de pagamento e vencimento moram no título, não na manutenção: é de lá
  // que o formulário tem de reabrir.
  const primeiro = titulos[0]
  const parcelas = primeiro?.parcelaTotal ?? Math.max(1, titulos.length)

  return (
    <>
      <CabecalhoPagina
        titulo="Corrigir manutenção"
        descricao={manutencao.descricao}
      />

      {pago ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-texto">
          <strong className="font-medium text-alerta">
            Já existe pagamento registrado nesta manutenção.
          </strong>{' '}
          Corrigir aqui teria de apagar a conta a pagar para refazê-la, e isso
          sumiria com um pagamento que passou pela conta de verdade. Estorne a baixa
          no financeiro e volte.
        </Card>
      ) : (
        <FormularioManutencao
          veiculos={veiculos}
          fornecedores={fornecedores}
          manutencao={{
            id: manutencao.id,
            veiculoId: manutencao.veiculoId,
            fornecedorId: texto(manutencao.fornecedorId),
            data: dia(manutencao.data),
            odometro: texto(manutencao.odometro),
            tipo: manutencao.tipo,
            descricao: manutencao.descricao,
            valorPecas: texto(manutencao.valorPecas),
            valorServico: texto(manutencao.valorServico),
            formaPagamento: primeiro?.formaPagamento ?? 'BOLETO',
            dataVencimento: dia(primeiro?.dataVencimento ?? null),
            parcelas: String(parcelas),
          }}
        />
      )}

      <ExcluirManutencao
        manutencaoId={manutencao.id}
        descricao={manutencao.descricao}
        parcelas={titulos.length}
        pago={pago}
      />
    </>
  )
}
