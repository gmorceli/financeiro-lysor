/**
 * Cálculos de negócio compartilhados entre servidor e interface.
 *
 * Ficam num módulo próprio para que a tela mostre exatamente a mesma conta que
 * o servidor grava — se divergirem, o operador confere um número e o relatório
 * mostra outro.
 */

export type RegraCobrancaAgregado = {
  percentualCte?: number
  percentualSeguroCarga?: number
}

/** Arredonda para centavos, evitando o resíduo binário do ponto flutuante. */
export function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Quanto a Lysor cobra do agregado por um frete.
 *
 * Conferido contra o acerto real de 27/08/2026: CT-e de R$ 11.642,00 e carga de
 * R$ 528.550,00 com 10% e 0,06% resultam em R$ 1.481,33.
 */
export function calcularCobrancaAgregado(
  valorCte: number,
  valorCargaNfe: number,
  regra: RegraCobrancaAgregado,
) {
  const comissao = arredondar((valorCte * (regra.percentualCte ?? 0)) / 100)
  const seguro = arredondar((valorCargaNfe * (regra.percentualSeguroCarga ?? 0)) / 100)
  return { comissao, seguro, total: arredondar(comissao + seguro) }
}

/**
 * Comissão do motorista. A base padrão é o valor real do frete, não o do CT-e:
 * parte dos CT-e é emitida pelo mínimo e a comissão segue o que foi combinado.
 */
export function calcularComissaoMotorista(
  valorFreteReal: number,
  valorCte: number,
  percentual: number,
  base: 'FRETE_REAL' | 'VALOR_CTE',
) {
  const valorBase = base === 'FRETE_REAL' ? valorFreteReal : valorCte
  return arredondar((valorBase * percentual) / 100)
}

/** Km rodado, carregado e vazio de uma viagem fechada. */
export function calcularKm(kmInicial: number, kmFinal: number, kmCarregado?: number) {
  const rodado = Math.max(0, kmFinal - kmInicial)
  const carregado = kmCarregado === undefined ? undefined : Math.min(kmCarregado, rodado)
  const vazio = carregado === undefined ? undefined : rodado - carregado
  return { rodado, carregado, vazio }
}

/**
 * Consumo médio entre dois abastecimentos de tanque cheio. Abastecimento
 * parcial não fecha média, então a função exige os dois odômetros.
 */
export function calcularConsumo(
  odometroAnterior: number,
  odometroAtual: number,
  litros: number,
) {
  if (litros <= 0 || odometroAtual <= odometroAnterior) return null
  return arredondar((odometroAtual - odometroAnterior) / litros)
}

/**
 * Soma meses a uma data mantendo o dia dentro do mês de destino.
 *
 * `setMonth` do JavaScript transborda: 31 de janeiro mais um mês vira 3 de
 * março, e um parcelamento de manutenção feito no fim do mês saía com uma
 * parcela na data errada e a seguinte de volta no lugar certo. Aqui o dia é
 * grampeado no último do mês de destino — 31/01 vira 28/02, que é o que
 * qualquer boleto faz.
 *
 * Tudo em UTC, porque as colunas de data do banco são `date` e o servidor não
 * necessariamente roda no fuso de Mato Grosso.
 */
export function somarMeses(data: Date, meses: number): Date {
  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth()
  const dia = data.getUTCDate()
  const ultimoDoDestino = new Date(Date.UTC(ano, mes + meses + 1, 0)).getUTCDate()
  return new Date(
    Date.UTC(
      ano,
      mes + meses,
      Math.min(dia, ultimoDoDestino),
      data.getUTCHours(),
      data.getUTCMinutes(),
      data.getUTCSeconds(),
      data.getUTCMilliseconds(),
    ),
  )
}
