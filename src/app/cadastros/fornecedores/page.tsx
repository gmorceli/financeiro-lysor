import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarCpfCnpj } from '@/lib/utils'
import { Badge, Button, CabecalhoPagina, Card, EstadoVazio, Tabela, Td, Th } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ListaFornecedores() {
  const fornecedores = await prisma.fornecedor.findMany({ orderBy: { nome: 'asc' } })

  return (
    <>
      <CabecalhoPagina
        titulo="Fornecedores"
        descricao="Postos, oficinas e borracharias — de onde vêm os custos."
        acao={
          <Link href="/cadastros/fornecedores/novo">
            <Button>Novo fornecedor</Button>
          </Link>
        }
      />
      <Card>
        {fornecedores.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum fornecedor cadastrado"
            descricao="Comece pelos postos onde os caminhões abastecem e pela oficina."
            acao={
              <Link href="/cadastros/fornecedores/novo">
                <Button>Cadastrar o primeiro</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>CNPJ / CPF</Th>
                <Th>Telefone</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((fornecedor) => (
                <tr key={fornecedor.id} className="hover:bg-fundo">
                  <Td>
                    <Link
                      href={`/cadastros/fornecedores/${fornecedor.id}`}
                      className="font-medium text-primaria hover:underline"
                    >
                      {fornecedor.nome}
                    </Link>
                  </Td>
                  <Td className="text-texto-suave">{fornecedor.categoria ?? '—'}</Td>
                  <Td className="tabular-nums text-texto-suave">
                    {formatarCpfCnpj(fornecedor.cpfCnpj)}
                  </Td>
                  <Td className="text-texto-suave">{fornecedor.telefone ?? '—'}</Td>
                  <Td>
                    <Badge tom={fornecedor.ativo ? 'positivo' : 'neutro'}>
                      {fornecedor.ativo ? 'Ativo' : 'Inativo'}
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
