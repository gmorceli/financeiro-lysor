/**
 * Verifica a importação de MDF-e.
 *
 * Duas famílias de asserção. A primeira é sobre **ler sem estragar**: chave de
 * CT-e com 44 dígitos e CPF com zero à esquerda são as duas coisas que um
 * parser de XML destrói sozinho ao converter número, e foi exatamente o que
 * aconteceu na primeira versão deste leitor.
 *
 * A segunda é sobre **não inventar cadastro**: quando falta veículo, motorista,
 * agregado ou cliente, a linha não entra e a tela diz o quê. Importar criando
 * cliente com prazo zero faria o fluxo de caixa projetar dinheiro à vista; criar
 * motorista com comissão zero faria o acerto pagar a menos. Os dois erros só
 * apareceriam semanas depois.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { lerManifesto, ehAgregado } from '../src/lib/mdfe'
import { conferirManifestos, importarLinha, lerArquivos } from '../src/lib/importacao'
import { montarChave, montarEventoEncerramento, montarMdfe } from './exemplos/mdfe'
import { arredondar } from '../src/lib/calculos'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const MARCA = 'teste-importacao'
const PLACA_PROPRIA = 'ABC1D23'
const CPF_MOTORISTA = '00717785190' // zero à esquerda de propósito
const DOC_AGREGADO = '43034632800'
// CNPJ de teste, nunca de cliente real: a limpeza apaga o registro, e um dia
// esse número pode existir de verdade no cadastro dela.
const CNPJ_CLIENTE = '99000111000199'

async function limpar() {
  const fretes = await prisma.frete.findMany({
    where: { OR: [{ observacoes: { contains: 'MDF-e' } }, { observacoes: MARCA }] },
    select: { id: true, viagemId: true },
  })
  const ids = fretes.map((f) => f.id)
  await prisma.baixa.deleteMany({ where: { lancamento: { freteId: { in: ids } } } })
  await prisma.lancamento.deleteMany({ where: { freteId: { in: ids } } })
  await prisma.frete.deleteMany({ where: { id: { in: ids } } })
  await prisma.viagem.deleteMany({ where: { observacoes: { contains: 'MDF-e' } } })
  await prisma.veiculo.deleteMany({ where: { placa: PLACA_PROPRIA } })
  await prisma.proprietario.deleteMany({ where: { nome: { contains: MARCA } } })
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ_CLIENTE } })
  await prisma.motorista.deleteMany({ where: { cpf: CPF_MOTORISTA } })
}

async function main() {
  await limpar()

  // --- 1. Ler sem estragar -------------------------------------------------
  const chaveCte = montarChave('57', 432)
  const baseManifesto = {
    numero: '387',
    chaveMdfe: montarChave('58', 387),
    chaveCte,
    dhEmi: '2026-09-04T10:29:11-04:00',
    dhIniViagem: '2026-09-04T10:40:33-04:00',
    municipioCarga: 'Santo Antônio do Leverger',
    municipioDescarga: 'Paranatinga',
    placa: PLACA_PROPRIA,
    placaReboque: 'XYZ9W88',
    motoristaNome: 'Robson de Arruda e Silva',
    motoristaCpf: CPF_MOTORISTA,
    pagadorNome: 'Pecuarista de teste',
    pagadorDoc: CNPJ_CLIENTE,
    vContrato: 5970,
    vCarga: 390630.78,
    qCarga: 20500,
  }
  const xml = montarMdfe(baseManifesto)

  const m = lerManifesto(xml)
  checar('lê um MDF-e', m !== null)
  checar(
    'a chave do CT-e chega com os 44 dígitos',
    m?.chaveCte === chaveCte && m.chaveCte.length === 44,
    m?.chaveCte ?? 'nula',
  )
  checar(
    'e não vira notação científica',
    !String(m?.chaveCte).includes('e+'),
    'é o que acontece quando o parser converte número sozinho',
  )
  checar(
    'o CPF do motorista mantém o zero à esquerda',
    m?.motoristaCpf === CPF_MOTORISTA,
    m?.motoristaCpf ?? 'nulo',
  )
  checar('o número do CT-e sai da chave', m?.numeroCte === '432', m?.numeroCte ?? '')
  checar('valor do frete vem do CIOT', m?.valorFrete === 5970)
  checar('valor da carga vem do total', m?.valorCarga === 390630.78)
  checar('peso em quilos', m?.pesoKg === 20500)
  checar(
    'a data da viagem é a de início, não a de emissão',
    m?.dataViagem.toISOString().slice(0, 10) === '2026-09-04',
    m?.dataViagem.toISOString() ?? 'nulo',
  )
  // O manifesto emitido de noite em Mato Grosso (UTC−4) vira o dia seguinte se
  // a data for convertida para UTC antes de ser truncada. No último dia do mês
  // isso mudava o resultado de dois períodos de uma vez.
  const noturno = lerManifesto(
    montarMdfe({ ...baseManifesto, numero: '99', dhEmi: '2026-09-30T21:15:00-04:00' }),
  )
  checar(
    'manifesto da noite não escorrega para o dia seguinte',
    noturno?.dataEmissao.toISOString().slice(0, 10) === '2026-09-30',
    noturno?.dataEmissao.toISOString() ?? 'nulo',
  )
  checar('sem dono declarado, o caminhão é da frota', m !== null && !ehAgregado(m))

  const comDono = lerManifesto(
    montarMdfe({
      numero: '392', chaveMdfe: montarChave('58', 392), chaveCte: montarChave('57', 437),
      dhEmi: '2026-09-04T10:00:00-04:00', municipioCarga: 'Nova Mutum', municipioDescarga: 'Várzea Grande',
      placa: 'QCM7I53', motoristaNome: 'Walmir Costa de Deus', motoristaCpf: '84452773168',
      proprietario: { nome: 'Dorival Osti', doc: DOC_AGREGADO, rntrc: '02308443' },
      pagadorNome: 'LYSOR TRANSPORTES LTDA', pagadorDoc: '64500634000196',
      vContrato: 1700, vCarga: 81000,
    }),
  )
  checar('com dono declarado, o frete é de agregado', comDono !== null && ehAgregado(comDono))
  checar('e o dono vem com documento', comDono?.proprietarioDoc === DOC_AGREGADO)

  // --- 2. Ignorar o que não é MDF-e ---------------------------------------
  checar('evento de encerramento é ignorado', lerManifesto(montarEventoEncerramento(montarChave('58', 387))) === null)
  checar('XML quebrado não derruba, devolve nulo', lerManifesto('<isso não é xml') === null)
  checar('arquivo vazio devolve nulo', lerManifesto('') === null)
  checar(
    'modelo 57 (CT-e) não é lido por este leitor',
    lerManifesto(montarMdfe({
      numero: '1', chaveMdfe: montarChave('58', 1), chaveCte: montarChave('57', 1), modelo: '57',
      dhEmi: '2026-09-01T10:00:00-04:00', municipioCarga: 'A', municipioDescarga: 'B', placa: 'AAA1A11',
      motoristaNome: 'x', motoristaCpf: '11111111111', pagadorNome: 'y', pagadorDoc: '11111111111',
      vContrato: 1, vCarga: 1,
    })) === null,
  )

  const lote = lerArquivos([xml, montarEventoEncerramento('x'), xml, 'lixo'])
  checar('lote descarta o que não serve e não repete manifesto', lote.length === 1)

  // --- 3. Conferência: o que falta bloqueia -------------------------------
  const semNada = await conferirManifestos([m!])
  checar(
    'sem cadastro nenhum, a linha não está pronta',
    !semNada[0].pronta,
    semNada[0].pendencias.join(', '),
  )
  checar(
    'e diz que falta veículo, motorista e cliente',
    ['VEICULO_NAO_CADASTRADO', 'MOTORISTA_NAO_CADASTRADO', 'CLIENTE_NAO_CADASTRADO'].every((p) =>
      semNada[0].pendencias.includes(p as never),
    ),
  )

  let recusou = false
  try {
    await prisma.$transaction((tx) => importarLinha(tx, semNada[0], {}))
  } catch {
    recusou = true
  }
  checar('importar uma linha com pendência é recusado', recusou)
  checar('e nada foi criado', (await prisma.frete.count({ where: { chaveCte } })) === 0)

  // --- 4. Com os cadastros, importa ---------------------------------------
  const veiculo = await prisma.veiculo.create({
    data: { apelido: `Importado ${MARCA}`, placa: PLACA_PROPRIA, tipo: 'CAVALO', odometroAtual: 412000 },
  })
  const motorista = await prisma.motorista.create({
    data: {
      nome: 'Robson de Arruda e Silva', cpf: CPF_MOTORISTA, vinculo: 'CLT',
      modeloRemuneracao: 'COMISSAO', percentualComissao: 12, baseComissao: 'FRETE_REAL',
    },
  })
  const cliente = await prisma.cliente.upsert({
    where: { cnpj: CNPJ_CLIENTE }, update: { prazoPagamentoDias: 30 },
    create: { razaoSocial: `Pecuarista ${MARCA}`, cnpj: CNPJ_CLIENTE, prazoPagamentoDias: 30 },
  })

  const pronta = (await conferirManifestos([m!]))[0]
  checar('com tudo cadastrado, a linha fica pronta', pronta.pronta, pronta.pendencias.join(', ') || 'sem pendência')
  checar('casou a placa com o apelido', pronta.veiculoApelido === veiculo.apelido)
  checar('casou o CPF com o motorista', pronta.motoristaId === motorista.id)
  checar('casou o documento do pagador com o cliente', pronta.clienteId === cliente.id)

  // O CT-e saiu pelo mínimo: o valor combinado é outro.
  const r = await prisma.$transaction((tx) => importarLinha(tx, pronta, { valorFreteReal: 9564 }))
  checar('importou', r.criado === true)

  const frete = await prisma.frete.findUniqueOrThrow({
    where: { chaveCte },
    include: { viagem: true, lancamentos: true },
  })
  checar('criou viagem junto com o frete', frete.viagemId !== null)
  checar(
    'a viagem nasce com o odômetro atual do veículo',
    frete.viagem?.kmInicial === 412000,
    `km ${frete.viagem?.kmInicial}`,
  )
  checar('e em andamento, para a pessoa fechar com o km real', frete.viagem?.status === 'EM_ANDAMENTO')
  checar('guardou o valor do CT-e', Number(frete.valorCte) === 5970)
  checar(
    'e o valor real corrigido na conferência',
    Number(frete.valorFreteReal) === 9564,
    'é sobre ele que a comissão de 12% incide',
  )
  checar('guardou o valor da carga', Number(frete.valorCargaNfe) === 390630.78)
  checar('guardou o produto e o peso', frete.produto !== null && frete.pesoKg === 20500)
  checar('gerou o recebível do cliente', frete.lancamentos.length === 1 && frete.lancamentos[0].tipo === 'RECEITA')
  checar(
    'pelo valor real, não pelo do CT-e',
    Number(frete.lancamentos[0].valor) === 9564,
  )

  // --- 5. Não importa duas vezes ------------------------------------------
  const denovo = await conferirManifestos([m!])
  checar('na segunda leitura a linha vem marcada como já importada', denovo[0].pendencias.includes('JA_IMPORTADO'))
  checar('e não está pronta', !denovo[0].pronta)
  const fretesAntes = await prisma.frete.count()
  await prisma.$transaction((tx) => importarLinha(tx, { ...denovo[0], pronta: true }, {}))
  checar(
    'e mesmo forçando, a chave do CT-e impede o frete repetido',
    (await prisma.frete.count()) === fretesAntes,
  )

  // --- 6. Agregado ---------------------------------------------------------
  // O agregado do seed tem documento a definir; o teste cria o seu, com o CPF
  // que aparece no manifesto.
  const agregado = await prisma.proprietario.upsert({
    where: { cpfCnpj: DOC_AGREGADO },
    update: {},
    create: {
      nome: `Dorival Osti ${MARCA}`,
      cpfCnpj: DOC_AGREGADO,
      tipoPessoa: 'PF',
      regraCobranca: {
        percentualCte: 10,
        percentualSeguroCarga: 0.06,
        quemPagaCombustivel: 'AGREGADO',
        quemPagaPedagio: 'AGREGADO',
        descontosAplicaveis: [],
        momentoAcerto: 'AO_RECEBER',
      },
    },
  })
  {
    const linhaAg = (await conferirManifestos([comDono!]))[0]
    checar('a linha de agregado exige escolher o cliente', linhaAg.pendencias.includes('ESCOLHER_CLIENTE'))
    checar(
      'mas isso não bloqueia: é escolha, não falta de cadastro',
      linhaAg.pronta,
      linhaAg.pendencias.join(', '),
    )
    const regra = agregado.regraCobranca as { percentualCte: number; percentualSeguroCarga: number }
    checar(
      'a comissão já vem calculada pela regra do agregado',
      linhaAg.comissao === arredondar(1700 * (regra.percentualCte / 100)),
      `R$ ${linhaAg.comissao} sobre R$ 1.700`,
    )
    checar(
      'e o seguro sobre o valor da carga do manifesto',
      linhaAg.seguro === arredondar(81000 * (regra.percentualSeguroCarga / 100)),
      `R$ ${linhaAg.seguro} sobre R$ 81.000 — o número que ela digitava à mão`,
    )

    await prisma.$transaction((tx) => importarLinha(tx, linhaAg, { clienteId: cliente.id }))
    const freteAg = await prisma.frete.findUniqueOrThrow({
      where: { chaveCte: comDono!.chaveCte! },
      include: { lancamentos: { include: { categoria: true } } },
    })
    checar('frete de agregado não cria viagem', freteAg.viagemId === null)
    checar('e aponta para o agregado', freteAg.proprietarioId === agregado.id)
    checar(
      'gerou os dois títulos do fluxo intermediado',
      freteAg.lancamentos.length === 2,
      freteAg.lancamentos.map((l) => l.categoria.nome).join(' + '),
    )
    const repasse = freteAg.lancamentos.find((l) => l.tipo === 'DESPESA')
    checar(
      'e o repasse nasce sem vencimento, esperando o cliente pagar',
      repasse?.dataVencimento === null && repasse?.gatilhoVencimento === 'AO_RECEBER',
    )
  }

  // --- 7. Manifesto com mais de um CT-e -----------------------------------
  const varios = lerManifesto(
    montarMdfe({
      numero: '500', chaveMdfe: montarChave('58', 500), chaveCte: montarChave('57', 600),
      chavesExtras: [montarChave('57', 601)],
      dhEmi: '2026-09-09T10:00:00-04:00', municipioCarga: 'A', municipioDescarga: 'B',
      placa: PLACA_PROPRIA, motoristaNome: 'Robson de Arruda e Silva', motoristaCpf: CPF_MOTORISTA,
      pagadorNome: 'Pecuarista de teste', pagadorDoc: CNPJ_CLIENTE, vContrato: 1000, vCarga: 1000,
    }),
  )
  checar('manifesto com dois CT-e é detectado', varios?.quantosCte === 2)
  const linhaVarios = (await conferirManifestos([varios!]))[0]
  checar(
    'e não é importado: o valor não dá para dividir sozinho',
    !linhaVarios.pronta && linhaVarios.pendencias.includes('VARIOS_CTE'),
  )

  await limpar()
  console.log(falhas === 0 ? '\nImportação verificada.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
