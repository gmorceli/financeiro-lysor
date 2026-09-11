import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarCpfCnpj } from '@/lib/utils'
import { Badge, Button, CabecalhoPagina, Card, EstadoVazio, LINK_TABELA, Tabela, Td, Th } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ListaClientes() {
  const clientes = await prisma.cliente.findMany({ orderBy: { razaoSocial: 'asc' } })

  return (
    <>
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Os embarcadores que contratam o frete."
        acao={
          <Link href="/cadastros/clientes/novo">
            <Button>Novo cliente</Button>
          </Link>
        }
      />
      <Card>
        {clientes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum cliente cadastrado"
            descricao="Comece pelos clientes que aparecem com mais frequência nos CT-e."
            acao={
              <Link href="/cadastros/clientes/novo">
                <Button>Cadastrar o primeiro</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>CNPJ</Th>
                <Th>Contato</Th>
                <Th className="text-right">Prazo</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-fundo">
                  <Td>
                    <Link
                      href={`/cadastros/clientes/${cliente.id}`}
                      className={LINK_TABELA}
                    >
                      {cliente.nomeFantasia || cliente.razaoSocial}
                    </Link>
                  </Td>
                  <Td className="tabular-nums text-texto-suave">
                    {formatarCpfCnpj(cliente.cnpj)}
                  </Td>
                  <Td className="text-texto-suave">{cliente.contato ?? '—'}</Td>
                  <Td className="text-right tabular-nums text-texto-suave">
                    {cliente.prazoPagamentoDias === 0
                      ? 'À vista'
                      : `${cliente.prazoPagamentoDias} dias`}
                  </Td>
                  <Td>
                    <Badge tom={cliente.ativo ? 'positivo' : 'neutro'}>
                      {cliente.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
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
