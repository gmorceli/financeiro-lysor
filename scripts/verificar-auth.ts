/**
 * Verifica a autenticação contra o banco.
 *
 * Autenticação é a única parte deste sistema em que um erro não aparece na tela:
 * ninguém percebe que a trava não travou. Então aqui não se testa se a tela
 * mostra o botão certo — se testa se o bloqueio bloqueia, se a sessão vencida
 * morre, se a senha trocada derruba as sessões antigas e, a mais importante das
 * verificações, se toda Server Action do sistema tem guarda.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, type PerfilUsuario } from '@prisma/client'
import {
  alterarSenha,
  autenticar,
  definirSenhaProvisoria,
  MAXIMO_DE_TENTATIVAS,
  RECUSA_GENERICA,
} from '../src/lib/autenticacao'
import { conferirSenha, gerarHashSenha, HASH_FALSO } from '../src/lib/senha'
import { criticarSenha } from '../src/lib/regras-senha'
import {
  criarSessaoNoBanco,
  digerirToken,
  encerrarSessaoDoToken,
  gerarToken,
  limparSessoesVencidas,
  usuarioDoToken,
} from '../src/lib/sessao-nucleo'
import { AREAS, navegacaoDoPerfil, podeAcessar, temAlgumAcesso } from '../src/lib/permissoes'
import { impedimentoDeAdmin } from '../src/lib/usuarios'

const prisma = new PrismaClient()
let falhas = 0
function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const DOMINIO = '@teste-auth.lysor'
const SENHA = 'beira-de-estrada-88'
const OUTRA = 'carreta-viloças-2026'

async function criarUsuario(sufixo: string, perfil: PerfilUsuario, ativo = true) {
  const email = `${sufixo}${DOMINIO}`
  return prisma.usuario.create({
    data: {
      nome: `Teste ${sufixo}`,
      email,
      perfil,
      ativo,
      senhaHash: await gerarHashSenha(SENHA),
      trocarSenha: false,
    },
  })
}

async function main() {
  await prisma.auditoria.deleteMany({
    where: { entidadeId: { in: (await prisma.usuario.findMany({ where: { email: { endsWith: DOMINIO } }, select: { id: true } })).map((u) => u.id) } },
  })
  await prisma.usuario.deleteMany({ where: { email: { endsWith: DOMINIO } } })

  // --- 1. Hash de senha ----------------------------------------------------
  const hash = await gerarHashSenha(SENHA)
  checar('senha correta confere', await conferirSenha(SENHA, hash))
  checar('senha errada não confere', !(await conferirSenha(`${SENHA}x`, hash)))
  checar(
    'mesma senha gera hashes diferentes',
    hash !== (await gerarHashSenha(SENHA)),
    'sal aleatório por senha',
  )
  checar('hash guarda os parâmetros para migração futura', hash.startsWith('scrypt$65536$8$1$'))
  checar('hash malformado devolve false em vez de estourar', !(await conferirSenha(SENHA, 'lixo')))
  checar('hash vazio devolve false', !(await conferirSenha(SENHA, '')))
  checar('hash descartável não confere com senha nenhuma', !(await conferirSenha(SENHA, HASH_FALSO)))
  checar('senha curta é recusada', criticarSenha('curta') !== null)
  checar('senha só de números é recusada', criticarSenha('1234567890123') !== null)
  checar('senha boa passa', criticarSenha(SENHA) === null)

  // --- 2. Login ------------------------------------------------------------
  const ana = await criarUsuario('ana', 'FINANCEIRO')

  const inexistente = await autenticar(`ninguem${DOMINIO}`, SENHA)
  checar(
    'e-mail que não existe recusa com a frase genérica',
    !inexistente.ok && inexistente.erro === RECUSA_GENERICA,
    'não entrega quem tem conta',
  )

  const senhaErrada = await autenticar(ana.email, 'senha-errada-mesmo')
  checar('senha errada recusa com a mesma frase', !senhaErrada.ok && senhaErrada.erro === RECUSA_GENERICA)
  checar(
    'tentativa errada é contada',
    (await prisma.usuario.findUniqueOrThrow({ where: { id: ana.id } })).tentativasFalhas === 1,
  )

  const certo = await autenticar(ana.email, SENHA)
  checar('senha correta entra', certo.ok && certo.usuarioId === ana.id)
  const depoisDoAcerto = await prisma.usuario.findUniqueOrThrow({ where: { id: ana.id } })
  checar('acerto zera o contador de tentativas', depoisDoAcerto.tentativasFalhas === 0)
  checar('acerto grava o último acesso', depoisDoAcerto.ultimoAcessoEm !== null)

  // --- 3. Bloqueio por tentativa em massa ----------------------------------
  for (let i = 0; i < MAXIMO_DE_TENTATIVAS; i++) await autenticar(ana.email, 'chute')
  const bloqueada = await prisma.usuario.findUniqueOrThrow({ where: { id: ana.id } })
  checar(
    `${MAXIMO_DE_TENTATIVAS} erros bloqueiam a conta`,
    bloqueada.bloqueadoAte !== null && bloqueada.bloqueadoAte > new Date(),
  )

  const durante = await autenticar(ana.email, SENHA)
  checar(
    'durante o bloqueio a senha certa também é recusada',
    !durante.ok && durante.erro !== RECUSA_GENERICA,
    'e a mensagem diz que é o relógio, não a senha',
  )

  await prisma.usuario.update({
    where: { id: ana.id },
    data: { bloqueadoAte: new Date(Date.now() - 1000) },
  })
  checar('bloqueio vencido libera de novo', (await autenticar(ana.email, SENHA)).ok)

  // --- 4. Conta desativada e perfil sem área -------------------------------
  const desligado = await criarUsuario('desligado', 'OPERACAO', false)
  const tentativaInativo = await autenticar(desligado.email, SENHA)
  checar(
    'usuário desativado não entra, com a frase genérica',
    !tentativaInativo.ok && tentativaInativo.erro === RECUSA_GENERICA,
    'não revela que a conta existe mas foi desligada',
  )

  const motorista = await criarUsuario('motorista', 'MOTORISTA')
  const tentativaMotorista = await autenticar(motorista.email, SENHA)
  checar(
    'perfil sem nenhuma área é recusado na porta',
    !tentativaMotorista.ok && tentativaMotorista.erro.includes('motorista'),
    'em vez de entrar e encontrar tudo bloqueado',
  )

  // --- 5. Sessão -----------------------------------------------------------
  const token = gerarToken()
  await criarSessaoNoBanco(ana.id, token, { ip: '10.0.0.1', navegador: 'teste' })

  const guardada = await prisma.sessao.findFirstOrThrow({ where: { usuarioId: ana.id } })
  checar('o banco guarda o digest, não o token', guardada.tokenHash !== token)
  checar('e o digest é o do token entregue', guardada.tokenHash === digerirToken(token))
  checar(
    'token não aparece em lugar nenhum da linha',
    !JSON.stringify(guardada).includes(token),
    'dump do banco não vira sessão',
  )

  const daSessao = await usuarioDoToken(token)
  checar('token válido resolve para o usuário', daSessao?.id === ana.id)
  checar('token desconhecido não resolve', (await usuarioDoToken(gerarToken())) === null)

  await prisma.sessao.update({
    where: { id: guardada.id },
    data: { expiraEm: new Date(Date.now() - 1000) },
  })
  checar('sessão vencida não resolve', (await usuarioDoToken(token)) === null)
  await limparSessoesVencidas()
  checar(
    'faxina apaga a sessão vencida',
    (await prisma.sessao.count({ where: { id: guardada.id } })) === 0,
  )

  const tokenVivo = gerarToken()
  await criarSessaoNoBanco(ana.id, tokenVivo)
  await prisma.usuario.update({ where: { id: ana.id }, data: { ativo: false } })
  checar(
    'desativar o usuário derruba a sessão em aberto na hora',
    (await usuarioDoToken(tokenVivo)) === null,
    'sem precisar apagar sessão',
  )
  await prisma.usuario.update({ where: { id: ana.id }, data: { ativo: true } })
  checar('reativar devolve o acesso da mesma sessão', (await usuarioDoToken(tokenVivo))?.id === ana.id)

  await encerrarSessaoDoToken(tokenVivo)
  checar('sair encerra a sessão', (await usuarioDoToken(tokenVivo)) === null)

  // --- 6. Troca de senha ---------------------------------------------------
  const tokenA = gerarToken()
  const tokenB = gerarToken()
  await criarSessaoNoBanco(ana.id, tokenA)
  await criarSessaoNoBanco(ana.id, tokenB)

  const comSenhaErrada = await alterarSenha(ana.id, 'não é a atual', OUTRA)
  checar('troca de senha exige a senha atual', !comSenhaErrada.ok)
  checar(
    'e a senha antiga continua valendo depois da tentativa frustrada',
    (await autenticar(ana.email, SENHA)).ok,
  )

  const senhaFraca = await alterarSenha(ana.id, SENHA, 'curta')
  checar('troca recusa senha fraca', !senhaFraca.ok)

  const trocou = await alterarSenha(ana.id, SENHA, OUTRA)
  checar('troca com senha atual correta funciona', trocou.ok)
  checar('a senha antiga deixa de valer', !(await autenticar(ana.email, SENHA)).ok)
  checar('a senha nova vale', (await autenticar(ana.email, OUTRA)).ok)
  checar(
    'trocar a senha derruba todas as sessões abertas',
    (await usuarioDoToken(tokenA)) === null && (await usuarioDoToken(tokenB)) === null,
    'senha nova com sessão antiga de pé é senha não trocada',
  )

  // --- 7. Senha provisória -------------------------------------------------
  const provisoria = 'provisoria-2026-ab'
  const tokenAntesDoReset = gerarToken()
  await criarSessaoNoBanco(ana.id, tokenAntesDoReset)
  const definiu = await definirSenhaProvisoria(ana.id, provisoria)
  checar('administrador redefine senha', definiu.ok)
  checar(
    'reset derruba as sessões do usuário',
    (await usuarioDoToken(tokenAntesDoReset)) === null,
  )
  const comProvisoria = await prisma.usuario.findUniqueOrThrow({ where: { id: ana.id } })
  checar('senha redefinida nasce provisória', comProvisoria.trocarSenha === true)
  checar('e ela funciona para entrar', (await autenticar(ana.email, provisoria)).ok)

  const tokenProvisorio = gerarToken()
  await criarSessaoNoBanco(ana.id, tokenProvisorio)
  checar(
    'a sessão carrega a marca de senha provisória',
    (await usuarioDoToken(tokenProvisorio))?.trocarSenha === true,
    'é o que desvia toda navegação para a troca',
  )
  await alterarSenha(ana.id, provisoria, OUTRA)
  checar(
    'trocar a provisória apaga a marca',
    (await prisma.usuario.findUniqueOrThrow({ where: { id: ana.id } })).trocarSenha === false,
  )

  // --- 8. Permissões -------------------------------------------------------
  const ESPERADO: Record<PerfilUsuario, string[]> = {
    ADMIN: ['operacao', 'cadastros', 'financeiro', 'resultado', 'usuarios'],
    FINANCEIRO: ['operacao', 'cadastros', 'financeiro', 'resultado'],
    OPERACAO: ['operacao', 'cadastros'],
    MOTORISTA: [],
  }
  for (const [perfil, areas] of Object.entries(ESPERADO) as [PerfilUsuario, string[]][]) {
    const obtidas = (Object.keys(AREAS) as (keyof typeof AREAS)[]).filter((a) =>
      podeAcessar(perfil, a),
    )
    checar(
      `perfil ${perfil} alcança exatamente ${areas.length} área(s)`,
      obtidas.length === areas.length && areas.every((a) => obtidas.includes(a as never)),
      obtidas.join(', ') || 'nenhuma',
    )
  }
  checar('MOTORISTA é o único perfil sem acesso a nada', !temAlgumAcesso('MOTORISTA'))
  checar(
    'o menu de Operação não oferece financeiro nem resultado',
    !navegacaoDoPerfil('OPERACAO').some((i) => i.area === 'financeiro' || i.area === 'resultado'),
  )
  checar(
    'só ADMIN vê a aba de usuários',
    navegacaoDoPerfil('ADMIN').some((i) => i.area === 'usuarios') &&
      !navegacaoDoPerfil('FINANCEIRO').some((i) => i.area === 'usuarios'),
  )

  // --- 9. Não dá para trancar a empresa fora do sistema --------------------
  const chefe = await criarUsuario('chefe', 'ADMIN')
  const operador = await criarUsuario('operador', 'OPERACAO')

  // A regra conta administradores ativos em todo o banco, que é o certo para o
  // sistema e ruim para o teste: qualquer admin real deixaria "é o último"
  // sempre falso. Os de fora saem de cena durante este bloco e voltam depois.
  const deFora = await prisma.usuario.findMany({
    where: { perfil: 'ADMIN', ativo: true, email: { not: { endsWith: DOMINIO } } },
    select: { id: true },
  })
  await prisma.usuario.updateMany({
    where: { id: { in: deFora.map((u) => u.id) } },
    data: { ativo: false },
  })

  checar(
    'administrador não rebaixa a si mesmo',
    (await impedimentoDeAdmin(chefe.id, chefe.id, 'OPERACAO', true))?.includes('seu próprio') === true,
  )
  checar(
    'nem se desativa',
    (await impedimentoDeAdmin(chefe.id, chefe.id, 'ADMIN', false))?.includes('seu próprio') === true,
  )
  checar(
    'o último administrador ativo não pode ser rebaixado por outro',
    (await impedimentoDeAdmin(chefe.id, operador.id, 'FINANCEIRO', true))?.includes('último administrador') === true,
  )

  const segundoAdmin = await criarUsuario('segundo-admin', 'ADMIN')
  checar(
    'com dois administradores, rebaixar um é permitido',
    (await impedimentoDeAdmin(chefe.id, segundoAdmin.id, 'FINANCEIRO', true)) === null,
  )
  checar(
    'administrador já desativado não conta como o último',
    await (async () => {
      await prisma.usuario.update({ where: { id: segundoAdmin.id }, data: { ativo: false } })
      const impedido = await impedimentoDeAdmin(chefe.id, operador.id, 'FINANCEIRO', true)
      await prisma.usuario.update({ where: { id: segundoAdmin.id }, data: { ativo: true } })
      return impedido?.includes('último administrador') === true
    })(),
    'volta a ser o último de novo',
  )
  checar(
    'mudar quem não é administrador nunca é impedido',
    (await impedimentoDeAdmin(operador.id, chefe.id, 'MOTORISTA', false)) === null,
  )

  await prisma.usuario.updateMany({
    where: { id: { in: deFora.map((u) => u.id) } },
    data: { ativo: true },
  })
  checar(
    `os ${deFora.length} administrador(es) de fora do teste voltaram ao ar`,
    (await prisma.usuario.count({ where: { perfil: 'ADMIN', ativo: true, email: { not: { endsWith: DOMINIO } } } })) ===
      deFora.length,
  )

  // --- 10. Auditoria -------------------------------------------------------
  const trilha = await prisma.auditoria.findMany({ where: { entidadeId: ana.id } })
  checar('login bem-sucedido é registrado', trilha.some((a) => a.acao === 'LOGIN'))
  checar('tentativa recusada é registrada', trilha.some((a) => a.acao === 'LOGIN_RECUSADO'))
  checar('troca de senha é registrada', trilha.some((a) => a.acao === 'SENHA_ALTERADA'))
  checar('reset por administrador é registrado', trilha.some((a) => a.acao === 'SENHA_REDEFINIDA'))

  // --- 11. Toda action tem guarda -----------------------------------------
  // Esta é a verificação que mais importa no arquivo. Server Action é endpoint
  // HTTP público: quem souber o identificador chama sem passar pela tela. Se
  // alguém acrescentar uma action e esquecer o `exigirAcesso`, o buraco não
  // aparece em nenhum lugar da interface — aparece aqui.
  const PUBLICAS = new Set(['entrar'])
  const PROPRIA_CONTA = new Set(['sair', 'trocarSenha'])
  const arquivos: string[] = []
  ;(function varrer(dir: string) {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) varrer(caminho)
      else if (nome === 'actions.ts') arquivos.push(caminho)
    }
  })('src/app')

  let actions = 0
  let desprotegidas: string[] = []
  for (const caminho of arquivos) {
    const texto = readFileSync(caminho, 'utf8')
    const blocos = texto.split(/^export async function /m).slice(1)
    for (const bloco of blocos) {
      const nome = bloco.slice(0, bloco.indexOf('(')).trim()
      actions++
      if (PUBLICAS.has(nome)) continue
      const corpo = bloco.slice(0, bloco.indexOf('\n}\n') + 1 || undefined)
      const temGuarda = PROPRIA_CONTA.has(nome)
        ? /exigirUsuario\(|usuarioDaSessao\(/.test(corpo)
        : /exigirAcesso\(/.test(corpo)
      if (!temGuarda) desprotegidas.push(`${caminho}:${nome}`)
    }
  }
  checar(`${arquivos.length} arquivos de action varridos, ${actions} actions encontradas`, actions > 0)
  checar(
    'toda action exige sessão antes de escrever',
    desprotegidas.length === 0,
    desprotegidas.length ? `sem guarda: ${desprotegidas.join(', ')}` : 'nenhuma exceção',
  )

  // Guarda de área em toda pasta de primeiro nível que não seja pública.
  const SEM_LAYOUT = new Set(['entrar', 'conta', 'sem-acesso'])
  const pastas = readdirSync('src/app').filter(
    (n) => statSync(join('src/app', n)).isDirectory() && !n.startsWith('_') && !n.startsWith('('),
  )
  const semGuarda = pastas.filter((n) => {
    if (SEM_LAYOUT.has(n)) return false
    try {
      return !readFileSync(join('src/app', n, 'layout.tsx'), 'utf8').includes('exigirAcesso(')
    } catch {
      return true
    }
  })
  checar(
    'toda área tem layout com guarda de permissão',
    semGuarda.length === 0,
    semGuarda.length ? `sem layout: ${semGuarda.join(', ')}` : pastas.join(', '),
  )

  // --- 12. Nada de servidor no bundle do navegador -----------------------
  // O build já recusa isso, mas só quando o import chega até um componente de
  // cliente por um caminho direto. Vale checar aqui também: um `'use client'`
  // que importe de `senha.ts` ou de `sessao.ts` estaria mandando criptografia e
  // acesso ao banco para dentro do navegador.
  const SO_NO_SERVIDOR = ['@/lib/senha', '@/lib/sessao', '@/lib/sessao-nucleo', '@/lib/autenticacao', '@/lib/prisma', '@/lib/auditoria']
  const componentes: string[] = []
  ;(function varrerTsx(dir: string) {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) varrerTsx(caminho)
      else if (nome.endsWith('.tsx') || nome.endsWith('.ts')) componentes.push(caminho)
    }
  })('src')

  const vazando: string[] = []
  for (const caminho of componentes) {
    const texto = readFileSync(caminho, 'utf8')
    if (!/^['"]use client['"]/m.test(texto)) continue
    for (const modulo of SO_NO_SERVIDOR) {
      if (new RegExp(`from '${modulo}'`).test(texto)) vazando.push(`${caminho} → ${modulo}`)
    }
  }
  checar(
    'nenhum componente de cliente importa módulo de servidor',
    vazando.length === 0,
    vazando.length ? vazando.join(', ') : `${componentes.filter((c) => /^['"]use client['"]/m.test(readFileSync(c, 'utf8'))).length} componentes de cliente varridos`,
  )

  await prisma.auditoria.deleteMany({
    where: {
      entidadeId: {
        in: (
          await prisma.usuario.findMany({
            where: { email: { endsWith: DOMINIO } },
            select: { id: true },
          })
        ).map((u) => u.id),
      },
    },
  })
  await prisma.usuario.deleteMany({ where: { email: { endsWith: DOMINIO } } })

  console.log(falhas === 0 ? '\nAutenticação verificada.' : `\n${falhas} falha(s).`)
  await prisma.$disconnect()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
