import { formatarMoeda } from '@/lib/utils'
import { Card, EstadoVazio, Tabela, Td, Th } from '@/components/ui'
import {
  BaixaDeTitulo,
  CelulaVencimento,
  SituacaoTitulo,
  ValorRestante,
} from '@/components/titulos'
import { contraparte, type TituloListado } from './consultas'

export function TabelaTitulos({
  titulos,
  tipo,
  vazio,
}: {
  titulos: TituloListado[]
  tipo: 'RECEITA' | 'DESPESA'
  vazio: { titulo: string; descricao: string }
}) {
  if (titulos.length === 0) {
    return (
      <Card>
        <EstadoVazio titulo={vazio.titulo} descricao={vazio.descricao} />
      </Card>
    )
  }

  const total = titulos.reduce(
    (soma, t) => soma + (Number(t.valor) - Number(t.valorPago)),
    0,
  )

  return (
    <Card>
      <Tabela>
        <thead>
          <tr>
            <Th>Vencimento</Th>
            <Th>{tipo === 'RECEITA' ? 'Quem paga' : 'Quem recebe'}</Th>
            <Th>Descrição</Th>
            <Th>Tipo</Th>
            <Th className="text-right">Valor</Th>
            <Th>Situação</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {titulos.map((titulo) => (
            <tr key={titulo.id} className="hover:bg-fundo">
              <CelulaVencimento
                dataVencimento={titulo.dataVencimento}
                gatilho={titulo.gatilhoVencimento}
              />
              <Td className="text-texto">{contraparte(titulo)}</Td>
              <Td className="max-w-xs truncate text-texto-suave" title={titulo.descricao}>
                {titulo.descricao}
              </Td>
              <Td className="text-texto-suave">{titulo.categoria.nome}</Td>
              <Td className="text-right tabular-nums font-medium text-texto">
                <ValorRestante
                  valor={Number(titulo.valor)}
                  valorPago={Number(titulo.valorPago)}
                />
              </Td>
              <Td>
                <SituacaoTitulo
                  status={titulo.status}
                  dataVencimento={titulo.dataVencimento}
                  gatilho={titulo.gatilhoVencimento}
                />
              </Td>
              <Td className="text-right">
                {titulo.status !== 'LIQUIDADO' && (
                  <BaixaDeTitulo
                    lancamentoId={titulo.id}
                    tipo={tipo}
                    valorRestante={Number(titulo.valor) - Number(titulo.valorPago)}
                  />
                )}
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-fundo">
            <Td colSpan={4} className="font-medium text-texto">
              Total em aberto
            </Td>
            <Td className="text-right tabular-nums font-semibold text-texto">
              {formatarMoeda(total)}
            </Td>
            <Td colSpan={2} />
          </tr>
        </tfoot>
      </Tabela>
    </Card>
  )
}
