/**
 * Verifica que o sistema serve no celular, em 375px.
 *
 * Metade desta operação acontece no telefone, boa parte dela de madrugada e com
 * o caminhão do lado. "Responsivo" não é o que o CSS promete: é o que sobra
 * medido na tela mais apertada que ainda se usa. Este arquivo mede quatro
 * coisas, cada uma porque já falhou aqui:
 *
 * 1. a página não pode rolar de lado — item de grade tem `min-width: auto`, e
 *    uma tabela larga dentro de um cartão esticava a coluna até o cabeçalho
 *    terminar no meio da tela;
 * 2. campo de digitação com fonte menor que 16px faz o Safari do iOS dar zoom
 *    ao focar, e a pessoa perde o formulário de vista no meio da digitação;
 * 3. alvo de toque abaixo de 40px é erro de dedo — links dentro de tabela
 *    tinham a altura do texto, 16px;
 * 4. nada pode estourar a largura do que o contém.
 *
 * Precisa do servidor no ar e do Chromium, como o `verificar:navegador`:
 *
 *   npx playwright install chromium
 *   npm run build && npm start
 *   npm run verificar:mobile
 */
import { createHash, randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE_URL ?? 'http://localhost:3100'
/** iPhone SE: a largura mais apertada que ainda aparece de verdade. */
const LARGURA = 375
const ALVO_MINIMO = 40

const prisma = new PrismaClient()
let falhas = 0

async function main() {
  let playwright
  try {
    playwright = await import('playwright')
  } catch {
    console.error('Playwright não está instalado. Rode: npm i -D playwright && npx playwright install chromium')
    process.exit(1)
  }

  try {
    const r = await fetch(`${BASE}/entrar`)
    if (!r.ok) throw new Error(String(r.status))
  } catch {
    console.error(`Nada respondendo em ${BASE}. Suba o servidor antes (npm start).`)
    process.exit(1)
  }

  const usuario = await prisma.usuario.findFirstOrThrow({ where: { perfil: 'ADMIN' } })
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { trocarSenha: false, ativo: true },
  })
  const token = randomBytes(32).toString('base64url')
  await prisma.sessao.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      usuarioId: usuario.id,
      expiraEm: new Date(Date.now() + 86400000),
    },
  })
  const viagem = await prisma.viagem.findFirstOrThrow({ orderBy: { criadoEm: 'desc' } })
  const motorista = await prisma.motorista.findFirstOrThrow({ where: { ativo: true } })
  const agregado = await prisma.proprietario.findFirstOrThrow({ where: { ativo: true } })
  const manutencao = await prisma.manutencao.findFirstOrThrow({ orderBy: { criadoEm: 'desc' } })
  const abastecimento = await prisma.abastecimento.findFirstOrThrow({
    orderBy: { criadoEm: 'desc' },
  })
  const despesaAvulsa = await prisma.lancamento.findFirstOrThrow({
    where: {
      tipo: 'DESPESA',
      freteId: null,
      parcelamentoId: null,
      acertoId: null,
      recorrenciaId: null,
      abastecimento: { is: null },
      manutencao: { is: null },
      acertoGerado: { is: null },
    },
    orderBy: { criadoEm: 'desc' },
  })
  const freteProprio = await prisma.frete.findFirstOrThrow({
    where: { modalidade: 'FROTA_PROPRIA', status: { not: 'CANCELADO' }, viagemId: { not: null } },
    orderBy: { criadoEm: 'desc' },
  })

  const ROTAS = [
    '/', '/viagens', '/viagens/nova', `/viagens/${viagem.id}`,
    '/fretes', `/viagens/${viagem.id}/fretes/novo`, '/fretes/agregado/novo', '/fretes/importar',
    `/fretes/${freteProprio.id}`,
    '/custos', '/custos/abastecimentos/novo', '/custos/manutencoes/novo',
    '/custos/manutencoes', `/custos/manutencoes/${manutencao.id}`,
    '/custos/abastecimentos', `/custos/abastecimentos/${abastecimento.id}`,
    '/custos/despesas', '/custos/despesas/nova', `/custos/despesas/${despesaAvulsa.id}`,
    `/viagens/${viagem.id}/despesas/novo`,
    '/financeiro', '/financeiro/pagar', '/financeiro/receber',
    '/acertos', `/acertos/motorista/${motorista.id}`, `/acertos/agregado/${agregado.id}`,
    '/relatorios', '/relatorios/fretes',
    '/cadastros/veiculos', '/cadastros/veiculos/novo', '/cadastros/motoristas/novo',
    '/cadastros/clientes/novo', '/cadastros/agregados/novo', '/cadastros/fornecedores/novo',
    '/usuarios', '/usuarios/novo', `/usuarios/${usuario.id}`, '/conta/senha',
  ]

  const navegador = await playwright.chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  })
  const perfil = { ...playwright.devices['iPhone SE'], viewport: { width: LARGURA, height: 667 } }

  const contexto = await navegador.newContext(perfil)
  await contexto.addCookies([{ name: 'lysor_sessao', value: token, url: BASE }])
  const pagina = await contexto.newPage()

  /**
   * A medição vai para o navegador como texto, não como função.
   *
   * O `tsx` compila com esbuild, que injeta um helper `__name` em toda função
   * nomeada. Esse helper não existe dentro da página, e o `evaluate` morre com
   * "__name is not defined" antes de medir qualquer coisa. Em forma de string,
   * o código chega ao navegador exatamente como está escrito aqui.
   */
  const MEDIR = `(() => {
    const largura = ${LARGURA}
    const minimo = ${ALVO_MINIMO}
    const r = { rolaDeLado: false, excedem: [], alvosPequenos: [], fontePequena: [] }
    r.rolaDeLado = document.documentElement.scrollWidth > largura + 1

    const rolaveis = new Set()
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el)
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') rolaveis.add(el)
    }
    const dentroDeRolavel = (el) => {
      for (let p = el; p; p = p.parentElement) if (rolaveis.has(p)) return true
      return false
    }

    for (const el of document.querySelectorAll('body *')) {
      const c = el.getBoundingClientRect()
      if (c.width === 0 || c.height === 0) continue
      if (c.right > largura + 1 && !dentroDeRolavel(el)) {
        const d = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')
        if (!r.excedem.includes(d)) r.excedem.push(d)
      }
    }

    for (const el of document.querySelectorAll('a, button, input, select, textarea, [role=button]')) {
      const c = el.getBoundingClientRect()
      if (c.width === 0 || c.height === 0) continue
      if (getComputedStyle(el).display === 'none') continue
      if (el.type === 'hidden') continue
      // <a><button/></a>: quem recebe o toque é o botão, que tem altura própria.
      if (el.tagName === 'A' && el.querySelector('button')) continue
      // checkbox mora dentro de um <label> que é o alvo de verdade.
      if ((el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) continue
      if (c.height < minimo) {
        const rotulo = (el.textContent || el.getAttribute('name') || el.tagName).trim().slice(0, 26)
        const d = el.tagName.toLowerCase() + ' "' + rotulo + '" ' + Math.round(c.height) + 'px'
        if (!r.alvosPequenos.includes(d)) r.alvosPequenos.push(d)
      }
    }

    for (const el of document.querySelectorAll('input, select, textarea')) {
      // checkbox e radio não recebem digitação: o iOS não dá zoom neles.
      if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden') continue
      const t = parseFloat(getComputedStyle(el).fontSize)
      if (t < 16) r.fontePequena.push(el.tagName.toLowerCase() + '[' + (el.name || '') + '] ' + t + 'px')
    }

    return r
  })()`

  type Medida = {
    rolaDeLado: boolean
    excedem: string[]
    alvosPequenos: string[]
    fontePequena: string[]
  }

  const medir = (p: { evaluate: (e: string) => Promise<unknown> }): Promise<Medida> =>
    p.evaluate(MEDIR) as Promise<Medida>

  function relatar(rota: string, status: number | undefined, d: Medida) {
    const f: string[] = []
    if (status !== 200) f.push(`status ${status}`)
    if (d.rolaDeLado) f.push('a página rola de lado')
    if (d.excedem.length) f.push(`estouram a largura: ${d.excedem.slice(0, 4).join(', ')}`)
    if (d.alvosPequenos.length)
      f.push(`alvo de toque < ${ALVO_MINIMO}px: ${d.alvosPequenos.slice(0, 4).join(' | ')}`)
    if (d.fontePequena.length)
      f.push(`campo com fonte < 16px, o iOS dá zoom: ${[...new Set(d.fontePequena)].slice(0, 3).join(', ')}`)

    console.log(`${f.length ? ' FALHA' : '  ok  '} ${rota}${f.length ? '\n       ' + f.join('\n       ') : ''}`)
    if (f.length) falhas++
  }

  for (const rota of ROTAS) {
    const resp = await pagina.goto(`${BASE}${rota}`, { waitUntil: 'load' })
    relatar(rota, resp?.status(), await medir(pagina))
  }

  // /entrar só existe deslogada: contexto próprio, senão o cookie a redireciona.
  const anonimo = await navegador.newContext(perfil)
  const paginaAnonima = await anonimo.newPage()
  const resp = await paginaAnonima.goto(`${BASE}/entrar`, { waitUntil: 'load' })
  relatar('/entrar', resp?.status(), await medir(paginaAnonima))

  await navegador.close()
  console.log(
    falhas === 0
      ? `\n${ROTAS.length + 1} telas verificadas em ${LARGURA}px.`
      : `\n${falhas} tela(s) com problema em ${LARGURA}px.`,
  )
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
