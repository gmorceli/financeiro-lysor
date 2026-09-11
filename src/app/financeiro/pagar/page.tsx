import { CabecalhoPagina } from '@/components/ui'
import { listarTitulos } from '../consultas'
import { TabelaTitulos } from '../tabela-titulos'

export const dynamic = 'force-dynamic'

export default async function ContasAPagar() {
  const lista = await listarTitulos('DESPESA', { apenasAbertos: true })

  return (
    <>
      <CabecalhoPagina
        titulo="Contas a pagar"
        descricao="Gerado automaticamente a cada custo lançado."
      />
      <TabelaTitulos
        titulos={lista.titulos}
        total={lista.total}
        naoExibidos={lista.naoExibidos}
        tipo="DESPESA"
        vazio={{
          titulo: 'Nada a pagar',
          descricao:
            'Abastecimento, manutenção e despesa de viagem viram conta a pagar assim que são lançados.',
        }}
      />
    </>
  )
}
