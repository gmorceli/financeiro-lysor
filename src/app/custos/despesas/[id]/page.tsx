import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DESPESA_AVULSA } from '@/lib/custos'
import { CabecalhoPagina, Card } from '@/components/ui'
import { FormularioDespesa } from '../../formulario-despesa'
import { opcoesDaDespesa } from '../consultas'
import { ExcluirDespesa } from './excluir'

export const dynamic = 'force-dynamic'

const texto = (valor: unknown) =>
  valor === null || valor === undefined ? '' : String(valor)

const dia = (valor: Date | null) => (valor ? valor.toISOString().slice(0, 10) : '')

export default async function CorrigirDespesa({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // O mesmo filtro que a gravação usa: o título de um frete, de um
  // abastecimento ou de uma manutenção não se edita por aqui, nem quando o id
  // é colado na barra de endereço.
  const despesa = await prisma.lancamento.findFirst({
    where: { id, ...DESPESA_AVULSA },
    include: { categoria: { select: { nome: true } } },
  })
  if (!despesa) notFound()

  const opcoes = await opcoesDaDespesa()
  const pago = Number(despesa.valorPago) > 0

  return (
    <>
      <CabecalhoPagina titulo="Corrigir despesa" descricao={despesa.descricao} />

      {pago ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-texto">
          <strong className="font-medium text-alerta">
            Esta despesa já foi paga.
          </strong>{' '}
          Corrigir agora mexeria num valor que passou pela conta de verdade. Estorne a
          baixa no financeiro e volte.
        </Card>
      ) : (
        <FormularioDespesa
          {...opcoes}
          despesa={{
            id: despesa.id,
            categoriaId: despesa.categoriaId,
            viagemId: texto(despesa.viagemId),
            veiculoId: texto(despesa.veiculoId),
            fornecedorId: texto(despesa.fornecedorId),
            data: dia(despesa.dataCompetencia),
            descricao: despesa.descricao,
            valor: texto(despesa.valor),
            formaPagamento: texto(despesa.formaPagamento) || 'DINHEIRO',
            dataVencimento: dia(despesa.dataVencimento),
            observacoes: texto(despesa.observacoes),
          }}
        />
      )}

      <ExcluirDespesa despesaId={despesa.id} descricao={despesa.descricao} pago={pago} />
    </>
  )
}
