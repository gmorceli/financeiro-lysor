import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarData, formatarMoeda, rota } from '@/lib/utils'
import {
  Badge,
  Button,
  CabecalhoPagina,
  Card,
  EstadoVazio,
  Tabela,
  Td,
  Th,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Fretes das duas modalidades na mesma lista, mas com a receita da Lysor
 * calculada de forma diferente em cada uma: no frete próprio é o valor do
 * frete; no de agregado é só a comissão mais o seguro.
 */
export default async function ListaFretes({
  searchParams,
}: {
  searchParams: Promise<{ modalidade?: string }>
}) {
  const { modalidade } = await searchParams
  const filtro =
    modalidade === 'FROTA_PROPRIA' || modalidade === 'AGREGADO' ? modalidade : undefined

  const fretes = await prisma.frete.findMany({
    where: filtro ? { modalidade: filtro } : undefined,
    include: {
      cliente: { select: { razaoSocial: true, nomeFantasia: true } },
      proprietario: { select: { nome: true } },
      viagem: { select: { numero: true, veiculo: { select: { apelido: true } } } },
    },
    orderBy: { dataEmissao: 'desc' },
    take: 100,
  })

  const abas = [
    { rotulo: 'Todos', valor: undefined },
    { rotulo: 'Frota própria', valor: 'FROTA_PROPRIA' },
    { rotulo: 'Agregados', valor: 'AGREGADO' },
  ] as const

  return (
    <>
      <CabecalhoPagina
        titulo="Fretes"
        descricao="Frete de caminhão próprio entra pela viagem. Frete de agregado entra direto aqui."
        acao={
          <Link href="/fretes/agregado/novo">
            <Button>Frete de agregado</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1">
        {abas.map((aba) => {
          const ativo = filtro === aba.valor
          return (
            <Link
              key={aba.rotulo}
              href={rota(aba.valor ? `/fretes?modalidade=${aba.valor}` : '/fretes')}
              className={
                ativo
                  ? 'flex min-h-11 items-center rounded-lg bg-primaria px-3 text-sm font-medium text-white sm:min-h-9'
                  : 'flex min-h-11 items-center rounded-lg px-3 text-sm text-texto-suave hover:bg-superficie sm:min-h-9'
              }
            >
              {aba.rotulo}
            </Link>
          )
        })}
      </div>

      <Card>
        {fretes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum frete lançado"
            descricao="Frete de caminhão próprio se lança de dentro da viagem. Frete de agregado, por aqui."
            acao={
              <Link href="/fretes/agregado/novo">
                <Button>Lançar frete de agregado</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Emissão</Th>
                <Th>CT-e</Th>
                <Th>Cliente</Th>
                <Th>Quem rodou</Th>
                <Th className="text-right">Valor do CT-e</Th>
                <Th className="text-right">Receita da Lysor</Th>
              </tr>
            </thead>
            <tbody>
              {fretes.map((frete) => {
                const ehAgregado = frete.modalidade === 'AGREGADO'
                const receita = ehAgregado
                  ? Number(frete.valorComissaoAgregado ?? 0) +
                    Number(frete.valorSeguroAgregado ?? 0)
                  : Number(frete.valorFreteReal)
                return (
                  <tr key={frete.id} className="hover:bg-fundo">
                    <Td className="tabular-nums text-texto-suave">
                      {formatarData(frete.dataEmissao)}
                    </Td>
                    <Td className="tabular-nums text-texto-suave">
                      {frete.numeroCte ?? '—'}
                    </Td>
                    <Td className="text-texto">
                      {frete.cliente.nomeFantasia || frete.cliente.razaoSocial}
                    </Td>
                    <Td>
                      {ehAgregado ? (
                        <span className="flex items-center gap-2">
                          <Badge>Agregado</Badge>
                          <span className="text-texto-suave">
                            {frete.proprietario?.nome}
                          </span>
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-x-1 text-texto-suave">
                          {frete.viagem?.veiculo.apelido ?? '—'}
                          {frete.viagem && (
                            <Link
                              href={rota(`/viagens/${frete.viagemId}`)}
                              className="-my-3 inline-flex min-h-11 items-center text-primaria hover:underline sm:my-0 sm:min-h-0"
                            >
                              (viagem {frete.viagem.numero})
                            </Link>
                          )}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {formatarMoeda(frete.valorCte)}
                    </Td>
                    <Td className="text-right tabular-nums font-medium text-texto">
                      {formatarMoeda(receita)}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
