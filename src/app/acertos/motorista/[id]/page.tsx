import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { calcularAcertoMotorista } from '@/lib/acertos'
import { limitesDoMes, mesAtual } from '@/lib/resultado'
import { CabecalhoPagina, Card, EstadoVazio, Tabela, Td, Th } from '@/components/ui'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { SeletorMes } from '../../../relatorios/seletor-mes'
import { FecharAcertoMotorista } from './fechar'

export const dynamic = 'force-dynamic'

function lerMes(texto: string | undefined) {
  const casa = texto?.match(/^(\d{4})-(\d{2})$/)
  if (!casa) return mesAtual()
  const ano = Number(casa[1])
  const mes = Number(casa[2])
  if (mes < 1 || mes > 12) return mesAtual()
  return { ano, mes }
}

const ROTULO_MODELO: Record<string, string> = {
  COMISSAO: 'só comissão',
  HIBRIDO: 'salário mais comissão',
  FIXO_MENSAL: 'salário fixo',
}

export default async function AcertoMotorista({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mes?: string }>
}) {
  const { id } = await params
  const { mes: mesTexto } = await searchParams
  const { ano, mes } = lerMes(mesTexto)
  const { inicio, fim } = limitesDoMes(ano, mes)

  const existe = await prisma.motorista.findUnique({ where: { id }, select: { id: true } })
  if (!existe) notFound()

  const calculo = await calcularAcertoMotorista(id, inicio, fim)
  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <>
      <CabecalhoPagina
        titulo={`Acerto — ${calculo.nome}`}
        descricao={`${ROTULO_MODELO[calculo.modeloRemuneracao] ?? calculo.modeloRemuneracao}, ${calculo.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% sobre o ${calculo.base === 'FRETE_REAL' ? 'valor real do frete' : 'valor do CT-e'}.`}
        acao={<SeletorMes valor={`${ano}-${String(mes).padStart(2, '0')}`} />}
      />

      <Card className="mb-4">
        <div className="border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">Fretes do período</h2>
        </div>
        {calculo.fretes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum frete a comissionar neste mês"
            descricao="Ou não houve viagem, ou a comissão já foi paga num acerto anterior."
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>CT-e</Th>
                <Th>Rota</Th>
                <Th className="text-right">CT-e</Th>
                <Th className="text-right">Valor real</Th>
                <Th className="text-right">Comissão</Th>
              </tr>
            </thead>
            <tbody>
              {calculo.fretes.map((f) => {
                const divergente = f.valorCte !== f.valorFreteReal
                return (
                  <tr key={f.freteId}>
                    <Td className="whitespace-nowrap tabular-nums text-texto-suave">
                      {formatarData(f.data)}
                    </Td>
                    <Td className="tabular-nums text-texto-suave">{f.referencia}</Td>
                    <Td className="max-w-48 truncate text-texto" title={f.rota}>
                      {f.rota}
                    </Td>
                    <Td
                      className={
                        divergente
                          ? 'whitespace-nowrap text-right tabular-nums text-alerta'
                          : 'whitespace-nowrap text-right tabular-nums text-texto-suave'
                      }
                    >
                      {formatarMoeda(f.valorCte)}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums text-texto">
                      {formatarMoeda(f.valorFreteReal)}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums font-medium text-texto">
                      {formatarMoeda(f.comissao)}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        )}
        {calculo.fretes.some((f) => f.valorCte !== f.valorFreteReal) && (
          <p className="border-t border-borda px-4 py-3 text-xs text-texto-suave">
            Os CT-e em âmbar saíram por valor diferente do combinado. A comissão segue o valor
            real, que é a coluna do meio.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-texto">A conta</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-texto-suave">Salário do mês</dt>
              <dd className="tabular-nums text-texto">{formatarMoeda(calculo.salario)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-texto-suave">
                Comissão de {calculo.fretes.length} frete{calculo.fretes.length === 1 ? '' : 's'}
              </dt>
              <dd className="tabular-nums text-texto">{formatarMoeda(calculo.comissaoTotal)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-borda pt-2 font-medium">
              <dt className="text-texto">Bruto</dt>
              <dd className="tabular-nums text-texto">{formatarMoeda(calculo.bruto)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-texto">Fechar</h2>
          {calculo.bruto === 0 ? (
            <p className="text-sm text-texto-suave">
              Não há nada a acertar neste período.{' '}
              <Link href="/acertos" className="text-primaria hover:underline">
                Voltar
              </Link>
            </p>
          ) : (
            <FecharAcertoMotorista
              motoristaId={id}
              inicio={inicio.toISOString().slice(0, 10)}
              fim={fim.toISOString().slice(0, 10)}
              bruto={calculo.bruto}
              hoje={hoje}
            />
          )}
        </Card>
      </div>
    </>
  )
}
