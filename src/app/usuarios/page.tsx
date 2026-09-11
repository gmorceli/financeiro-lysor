import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge, Button, CabecalhoPagina, Card, EstadoVazio, LINK_TABELA, Tabela, Td, Th } from '@/components/ui'
import { ROTULOS_PERFIL } from '@/lib/permissoes'
import { usuarioDaSessao } from '@/lib/sessao'
import { formatarData, rota } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PaginaUsuarios() {
  const [usuarios, eu] = await Promise.all([
    prisma.usuario.findMany({ orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] }),
    usuarioDaSessao(),
  ])

  return (
    <>
      <CabecalhoPagina
        titulo="Usuários"
        descricao="Quem entra no sistema e até onde cada um vai."
        acao={
          <Link href="/usuarios/novo">
            <Button>Novo usuário</Button>
          </Link>
        }
      />

      <Card>
        {usuarios.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum usuário"
            descricao="Crie o primeiro pelo terminal, com npm run usuario."
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Perfil</Th>
                <Th>Último acesso</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-fundo">
                  <Td>
                    <Link
                      href={rota(`/usuarios/${usuario.id}`)}
                      className={LINK_TABELA}
                    >
                      {usuario.nome}
                    </Link>
                    {usuario.id === eu?.id && (
                      <span className="ml-2 text-xs text-texto-suave">você</span>
                    )}
                  </Td>
                  <Td className="text-texto-suave">{usuario.email}</Td>
                  <Td className="text-texto">{ROTULOS_PERFIL[usuario.perfil]}</Td>
                  <Td className="text-texto-suave">
                    {usuario.ultimoAcessoEm ? formatarData(usuario.ultimoAcessoEm) : 'nunca entrou'}
                  </Td>
                  <Td>
                    {!usuario.ativo ? (
                      <Badge tom="erro">sem acesso</Badge>
                    ) : usuario.bloqueadoAte && usuario.bloqueadoAte > new Date() ? (
                      <Badge tom="alerta">bloqueado</Badge>
                    ) : usuario.trocarSenha ? (
                      <Badge tom="alerta">senha provisória</Badge>
                    ) : (
                      <Badge tom="positivo">ativo</Badge>
                    )}
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
