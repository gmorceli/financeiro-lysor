import { CabecalhoPagina } from '@/components/ui'
import { FormularioDespesa } from '../../formulario-despesa'
import { opcoesDaDespesa } from '../consultas'

export const dynamic = 'force-dynamic'

export default async function NovaDespesa() {
  const opcoes = await opcoesDaDespesa()

  return (
    <>
      <CabecalhoPagina
        titulo="Lançar despesa"
        descricao="Pedágio, chapa, lavagem, seguro, licenciamento, contador."
      />
      <FormularioDespesa {...opcoes} />
    </>
  )
}
