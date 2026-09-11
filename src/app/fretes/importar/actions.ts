'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  conferirManifestos,
  importarLinha,
  lerArquivos,
  type LinhaConferida,
  type Pendencia,
} from '@/lib/importacao'
import { exigirAcesso } from '@/lib/sessao'

export type LinhaNaTela = {
  chaveCte: string
  chaveMdfe: string
  numeroMdfe: string
  numeroCte: string | null
  data: string
  origem: string
  destino: string
  agregado: boolean
  pendencias: Pendencia[]
  pronta: boolean
  veiculoApelido: string | null
  placa: string
  motoristaNome: string | null
  motoristaDoXml: string | null
  proprietarioNome: string | null
  proprietarioDoXml: string | null
  clienteId: string | null
  clienteNome: string | null
  pagadorDoXml: string | null
  valorCte: number
  valorCarga: number
  comissao: number
  seguro: number
  produto: string | null
}

export type EstadoImportacao = {
  erroGeral?: string
  aviso?: string
  linhas?: LinhaNaTela[]
  lidos?: number
  arquivos?: number
  importados?: number
  ok?: boolean
}

function paraTela(l: LinhaConferida): LinhaNaTela {
  const m = l.manifesto
  return {
    chaveCte: m.chaveCte ?? '',
    chaveMdfe: m.chaveMdfe,
    numeroMdfe: m.numero,
    numeroCte: m.numeroCte,
    data: m.dataViagem.toISOString(),
    origem: m.origem,
    destino: m.destino,
    agregado: l.agregado,
    pendencias: l.pendencias,
    pronta: l.pronta,
    veiculoApelido: l.veiculoApelido,
    placa: m.placaTracao,
    motoristaNome: l.motoristaNome,
    motoristaDoXml: m.motoristaNome,
    proprietarioNome: l.proprietarioNome,
    proprietarioDoXml: m.proprietarioNome,
    clienteId: l.clienteId,
    clienteNome: l.clienteNome,
    pagadorDoXml: m.pagadorNome,
    valorCte: m.valorFrete,
    valorCarga: m.valorCarga,
    comissao: l.comissao,
    seguro: l.seguro,
    produto: m.produto,
  }
}

/**
 * Uma action só para as duas etapas, porque os arquivos ficam no mesmo
 * formulário: o navegador reenvia a seleção no segundo clique, e o servidor
 * relê o XML em vez de confiar no que a tela devolveu. É o que garante que o
 * valor importado é o do documento fiscal, não o que voltou do navegador.
 */
export async function processarImportacao(
  _estado: EstadoImportacao,
  formData: FormData,
): Promise<EstadoImportacao> {
  await exigirAcesso('operacao')

  // O conteúdo vem como texto, não como arquivo. O React 19 limpa os campos do
  // formulário depois que a action responde, e o `input type=file` volta vazio:
  // o segundo clique chegaria sem nada. Então a tela lê os arquivos no
  // navegador e manda o XML, que o servidor reabre e relê — o valor importado
  // continua saindo do documento fiscal, não do que a tela disse.
  const conteudos = formData.getAll('conteudo').map(String).filter((c) => c.trim() !== '')
  const enviados = conteudos
  if (conteudos.length === 0) {
    return { erroGeral: 'Escolha os arquivos XML do MDF-e.' }
  }
  if (conteudos.length > 200) {
    return { erroGeral: 'São muitos manifestos de uma vez. Faça em partes de até 200.' }
  }
  const manifestos = lerArquivos(conteudos)
  if (manifestos.length === 0) {
    return {
      erroGeral:
        'Nenhum manifesto encontrado. O emissor exporta o MDF-e e os eventos de encerramento juntos — selecione a pasta inteira, que o sistema separa.',
      arquivos: conteudos.length,
    }
  }

  const conferidas = await conferirManifestos(manifestos)
  const linhas = conferidas.map(paraTela)

  if (formData.get('acao') !== 'importar') {
    return { linhas, lidos: manifestos.length, arquivos: conteudos.length }
  }

  const fluxo = formData.get('fluxoFinanceiro') === 'DIRETO' ? 'DIRETO' : 'INTERMEDIADO'
  let importados = 0

  for (const linha of conferidas) {
    const chave = linha.manifesto.chaveCte
    if (!chave) continue
    if (!linha.pronta) continue
    if (formData.get(`importar_${chave}`) !== 'sim') continue

    const clienteEscolhido = formData.get(`cliente_${chave}`)?.toString() || undefined
    const realDigitado = Number(formData.get(`real_${chave}`)?.toString() || '')

    try {
      const r = await prisma.$transaction((tx) =>
        importarLinha(tx, linha, {
          clienteId: clienteEscolhido,
          valorFreteReal: Number.isFinite(realDigitado) ? realDigitado : undefined,
          fluxoFinanceiro: fluxo,
        }),
      )
      if (r.criado) importados++
    } catch (erro) {
      return {
        linhas,
        lidos: manifestos.length,
        importados,
        erroGeral: `Parou no CT-e ${linha.manifesto.numeroCte}: ${
          erro instanceof Error ? erro.message : 'erro ao importar'
        }. O que já entrou está salvo.`,
      }
    }
  }

  revalidatePath('/fretes')
  revalidatePath('/viagens')
  revalidatePath('/financeiro')
  return { ok: true, importados, lidos: manifestos.length }
}

export async function listarClientes() {
  await exigirAcesso('operacao')
  return prisma.cliente.findMany({
    where: { ativo: true },
    select: { id: true, razaoSocial: true, nomeFantasia: true },
    orderBy: { razaoSocial: 'asc' },
  })
}
