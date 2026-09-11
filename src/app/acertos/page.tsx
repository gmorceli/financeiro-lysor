import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { calcularAcertoMotorista } from '@/lib/acertos'
import { limitesDoMes, mesAtual } from '@/lib/resultado'
import { CabecalhoPagina, Card, EstadoVazio, Tabela, Td, Th } from '@/components/ui'
import { formatarData, formatarMoeda, rota } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const NOMES_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/**
 * A tela do acerto começa pela pergunta que a cliente faz: **quem está me
 * esperando?** Não é uma lista de acertos passados — é a fila de quem tem
 * dinheiro a acertar agora, com o valor já somado.
 */
export default async function Acertos() {
  const { ano, mes } = mesAtual()
  const { inicio, fim } = limitesDoMes(ano, mes)

  const [motoristas, agregados, historico] = await Promise.all([
    prisma.motorista.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.proprietario.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        lancamentos: {
          where: { acertoId: null, status: { in: ['ABERTO', 'PARCIAL'] } },
          select: {
            valor: true,
            valorPago: true,
            tipo: true,
            dataVencimento: true,
          },
        },
      },
    }),
    prisma.acerto.findMany({
      orderBy: { fechadoEm: 'desc' },
      take: 12,
      include: {
        motorista: { select: { nome: true } },
        proprietario: { select: { nome: true } },
      },
    }),
  ])

  const filaMotoristas = await Promise.all(
    motoristas.map(async (m) => ({
      id: m.id,
      nome: m.nome,
      calculo: await calcularAcertoMotorista(m.id, inicio, fim),
    })),
  )
  const aAcertarMotorista = filaMotoristas.filter((m) => m.calculo.bruto > 0)

  const filaAgregados = agregados
    .map((a) => {
      const abertos = a.lancamentos
      const total = abertos.reduce((s, l) => s + (Number(l.valor) - Number(l.valorPago)), 0)
      // Vencimento preenchido é o sinal de que o cliente já pagou aquele CT-e:
      // é o gatilho AO_RECEBER tendo disparado.
      const liberados = abertos.filter((l) => l.dataVencimento !== null).length
      return { id: a.id, nome: a.nome, quantidade: abertos.length, liberados, total }
    })
    .filter((a) => a.quantidade > 0)

  return (
    <>
      <CabecalhoPagina
        titulo="Acertos"
        descricao={`Quem está esperando acerto. Motoristas no mês de ${NOMES_MES[mes - 1]}.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-borda px-4 py-3">
            <h2 className="text-sm font-semibold text-texto">Motoristas</h2>
          </div>
          {aAcertarMotorista.length === 0 ? (
            <p className="px-4 py-6 text-sm text-texto-suave">
              Nenhuma comissão pendente neste mês.
            </p>
          ) : (
            <Tabela minimo="min-w-0">
              <thead>
                <tr>
                  <Th>Motorista</Th>
                  <Th className="text-right">Fretes</Th>
                  <Th className="text-right">A pagar</Th>
                </tr>
              </thead>
              <tbody>
                {aAcertarMotorista.map((m) => (
                  <tr key={m.id} className="hover:bg-fundo">
                    <Td>
                      <Link
                        href={rota(`/acertos/motorista/${m.id}`)}
                        className="-my-3 inline-flex min-h-11 items-center font-medium text-primaria hover:underline sm:my-0 sm:min-h-0"
                      >
                        {m.nome}
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {m.calculo.fretes.length}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums font-medium text-texto">
                      {formatarMoeda(m.calculo.bruto)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Card>

        <Card>
          <div className="border-b border-borda px-4 py-3">
            <h2 className="text-sm font-semibold text-texto">Agregados</h2>
          </div>
          {filaAgregados.length === 0 ? (
            <p className="px-4 py-6 text-sm text-texto-suave">Nada em aberto com agregado.</p>
          ) : (
            <Tabela minimo="min-w-0">
              <thead>
                <tr>
                  <Th>Agregado</Th>
                  <Th className="text-right">CT-e</Th>
                  <Th className="text-right">Em aberto</Th>
                </tr>
              </thead>
              <tbody>
                {filaAgregados.map((a) => (
                  <tr key={a.id} className="hover:bg-fundo">
                    <Td>
                      <Link
                        href={rota(`/acertos/agregado/${a.id}`)}
                        className="-my-3 inline-flex min-h-11 items-center font-medium text-primaria hover:underline sm:my-0 sm:min-h-0"
                      >
                        {a.nome}
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {a.liberados === a.quantidade
                        ? a.quantidade
                        : `${a.liberados} de ${a.quantidade}`}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums font-medium text-texto">
                      {formatarMoeda(a.total)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
          {filaAgregados.some((a) => a.liberados < a.quantidade) && (
            <p className="border-t border-borda px-4 py-3 text-xs text-texto-suave">
              &quot;{filaAgregados.find((a) => a.liberados < a.quantidade)?.liberados} de N&quot;
              quer dizer quantos CT-e o cliente já pagou. Os outros aparecem na tela do agregado,
              marcados — dá para acertar antes, mas o sistema avisa.
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">Últimos acertos fechados</h2>
        </div>
        {historico.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum acerto fechado ainda"
            descricao="Quando você fechar o primeiro, ele fica registrado aqui com a data e o valor."
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Fechado em</Th>
                <Th>Quem</Th>
                <Th>Período</Th>
                <Th className="text-right">Valor</Th>
              </tr>
            </thead>
            <tbody>
              {historico.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap tabular-nums text-texto-suave">
                    {formatarData(a.fechadoEm)}
                  </Td>
                  <Td className="text-texto">
                    {a.motorista?.nome ?? a.proprietario?.nome ?? '—'}
                    <span className="ml-2 text-xs text-texto-suave">
                      {a.tipo === 'MOTORISTA' ? 'motorista' : 'agregado'}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-texto-suave">
                    {formatarData(a.periodoInicio)} a {formatarData(a.periodoFim)}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums font-medium text-texto">
                    {formatarMoeda(a.valorLiquido)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
