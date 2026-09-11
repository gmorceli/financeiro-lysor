/**
 * Verifica a autenticação pelo navegador, de verdade.
 *
 * `verificar:auth` prova as regras; este arquivo prova a tela: que o formulário
 * posta, que o cookie sai com os atributos certos, que a senha provisória não
 * tem como ser contornada e que o menu de Operação não traz o financeiro.
 *
 * Precisa de duas coisas que os outros scripts não precisam — o servidor
 * rodando e o Chromium instalado:
 *
 *   npx playwright install chromium
 *   npm run build && npm start
 *   npm run verificar:navegador
 *
 * O Playwright não entra em `package.json` de propósito: ele baixaria um
 * navegador de ~150 MB em toda instalação, inclusive na do deploy, que não tem
 * a menor necessidade dele.
 */
import { PrismaClient } from '@prisma/client'
import { gerarHashSenha } from '../src/lib/senha'

const BASE = process.env.BASE_URL ?? 'http://localhost:3100'
const SENHA_ANA = 'beira-de-estrada-88'
const SENHA_HYGOR = 'rodovia-070-vazia'
const SENHA_NOVA_HYGOR = 'caminhao-do-hygor-9'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

async function main() {
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    console.error('Playwright não está instalado. Rode: npm i -D playwright && npx playwright install chromium')
    process.exit(1)
  }

  try {
    const resposta = await fetch(`${BASE}/entrar`)
    if (!resposta.ok) throw new Error(String(resposta.status))
  } catch {
    console.error(`Nada respondendo em ${BASE}. Suba o servidor antes (npm start).`)
    process.exit(1)
  }

  // Estado inicial determinístico: o script já rodou antes e trocou a senha do
  // Hygor, então ele reconstrói as duas contas em vez de confiar no que ficou.
  const contas = [
    { email: 'ana@lysor.com.br', nome: 'Ana Paula', perfil: 'ADMIN', senha: SENHA_ANA, trocarSenha: false },
    { email: 'hygor@lysor.com.br', nome: 'Hygor Silva', perfil: 'OPERACAO', senha: SENHA_HYGOR, trocarSenha: true },
  ] as const

  for (const conta of contas) {
    const dados = {
      nome: conta.nome,
      perfil: conta.perfil,
      senhaHash: await gerarHashSenha(conta.senha),
      trocarSenha: conta.trocarSenha,
      ativo: true,
      tentativasFalhas: 0,
      bloqueadoAte: null,
    }
    await prisma.usuario.upsert({
      where: { email: conta.email },
      update: dados,
      create: { email: conta.email, ...dados },
    })
  }
  await prisma.sessao.deleteMany({})

  const navegador = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  })

  // --- 1. Senha errada ------------------------------------------------------
  {
    const pagina = await (await navegador.newContext()).newPage()
    await pagina.goto(`${BASE}/entrar`)
    await pagina.fill('input[name=email]', 'ana@lysor.com.br')
    await pagina.fill('input[name=senha]', 'chute-errado-total')
    await pagina.click('button:has-text("Entrar")')
    await pagina.waitForSelector('text=E-mail ou senha incorretos')
    checar('senha errada mostra o aviso e não entra', pagina.url().includes('/entrar'))
  }

  // --- 2. Login, cookie e destino ------------------------------------------
  const contexto = await navegador.newContext()
  {
    const pagina = await contexto.newPage()
    await pagina.goto(`${BASE}/relatorios`)
    checar(
      'rota protegida manda pro login guardando o destino',
      pagina.url().includes('destino=%2Frelatorios'),
    )

    await pagina.fill('input[name=email]', 'ana@lysor.com.br')
    await pagina.fill('input[name=senha]', SENHA_ANA)
    await pagina.click('button:has-text("Entrar")')
    await pagina.waitForURL(`${BASE}/relatorios`, { timeout: 15000 })
    checar('login leva para onde a pessoa queria ir', pagina.url() === `${BASE}/relatorios`)

    const cookie = (await contexto.cookies()).find((c) => c.name === 'lysor_sessao')
    checar('cookie de sessão é httpOnly', cookie?.httpOnly === true)
    checar('cookie de sessão é sameSite Lax', cookie?.sameSite === 'Lax')
    checar(
      'cookie tem validade longa, não de sessão do navegador',
      (cookie?.expires ?? 0) > Date.now() / 1000 + 20 * 86400,
    )
    checar('a sessão existe no banco', (await prisma.sessao.count()) === 1)
    const linha = await prisma.sessao.findFirstOrThrow()
    checar('e o token do cookie não está guardado em claro', linha.tokenHash !== cookie?.value)

    await pagina.goto(`${BASE}/`)
    const cabecalho = (await pagina.textContent('header')) ?? ''
    checar('o nome da pessoa aparece no cabeçalho', cabecalho.includes('Ana'))
    checar('e o perfil também', cabecalho.includes('Administrador'))
  }

  // --- 3. Sair --------------------------------------------------------------
  {
    const pagina = await contexto.newPage()
    await pagina.goto(`${BASE}/`)
    await pagina.click('button:has-text("Sair")')
    await pagina.waitForURL(`${BASE}/entrar`, { timeout: 15000 })
    checar('sair volta para o login', pagina.url() === `${BASE}/entrar`)
    checar('e apaga a sessão do banco', (await prisma.sessao.count()) === 0)

    await pagina.goto(`${BASE}/financeiro`)
    checar('depois de sair a rota protegida barra de novo', pagina.url().includes('/entrar'))
  }

  // --- 4. Senha provisória e permissão de Operação -------------------------
  {
    const pagina = await (await navegador.newContext()).newPage()
    await pagina.goto(`${BASE}/entrar`)
    await pagina.fill('input[name=email]', 'hygor@lysor.com.br')
    await pagina.fill('input[name=senha]', SENHA_HYGOR)
    await pagina.click('button:has-text("Entrar")')
    await pagina.waitForURL(`${BASE}/conta/senha`, { timeout: 15000 })
    checar('senha provisória cai direto na troca de senha', pagina.url() === `${BASE}/conta/senha`)
    checar('a tela explica que a senha é provisória', (await pagina.content()).includes('Escolha sua senha'))

    await pagina.goto(`${BASE}/viagens`)
    checar('e não dá para escapar navegando', pagina.url() === `${BASE}/conta/senha`)

    // Atenção ao seletor: "Sair", no cabeçalho, também é `type=submit`, e
    // "Pelo menos 10 caracteres" também é a dica fixa do campo. Casar com
    // qualquer um dos dois faz a asserção passar sem ter provado nada.
    await pagina.fill('input[name=senhaAtual]', SENHA_HYGOR)
    await pagina.fill('input[name=senhaNova]', 'curta')
    await pagina.fill('input[name=confirmacao]', 'curta')
    await pagina.click('button:has-text("Salvar senha nova")')
    await pagina.waitForSelector('text=A senha precisa ter pelo menos')
    checar('senha curta é recusada na tela', pagina.url() === `${BASE}/conta/senha`)
    await pagina.waitForTimeout(500)

    await pagina.fill('input[name=senhaAtual]', SENHA_HYGOR)
    await pagina.fill('input[name=senhaNova]', SENHA_NOVA_HYGOR)
    await pagina.fill('input[name=confirmacao]', 'outra-coisa-diferente')
    await pagina.click('button:has-text("Salvar senha nova")')
    await pagina.waitForSelector('text=As duas não são iguais')
    checar('confirmação divergente é recusada', pagina.url() === `${BASE}/conta/senha`)
    checar('e a sessão sobrevive ao erro de validação', (await prisma.sessao.count()) === 1)
    await pagina.waitForTimeout(500)

    await pagina.fill('input[name=senhaAtual]', SENHA_HYGOR)
    await pagina.fill('input[name=senhaNova]', SENHA_NOVA_HYGOR)
    await pagina.fill('input[name=confirmacao]', SENHA_NOVA_HYGOR)
    await pagina.click('button:has-text("Salvar senha nova")')
    await pagina.waitForURL(`${BASE}/`, { timeout: 15000 })
    checar('senha nova válida libera o sistema', pagina.url() === `${BASE}/`)
    checar(
      'e a sessão continua de pé, sem novo login',
      ((await pagina.textContent('header')) ?? '').includes('Hygor'),
    )

    const menu = (await pagina.textContent('nav')) ?? ''
    checar(
      'o menu de Operação não traz Financeiro nem Resultado',
      !menu.includes('Financeiro') && !menu.includes('Resultado'),
    )
    checar('nem a aba de Usuários', !menu.includes('Usuários'))
    checar(
      'e a tela da manhã não mostra dinheiro',
      !((await pagina.content()).includes('Saldo projetado')),
    )

    await pagina.goto(`${BASE}/financeiro`)
    checar('URL de área alheia digitada na mão é barrada', pagina.url().includes('/sem-acesso'))
    checar(
      'com a tela explicando o motivo',
      (await pagina.content()).includes('Essa parte não é do seu perfil'),
    )

    await pagina.goto(`${BASE}/entrar`)
    checar('quem já está logado não vê a tela de login', pagina.url() === `${BASE}/`)
  }

  // --- 5. Bloqueio por tentativa em massa ----------------------------------
  {
    const pagina = await (await navegador.newContext()).newPage()
    for (let i = 0; i < 5; i++) {
      await pagina.goto(`${BASE}/entrar`)
      await pagina.fill('input[name=email]', 'ana@lysor.com.br')
      await pagina.fill('input[name=senha]', `chute-${i}`)
      await pagina.click('button:has-text("Entrar")')
      await pagina.waitForSelector('text=E-mail ou senha incorretos')
    }
    await pagina.goto(`${BASE}/entrar`)
    await pagina.fill('input[name=email]', 'ana@lysor.com.br')
    await pagina.fill('input[name=senha]', SENHA_ANA)
    await pagina.click('button:has-text("Entrar")')
    await pagina.waitForSelector('text=Muitas tentativas')
    checar('depois de cinco erros nem a senha certa entra', pagina.url().includes('/entrar'))
    const aviso = (await pagina.textContent('text=Muitas tentativas')) ?? ''
    checar('e o aviso diz quanto tempo falta', /\d+ minuto/.test(aviso), aviso.trim())
  }

  await navegador.close()
  console.log(falhas === 0 ? '\nNavegador verificado.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
