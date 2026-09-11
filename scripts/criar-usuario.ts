/**
 * Cria ou atualiza um usuário pelo terminal.
 *
 * Existe por um motivo só: o primeiro acesso. A tela de usuários exige estar
 * logado como administrador, e no banco recém-criado não há ninguém — alguém
 * tem que quebrar esse ovo de fora. Depois disso, o caminho normal é a própria
 * tela.
 *
 *   npm run usuario -- --nome "Ana" --email ana@lysor.com.br --perfil ADMIN
 *
 * A senha é pedida no prompt, sem eco. Passar senha por argumento deixaria ela
 * no histórico do shell e na lista de processos, então `--senha` não existe; em
 * automação, use a variável SENHA.
 */
import { createInterface } from 'node:readline'
import { PrismaClient, type PerfilUsuario } from '@prisma/client'
import { gerarHashSenha } from '../src/lib/senha'
import { criticarSenha } from '../src/lib/regras-senha'

const prisma = new PrismaClient()

const PERFIS: PerfilUsuario[] = ['ADMIN', 'FINANCEIRO', 'OPERACAO', 'MOTORISTA']

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

/** Lê do terminal com o eco desligado, para a senha não ficar na tela. */
async function pedirSenha(rotulo: string): Promise<string> {
  if (process.env.SENHA) return process.env.SENHA

  const leitor = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const saida = process.stdout as unknown as { write: (dado: string) => boolean }
  const escreverOriginal = saida.write.bind(saida)

  process.stdout.write(rotulo)
  saida.write = (dado: string) => (dado.includes('\n') ? escreverOriginal('\n') : true)

  try {
    return await new Promise<string>((resolver) => leitor.question('', resolver))
  } finally {
    saida.write = escreverOriginal
    leitor.close()
  }
}

async function principal() {
  const nome = argumento('nome')
  const email = argumento('email')?.trim().toLowerCase()
  const perfilBruto = (argumento('perfil') ?? 'ADMIN').toUpperCase() as PerfilUsuario

  if (!nome || !email) {
    console.error('Uso: npm run usuario -- --nome "Ana Paula" --email ana@lysor.com.br [--perfil ADMIN]')
    process.exitCode = 1
    return
  }
  if (!PERFIS.includes(perfilBruto)) {
    console.error(`Perfil inválido. Use um destes: ${PERFIS.join(', ')}`)
    process.exitCode = 1
    return
  }

  const senha = await pedirSenha(`Senha para ${email}: `)
  const critica = criticarSenha(senha)
  if (critica) {
    console.error(critica)
    process.exitCode = 1
    return
  }

  const existente = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
  const dados = {
    nome,
    email,
    perfil: perfilBruto,
    senhaHash: await gerarHashSenha(senha),
    senhaDefinidaEm: new Date(),
    ativo: true,
    tentativasFalhas: 0,
    bloqueadoAte: null,
    // Senha digitada por quem instala não é a senha da pessoa: ela troca no
    // primeiro acesso. A exceção é quando quem roda o script é o próprio dono
    // da conta, daí --sem-troca.
    trocarSenha: !process.argv.includes('--sem-troca'),
  }

  if (existente) {
    await prisma.usuario.update({ where: { id: existente.id }, data: dados })
    await prisma.sessao.deleteMany({ where: { usuarioId: existente.id } })
    console.log(`Usuário ${email} atualizado (${perfilBruto}). Sessões anteriores encerradas.`)
  } else {
    await prisma.usuario.create({ data: dados })
    console.log(`Usuário ${email} criado (${perfilBruto}).`)
  }

  if (dados.trocarSenha) {
    console.log('A senha é provisória: o sistema vai pedir uma nova no primeiro acesso.')
  }
}

principal()
  .catch((erro) => {
    console.error(erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
