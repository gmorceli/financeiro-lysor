import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CabecalhoPagina, Card } from '@/components/ui'
import { formatarData } from '@/lib/utils'
import { usuarioDaSessao } from '@/lib/sessao'
import { FormularioUsuario } from '../formulario'
import { FormularioRedefinirSenha } from '../redefinir'

export default async function PaginaUsuario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [usuario, motoristas, eu] = await Promise.all([
    prisma.usuario.findUnique({ where: { id } }),
    prisma.motorista.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    usuarioDaSessao(),
  ])

  if (!usuario) notFound()

  return (
    <>
      <CabecalhoPagina
        titulo={usuario.nome}
        descricao={
          usuario.ultimoAcessoEm
            ? `Último acesso em ${formatarData(usuario.ultimoAcessoEm)}. Senha definida em ${formatarData(usuario.senhaDefinidaEm)}.`
            : 'Nunca entrou no sistema.'
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <FormularioUsuario
            usuario={{
              id: usuario.id,
              nome: usuario.nome,
              email: usuario.email,
              perfil: usuario.perfil,
              motoristaId: usuario.motoristaId,
              ativo: usuario.ativo,
            }}
            motoristas={motoristas}
            ehVocMesmo={usuario.id === eu?.id}
          />
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-texto">Senha</h2>
          <p className="mb-4 mt-1 text-sm text-texto-suave">
            Ninguém, nem administrador, consegue ler a senha de alguém — ela é guardada de um jeito
            que não volta atrás. Esqueceu? Só resta gerar outra provisória.
          </p>
          <FormularioRedefinirSenha usuarioId={usuario.id} />
        </Card>
      </div>
    </>
  )
}
