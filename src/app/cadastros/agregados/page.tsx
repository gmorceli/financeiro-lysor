import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarCpfCnpj } from '@/lib/utils'
import { Badge, Button, CabecalhoPagina, Card, EstadoVazio, Tabela, Td, Th } from '@/components/ui'

export const dynamic = 'force-dynamic'

type RegraCobranca = { percentualCte?: number; percentualSeguroCarga?: number }

export default async function ListaAgregados() {
  const agregados = await prisma.proprietario.findMany({
    include: { _count: { select: { veiculos: true } } },
    orderBy: { nome: 'asc' },
  })

  return (
    <>
      <CabecalhoPagina
        titulo="Agregados"
        descricao="Donos de caminhão que rodam pela Lysor. Eles pagam comissão e seguro."
        acao={
          <Link href="/cadastros/agregados/novo">
            <Button>Novo agregado</Button>
          </Link>
        }
      />
      <Card>
        {agregados.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum agregado cadastrado"
            descricao="Cadastre com o percentual e o seguro corretos — é o que o sistema cobra a cada CT-e."
            acao={
              <Link href="/cadastros/agregados/novo">
                <Button>Cadastrar o primeiro</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>CPF / CNPJ</Th>
                <Th className="text-right">Comissão</Th>
                <Th className="text-right">Seguro</Th>
                <Th className="text-right">Veículos</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {agregados.map((agregado) => {
                const regra = (agregado.regraCobranca ?? {}) as RegraCobranca
                return (
                  <tr key={agregado.id} className="hover:bg-fundo">
                    <Td>
                      <Link
                        href={`/cadastros/agregados/${agregado.id}`}
                        className="font-medium text-primaria hover:underline"
                      >
                        {agregado.nome}
                      </Link>
                    </Td>
                    <Td className="tabular-nums text-texto-suave">
                      {formatarCpfCnpj(agregado.cpfCnpj)}
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {regra.percentualCte ?? '—'}%
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {regra.percentualSeguroCarga ?? '—'}%
                    </Td>
                    <Td className="text-right tabular-nums text-texto-suave">
                      {agregado._count.veiculos}
                    </Td>
                    <Td>
                      <Badge tom={agregado.ativo ? 'positivo' : 'neutro'}>
                        {agregado.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
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
