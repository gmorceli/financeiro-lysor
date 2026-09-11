import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { calcularAcertoAgregado } from '@/lib/acertos'
import { CabecalhoPagina, Card, EstadoVazio } from '@/components/ui'
import { FecharAcertoAgregado } from './fechar'

export const dynamic = 'force-dynamic'

/** Número com vírgula: 0.06 vira "0,06%". */
function porcento(valor: number) {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`
}

export default async function AcertoAgregado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const existe = await prisma.proprietario.findUnique({ where: { id }, select: { id: true } })
  if (!existe) notFound()

  const calculo = await calcularAcertoAgregado(id)
  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <>
      <CabecalhoPagina
        titulo={`Acerto — ${calculo.nome}`}
        descricao={`${porcento(calculo.percentualCte)} sobre o CT-e e ${porcento(calculo.percentualSeguro)} sobre o valor da carga.`}
      />

      <Card className="p-5">
        {calculo.titulos.length === 0 ? (
          <EstadoVazio
            titulo="Nada em aberto com este agregado"
            descricao="Todos os CT-e dele já foram acertados."
          />
        ) : (
          <FecharAcertoAgregado
            proprietarioId={id}
            hoje={hoje}
            linhas={calculo.titulos.map((t) => ({
              lancamentoId: t.lancamentoId,
              data: t.data.toISOString(),
              referencia: t.referencia,
              rota: t.rota,
              valorCte: t.valorCte,
              valorCarga: t.valorCarga,
              comissao: t.comissao,
              seguro: t.seguro,
              valor: t.valor,
              tipo: t.tipo,
              clientePagou: t.clientePagou,
            }))}
          />
        )}
      </Card>
    </>
  )
}
