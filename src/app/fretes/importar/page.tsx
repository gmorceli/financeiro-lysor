import { CabecalhoPagina } from '@/components/ui'
import { listarClientes } from './actions'
import { FormularioImportacao } from './formulario'

export const dynamic = 'force-dynamic'

export default async function Importar() {
  const clientes = await listarClientes()

  return (
    <>
      <CabecalhoPagina
        titulo="Importar MDF-e"
        descricao="O manifesto que vocês já emitem traz o CT-e, o valor da carga, a placa e o motorista. Aqui ele vira frete."
      />
      <FormularioImportacao clientes={clientes} />
    </>
  )
}
