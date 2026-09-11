import { CabecalhoPagina } from '@/components/ui'
import { listarTitulos } from '../consultas'
import { TabelaTitulos } from '../tabela-titulos'

export const dynamic = 'force-dynamic'

export default async function ContasAReceber() {
  const titulos = await listarTitulos('RECEITA', { apenasAbertos: true })

  return (
    <>
      <CabecalhoPagina
        titulo="Contas a receber"
        descricao="Gerado automaticamente a cada frete lançado."
      />
      <TabelaTitulos
        titulos={titulos}
        tipo="RECEITA"
        vazio={{
          titulo: 'Nada a receber',
          descricao:
            'Os títulos aparecem aqui assim que um frete é lançado, com o vencimento conforme o prazo do cliente.',
        }}
      />
    </>
  )
}
