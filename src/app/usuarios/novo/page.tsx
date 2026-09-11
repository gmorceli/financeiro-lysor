import { prisma } from '@/lib/prisma'
import { CabecalhoPagina, Card } from '@/components/ui'
import { FormularioUsuario } from '../formulario'

export default async function PaginaNovoUsuario() {
  const motoristas = await prisma.motorista.findMany({
    where: { ativo: true, usuario: null },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  return (
    <>
      <CabecalhoPagina
        titulo="Novo usuário"
        descricao="A senha provisória só vale para o primeiro acesso."
      />
      <Card className="max-w-xl p-6">
        <FormularioUsuario motoristas={motoristas} />
      </Card>
    </>
  )
}
