import { CabecalhoPagina } from '@/components/ui'
import { FormularioFornecedor } from '../formulario'

export default function NovoFornecedor() {
  return (
    <>
      <CabecalhoPagina titulo="Novo fornecedor" />
      <FormularioFornecedor />
    </>
  )
}
