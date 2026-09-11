import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { RegraCobrancaAgregado } from '@/lib/calculos'
import { CabecalhoPagina, Card } from '@/components/ui'
import { FormularioFreteProprio } from '../formulario-frete-proprio'
import { FormularioFreteAgregado } from '../formulario-frete-agregado'
import { CancelarFrete } from './cancelar'

export const dynamic = 'force-dynamic'

/** Decimal, número ou nulo do banco vira o texto que um `<input>` entende. */
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor)
}

/** Coluna `date` vira "2026-09-11". */
function dia(valor: Date | null): string {
  return valor ? valor.toISOString().slice(0, 10) : ''
}

/**
 * Correção de um frete já lançado.
 *
 * Existe porque digitar errado é normal e desfazer não era possível: o valor
 * do CT-e ia para o resultado, para a comissão do motorista e para a cobrança
 * do cliente, e não havia nenhuma tela que voltasse atrás. Salvar aqui refaz
 * os títulos do frete — e recusa a correção se algum deles já tem baixa.
 */
export default async function CorrigirFrete({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [frete, clientes, agregados] = await Promise.all([
    prisma.frete.findUnique({
      where: { id },
      include: {
        viagem: { select: { id: true, numero: true, veiculo: { select: { apelido: true } } } },
        lancamentos: { select: { id: true, valorPago: true, acertoId: true, status: true } },
      },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: { id: true, razaoSocial: true, nomeFantasia: true },
      orderBy: { razaoSocial: 'asc' },
    }),
    prisma.proprietario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, regraCobranca: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  if (!frete) notFound()

  const listaClientes = clientes.map((c) => ({
    id: c.id,
    nome: c.nomeFantasia || c.razaoSocial,
  }))

  const referencia = frete.numeroCte ? `CT-e ${frete.numeroCte}` : `${frete.origem} → ${frete.destino}`

  if (frete.status === 'CANCELADO') {
    return (
      <>
        <CabecalhoPagina titulo={referencia} descricao="Frete cancelado." />
        <Card className="p-6 text-sm text-texto-suave">
          Este frete foi cancelado e não entra mais em receita, comissão nem cobrança.
          Um frete cancelado não volta: lance outro no lugar.
        </Card>
      </>
    )
  }

  // Baixa registrada ou acerto fechado travam a correção do valor. Dizer isso
  // aqui em cima é melhor do que deixar a pessoa preencher tudo e levar erro.
  const travado =
    frete.acertoMotoristaId != null ||
    frete.lancamentos.some((l) => Number(l.valorPago) > 0 || l.acertoId != null)

  return (
    <>
      <CabecalhoPagina
        titulo={`Corrigir ${referencia}`}
        descricao={
          frete.viagem
            ? `Viagem ${frete.viagem.numero} · ${frete.viagem.veiculo.apelido}`
            : 'Frete de agregado'
        }
      />

      {travado && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-texto">
          <strong className="font-medium text-alerta">
            Este frete já tem pagamento ou acerto lançado.
          </strong>{' '}
          Dá para corrigir texto — rota, produto, observação —, mas o valor não sai daqui:
          mexer nele agora deixaria um pagamento real sem lastro. Estorne a baixa ou refaça
          o acerto primeiro.
        </Card>
      )}

      {frete.modalidade === 'FROTA_PROPRIA' && frete.viagem ? (
        <FormularioFreteProprio
          viagemId={frete.viagem.id}
          origemPadrao={frete.origem}
          destinoPadrao={frete.destino}
          clientes={listaClientes}
          frete={{
            id: frete.id,
            clienteId: frete.clienteId,
            dataEmissao: dia(frete.dataEmissao),
            numeroCte: texto(frete.numeroCte),
            serie: texto(frete.serie),
            origem: frete.origem,
            destino: frete.destino,
            produto: texto(frete.produto),
            cabecas: texto(frete.cabecas),
            pesoKg: texto(frete.pesoKg),
            dataEntrega: dia(frete.dataEntrega),
            valorCte: texto(frete.valorCte),
            valorFreteReal: texto(frete.valorFreteReal),
            valorPedagioDestacado: texto(frete.valorPedagioDestacado),
            valorIcms: texto(frete.valorIcms),
            observacoes: texto(frete.observacoes),
          }}
        />
      ) : (
        <FormularioFreteAgregado
          agregados={agregados.map((a) => ({
            id: a.id,
            nome: a.nome,
            regraCobranca: (a.regraCobranca ?? {}) as RegraCobrancaAgregado,
          }))}
          clientes={listaClientes}
          frete={{
            id: frete.id,
            proprietarioId: texto(frete.proprietarioId),
            clienteId: frete.clienteId,
            fluxoFinanceiro: texto(frete.fluxoFinanceiro),
            dataEmissao: dia(frete.dataEmissao),
            numeroCte: texto(frete.numeroCte),
            serie: texto(frete.serie),
            origem: frete.origem,
            destino: frete.destino,
            produto: texto(frete.produto),
            cabecas: texto(frete.cabecas),
            valorCte: texto(frete.valorCte),
            valorCargaNfe: texto(frete.valorCargaNfe),
            numeroNfe: texto(frete.numeroNfe),
            dataEntrega: dia(frete.dataEntrega),
            observacoes: texto(frete.observacoes),
          }}
        />
      )}

      <CancelarFrete freteId={frete.id} referencia={referencia} />
    </>
  )
}
