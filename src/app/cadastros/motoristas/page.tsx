import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatarCpfCnpj, formatarData, formatarMoeda } from '@/lib/utils'
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

/** Resume a regra de pagamento em uma linha legível na listagem. */
function descreverRemuneracao(motorista: {
  modeloRemuneracao: string
  salarioFixo: unknown
  percentualComissao: unknown
}) {
  const salario = formatarMoeda(motorista.salarioFixo as string)
  const comissao = `${Number(motorista.percentualComissao)}%`
  if (motorista.modeloRemuneracao === 'COMISSAO') return `${comissao} de comissão`
  if (motorista.modeloRemuneracao === 'FIXO_MENSAL') return salario
  return `${salario} + ${comissao}`
}

export default async function ListaMotoristas() {
  const motoristas = await prisma.motorista.findMany({
    include: { veiculoPadrao: { select: { apelido: true } } },
    orderBy: { nome: 'asc' },
  })

  const hoje = new Date()
  const em60Dias = new Date(hoje.getTime() + 60 * 24 * 60 * 60 * 1000)

  return (
    <>
      <CabecalhoPagina
        titulo="Motoristas"
        descricao="A forma de pagamento cadastrada aqui é a que o sistema usa no acerto."
        acao={
          <Link href="/cadastros/motoristas/novo">
            <Button>Novo motorista</Button>
          </Link>
        }
      />

      <Card>
        {motoristas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum motorista cadastrado"
            descricao="Cadastre com a forma de pagamento correta — é ela que gera a comissão em cada viagem."
            acao={
              <Link href="/cadastros/motoristas/novo">
                <Button>Cadastrar o primeiro</Button>
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>CPF</Th>
                <Th>Como é pago</Th>
                <Th>Caminhão</Th>
                <Th>CNH vence</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {motoristas.map((motorista) => {
                const vencendo =
                  motorista.cnhValidade && new Date(motorista.cnhValidade) < em60Dias
                return (
                  <tr key={motorista.id} className="hover:bg-fundo">
                    <Td>
                      <Link
                        href={`/cadastros/motoristas/${motorista.id}`}
                        className="font-medium text-primaria hover:underline"
                      >
                        {motorista.nome}
                      </Link>
                    </Td>
                    <Td className="tabular-nums text-texto-suave">
                      {formatarCpfCnpj(motorista.cpf)}
                    </Td>
                    <Td className="text-texto-suave">{descreverRemuneracao(motorista)}</Td>
                    <Td className="text-texto-suave">
                      {motorista.veiculoPadrao?.apelido ?? '—'}
                    </Td>
                    <Td className={vencendo ? 'text-alerta' : 'text-texto-suave'}>
                      {formatarData(motorista.cnhValidade)}
                    </Td>
                    <Td>
                      <Badge tom={motorista.ativo ? 'positivo' : 'neutro'}>
                        {motorista.ativo ? 'Ativo' : 'Inativo'}
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
