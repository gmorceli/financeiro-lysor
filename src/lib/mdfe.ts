import { XMLParser } from 'fast-xml-parser'

/**
 * Leitura do MDF-e — o manifesto que a cliente já emite hoje.
 *
 * Ele não era o arquivo pedido: o pedido era o CT-e, para pegar o valor da
 * carga. O MDF-e entrega isso e mais, e nos 28 arquivos de setembro cada um
 * trouxe **exatamente um CT-e** — o que faz dele um registro por frete.
 *
 * O campo que decide tudo é `veicTracao/prop`: quando existe, o caminhão é de
 * terceiro e o frete é de agregado; quando não existe, é da frota. É a mesma
 * escolha que hoje o operador faz na tela, só que declarada na nota fiscal.
 */

/**
 * Tudo como texto, sem exceção.
 *
 * O parser converte número por padrão, e a chave do CT-e tem 44 dígitos: vira
 * `5.126e+43` e a chave se perde. CPF com zero à esquerda perde o zero. Os
 * valores viram número aqui embaixo, um a um, onde é seguro.
 */
const leitor = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
})

export type ManifestoLido = {
  chaveMdfe: string
  numero: string
  dataEmissao: Date
  dataViagem: Date
  origem: string
  destino: string
  /** Chave do CT-e transportado. É por ela que a importação não repete frete. */
  chaveCte: string | null
  numeroCte: string | null
  quantosCte: number
  placaTracao: string
  placaReboque: string | null
  motoristaNome: string | null
  motoristaCpf: string | null
  /** Preenchido só quando o caminhão é de terceiro: é o agregado. */
  proprietarioNome: string | null
  proprietarioDoc: string | null
  /** Quem responde pelo pagamento do frete no CIOT. */
  pagadorNome: string | null
  pagadorDoc: string | null
  valorFrete: number
  valorCarga: number
  pesoKg: number | null
  produto: string | null
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const s = String(valor).trim()
  return s === '' ? null : s
}

function numero(valor: unknown): number {
  const s = texto(valor)
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function somenteDigitos(valor: unknown): string | null {
  const s = texto(valor)
  if (!s) return null
  const d = s.replace(/\D/g, '')
  return d === '' ? null : d
}

/** Um nó que pode vir sozinho ou em lista, dependendo de quantos são. */
function lista<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === null || valor === undefined) return []
  return Array.isArray(valor) ? valor : [valor]
}

/**
 * Data de um campo `dhEmi`/`dhIniViagem` como dia de calendário.
 *
 * O XML traz `2026-09-30T21:15:00-04:00`. `new Date()` disso é 01/10 em UTC, e
 * as colunas de data do banco são `date` truncado em UTC — o manifesto emitido
 * à noite caía no dia seguinte, e no fim do mês caía no mês seguinte, mudando
 * o resultado de dois períodos de uma vez. O dia que vale é o declarado no
 * documento, no fuso do documento: os dez primeiros caracteres.
 */
function dataDoDocumento(valor: string | null | undefined): Date {
  const casa = valor?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!casa) {
    const agora = new Date()
    return new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
    )
  }
  return new Date(Date.UTC(Number(casa[1]), Number(casa[2]) - 1, Number(casa[3])))
}

/**
 * Lê um XML de MDF-e. Devolve `null` quando o arquivo não é um MDF-e — o que
 * acontece o tempo todo, porque o emissor exporta o manifesto e os eventos de
 * encerramento na mesma pasta, e a pessoa vai selecionar tudo.
 */
export function lerManifesto(xml: string): ManifestoLido | null {
  let raiz: Record<string, any>
  try {
    raiz = leitor.parse(xml)
  } catch {
    return null
  }

  const mdfe = raiz?.mdfeProc?.MDFe ?? raiz?.MDFe
  const inf = mdfe?.infMDFe
  if (!inf?.ide) return null
  // Modelo 58 é MDF-e. Qualquer outro (57 é CT-e, 55 é NF-e) não é deste leitor.
  if (texto(inf.ide.mod) !== '58') return null

  const rodo = inf.infModal?.rodo
  const tracao = rodo?.veicTracao
  if (!tracao) return null

  const descargas = lista<any>(inf.infDoc?.infMunDescarga)
  const chaves = descargas.flatMap((d) => lista<any>(d.infCTe)).map((c) => texto(c.chCTe))
  const chaveCte = chaves.find(Boolean) ?? null

  const dhEmi = texto(inf.ide.dhEmi)
  const dhViagem = texto(inf.ide.dhIniViagem) ?? dhEmi

  const prop = tracao.prop
  const pag = rodo?.infANTT?.infPag

  return {
    chaveMdfe: (texto(inf['@Id']) ?? '').replace(/^MDFe/, ''),
    numero: texto(inf.ide.nMDF) ?? '',
    dataEmissao: dataDoDocumento(dhEmi),
    dataViagem: dataDoDocumento(dhViagem),
    origem: texto(inf.ide.infMunCarrega?.xMunCarrega) ?? '',
    destino: descargas.map((d) => texto(d.xMunDescarga)).filter(Boolean).join(', ') || '',
    chaveCte,
    // Posições 26 a 34 da chave são o número do documento.
    numeroCte: chaveCte ? String(Number(chaveCte.slice(25, 34))) : null,
    quantosCte: chaves.length,
    placaTracao: (texto(tracao.placa) ?? '').toUpperCase(),
    placaReboque: texto(lista<any>(rodo?.veicReboque)[0]?.placa)?.toUpperCase() ?? null,
    motoristaNome: texto(tracao.condutor?.xNome),
    motoristaCpf: somenteDigitos(tracao.condutor?.CPF),
    proprietarioNome: texto(prop?.xNome),
    proprietarioDoc: somenteDigitos(prop?.CNPJ ?? prop?.CPF),
    pagadorNome: texto(pag?.xNome),
    pagadorDoc: somenteDigitos(pag?.CNPJ ?? pag?.CPF),
    valorFrete: numero(pag?.vContrato),
    valorCarga: numero(inf.tot?.vCarga),
    // cUnid 01 é quilo. Em qualquer outra unidade o peso não vira kg aqui.
    pesoKg: texto(inf.tot?.cUnid) === '01' ? Math.round(numero(inf.tot?.qCarga)) : null,
    produto: texto(inf.prodPred?.xProd),
  }
}

/** O caminhão é de terceiro? Então o frete é de agregado. */
export function ehAgregado(m: ManifestoLido): boolean {
  return m.proprietarioDoc !== null
}
