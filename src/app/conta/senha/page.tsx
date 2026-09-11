import { CabecalhoPagina, Card } from '@/components/ui'
import { exigirUsuario } from '@/lib/sessao'
import { FormularioTrocaDeSenha } from './formulario'

export default async function PaginaTrocaDeSenha() {
  const usuario = await exigirUsuario({ trocaDeSenha: true })

  return (
    <>
      <CabecalhoPagina
        titulo={usuario.trocarSenha ? 'Escolha sua senha' : 'Trocar senha'}
        descricao={
          usuario.trocarSenha
            ? 'A senha que você recebeu é provisória e só serve para este primeiro acesso.'
            : 'Depois de salvar, o acesso será pedido de novo nos outros aparelhos.'
        }
      />
      <Card className="p-6">
        <FormularioTrocaDeSenha />
      </Card>
    </>
  )
}
