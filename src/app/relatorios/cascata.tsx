import { formatarMoeda } from '@/lib/utils'
import { Card } from '@/components/ui'
import type { ResultadoPeriodo } from '@/lib/resultado'

function Linha({
  rotulo,
  valor,
  sinal,
  explicacao,
  total,
}: {
  rotulo: string
  valor: number
  sinal?: '−' | '+'
  explicacao?: string
  total?: boolean
}) {
  return (
    <div
      className={
        total
          ? 'flex flex-wrap items-baseline justify-between gap-x-4 border-t border-borda pt-2'
          : 'flex flex-wrap items-baseline justify-between gap-x-4'
      }
    >
      <div>
        <span className={total ? 'font-medium text-texto' : 'text-texto-suave'}>
          {rotulo}
        </span>
        {explicacao && (
          <span className="ml-2 text-xs text-texto-suave">{explicacao}</span>
        )}
      </div>
      <span
        className={
          total
            ? valor >= 0
              ? 'tabular-nums font-semibold text-primaria'
              : 'tabular-nums font-semibold text-erro'
            : 'tabular-nums text-texto'
        }
      >
        {sinal ? `${sinal} ` : ''}
        {formatarMoeda(Math.abs(valor))}
      </span>
    </div>
  )
}

/**
 * O DRE em cascata.
 *
 * Cada linha de "=" responde uma pergunta de gestão diferente, e é por isso
 * que elas aparecem separadas em vez de num total só.
 */
export function Cascata({ resultado }: { resultado: ResultadoPeriodo }) {
  const { propria, agregado, overhead, lucroOperacional } = resultado

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-texto">Frota própria</h2>
        <div className="mt-3 space-y-2 text-sm">
          <Linha rotulo="Receita de frete" valor={propria.receita} />
          <Linha
            rotulo="Custos diretos"
            valor={propria.custoDireto}
            sinal="−"
            explicacao="diesel, pedágio, comissão"
          />
          <Linha
            rotulo="Margem de contribuição"
            valor={propria.margemContribuicao}
            total
          />
          <p className="pb-1 text-xs text-texto-suave">
            É com este número que se decide preço e se vale pegar a carga.
          </p>
          <Linha
            rotulo="Custos dos caminhões"
            valor={propria.custoVeiculo}
            sinal="−"
            explicacao="manutenção, seguro, parcela"
          />
          <Linha rotulo="Resultado da frota" valor={propria.resultado} total />
          <p className="text-xs text-texto-suave">
            É com este que se decide manter, trocar ou vender caminhão.
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-texto">Agregados</h2>
        <div className="mt-3 space-y-2 text-sm">
          <Linha
            rotulo="Comissão e seguro"
            valor={agregado.receita}
            explicacao={`${agregado.fretes} frete${agregado.fretes === 1 ? '' : 's'}`}
          />
          <Linha rotulo="Custos" valor={0} sinal="−" explicacao="o caminhão é do agregado" />
          <Linha rotulo="Resultado dos agregados" valor={agregado.receita} total />
          <p className="text-xs text-texto-suave">
            Sem diesel, sem manutenção e sem parcela — a margem é praticamente
            integral. Comparar este percentual com o da frota própria leva a
            conclusão errada: são negócios com estruturas de capital opostas.
          </p>
        </div>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <h2 className="text-sm font-semibold text-texto">Resultado da empresa</h2>
        <div className="mt-3 space-y-2 text-sm">
          <Linha rotulo="Resultado da frota própria" valor={propria.resultado} />
          <Linha rotulo="Resultado dos agregados" valor={agregado.receita} sinal="+" />
          <Linha
            rotulo="Custos fixos da empresa"
            valor={overhead}
            sinal="−"
            explicacao="escritório, contador, sistema, impostos"
          />
          <Linha rotulo="Lucro operacional" valor={lucroOperacional} total />
        </div>
        {resultado.custoDiretoSemViagem > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-alerta">
            {formatarMoeda(resultado.custoDiretoSemViagem)} em custos diretos lançados
            sem viagem e sem caminhão que rodasse no período — entram no resultado, mas
            ninguém sabe de qual frete são. Lance diesel e pedágio pela tela da viagem.
          </p>
        )}
        {resultado.custoVeiculoSemViagem > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-alerta">
            {formatarMoeda(resultado.custoVeiculoSemViagem)} em custos de veículo sem
            viagem no período — caminhão parado continua custando, e o valor entra no
            resultado mesmo assim.
          </p>
        )}
      </Card>
    </div>
  )
}
