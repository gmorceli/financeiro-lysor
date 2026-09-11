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
  total,
  naoExibidos = 0,
  tipo,
  vazio,
}: {
  titulos: TituloListado[]
  /** Total do filtro inteiro, não só das linhas exibidas. */
  total: number
  naoExibidos?: number
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
      {naoExibidos > 0 && (
        <p className="border-t border-borda px-4 py-3 text-xs text-texto-suave">
          A tela mostra os {titulos.length} títulos mais antigos. Outros {naoExibidos} não
          couberam aqui, mas <strong className="font-medium text-texto">estão no total
          acima</strong> e na planilha do botão Excel.
        </p>
      )}
    </Card>
  )
}
