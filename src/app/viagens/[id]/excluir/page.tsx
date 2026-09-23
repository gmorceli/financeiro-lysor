import Link from 'next/link'
import { notFound } from 'next/navigation'
import { resumoParaExclusao } from '@/lib/viagens'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { Button, CabecalhoPagina, Card } from '@/components/ui'
import { FormularioExclusao } from './formulario'

export const dynamic = 'force-dynamic'

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-texto-suave">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-texto">{valor}</dd>
    </div>
  )
}

/**
 * Tela de confirmação da exclusão de viagem.
 *
 * É uma tela e não um `confirm()` porque o erro que ela existe para evitar não
 * é "excluir sem querer" — é **excluir a viagem errada**, clicando na linha de
 * cima. Data, CT-e, motorista, placa, rota e valor na mesma tela é o que torna
 * isso óbvio antes do clique, e num celular uma página cabe onde um diálogo
 * nativo não cabe.
 *
 * Os avisos são calculados aqui, no servidor, a partir do estado real: dizer
 * "o recebimento será estornado" sem olhar se existe recebimento treinaria a
 * pessoa a ignorar o aviso.
 */
export default async function ExcluirViagem({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const resumo = await resumoParaExclusao(id)
  if (!resumo) notFound()

  if (resumo.excluida) {
    return (
      <>
        <CabecalhoPagina titulo={`Viagem ${resumo.numero}`} />
        <Card className="p-4">
          <p className="text-sm text-texto">
            Esta viagem já foi excluída em {formatarData(resumo.excluida.em)}
            {resumo.excluida.por ? ` por ${resumo.excluida.por}` : ''}.
          </p>
          <div className="mt-4">
            <Link href={`/viagens/${resumo.id}`}>
              <Button variante="secundario">Ver a viagem</Button>
            </Link>
          </div>
        </Card>
      </>
    )
  }

  const travada = resumo.fretesAcertados > 0

  return (
    <>
      <CabecalhoPagina
        titulo={`Excluir a viagem ${resumo.numero}`}
        descricao="Confira se é esta mesmo antes de confirmar."
      />

      <Card className="mb-4 p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Dado rotulo="Saída" valor={formatarData(resumo.dataSaida)} />
          <Dado rotulo="Caminhão" valor={`${resumo.veiculo} · ${resumo.placa}`} />
          <Dado rotulo="Motorista" valor={resumo.motorista} />
          <Dado rotulo="Rota" valor={resumo.rota} />
          <Dado
            rotulo="CT-e"
            valor={
              resumo.fretes.length === 0
                ? 'Nenhum'
                : resumo.fretes.map((f) => f.numeroCte ?? 'sem número').join(', ')
            }
          />
          <Dado rotulo="Valor do frete" valor={formatarMoeda(resumo.receita)} />
        </dl>

        {resumo.fretes.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-borda pt-3 text-sm text-texto-suave">
            {resumo.fretes.map((f, indice) => (
              <li key={indice} className="flex justify-between gap-4">
                <span>
                  {f.numeroCte ? `CT-e ${f.numeroCte}` : 'CT-e sem número'} · {f.cliente}
                </span>
                <span className="tabular-nums">{formatarMoeda(f.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {travada ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-texto">
          <strong className="font-medium text-alerta">
            A comissão desta viagem já foi paga num acerto fechado.
          </strong>{' '}
          Excluir aqui tiraria da conta um frete que já virou pagamento ao motorista, e o
          acerto ficaria sem lastro. Refaça o acerto do motorista e volte.
          <div className="mt-3">
            <Link href={`/viagens/${resumo.id}`}>
              <Button variante="secundario">Voltar para a viagem</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-4 p-4 text-sm text-texto-suave">
            <p>
              A viagem some das listas, dos relatórios de lucro, do contas a receber e do
              cálculo de comissão — mas continua registrada, com a data, o seu nome e o
              motivo. Dá para restaurar depois.
            </p>
            {resumo.comissao > 0 && (
              <p className="mt-2">
                A comissão de {formatarMoeda(resumo.comissao)} deste motorista deixa de
                ser devida por esta viagem, e o valor do próximo acerto muda.
              </p>
            )}
          </Card>

          {resumo.recebimentos.length > 0 && (
            <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-texto">
              <strong className="font-medium text-alerta">
                Esta viagem já tem recebimento lançado.
              </strong>{' '}
              O recebimento também será estornado:
              <ul className="mt-2 space-y-1">
                {resumo.recebimentos.map((r, indice) => (
                  <li key={indice} className="flex justify-between gap-4">
                    <span>{r.descricao}</span>
                    <span className="tabular-nums">{formatarMoeda(r.valorPago)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-texto-suave">
                Se o cliente pagou de verdade, esse dinheiro era de outro frete ou era
                adiantamento — e precisa ser lançado de novo no lugar certo.
              </p>
            </Card>
          )}

          <FormularioExclusao viagemId={resumo.id} despesas={resumo.despesas} />
        </>
      )}
    </>
  )
}
