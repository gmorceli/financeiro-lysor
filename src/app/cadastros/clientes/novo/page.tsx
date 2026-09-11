import { CabecalhoPagina } from '@/components/ui'
import { FormularioCliente } from '../formulario'

export default function NovoCliente() {
  return (
    <>
      <CabecalhoPagina titulo="Novo cliente" />
      <FormularioCliente />
    </>
  )
}
