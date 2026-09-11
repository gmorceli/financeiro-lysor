/**
 * Prepara uma instalação de produção. Roda no build, a cada deploy.
 *
 * Faz três coisas, todas idempotentes por construção:
 *
 * 1. cria a linha da empresa, se não existir;
 * 2. garante as 22 categorias — sem elas o DRE não tem onde encaixar lançamento
 *    nenhum, e `idDaCategoria` estoura de propósito;
 * 3. cria o primeiro usuário administrador **se a tabela de usuários estiver
 *    vazia**.
 *
 * O item 3 existe porque a tela de usuários exige estar logado como
 * administrador, e num banco recém-criado não há ninguém. No desenvolvimento
 * quem quebra esse ovo é o `npm run usuario`, que precisa de um terminal com
 * acesso ao banco; no deploy não existe esse terminal.
 *
 * A trava é a contagem de usuários, não o e-mail: assim a variável de ambiente
 * pode ficar para trás sem virar um jeito de sobrescrever a conta de alguém.
 * Depois do primeiro acesso, remova ADMIN_SENHA do painel — ela não serve mais
 * para nada, e a pessoa já trocou a senha de qualquer forma.
 *
 * O que este script NÃO faz é carregar a frota de exemplo do `db:seed`. Veículo
 * não se apaga neste sistema — sai de operação mudando de status e continua na
 * lista para sempre. Oito caminhões com placa inventada no banco de produção
 * seriam oito linhas que a cliente teria que conviver.
 */
import { PrismaClient } from '@prisma/client'
import { CATEGORIAS, EMPRESA } from '../prisma/dados-base'
import { gerarHashSenha } from '../src/lib/senha'
import { criticarSenha } from '../src/lib/regras-senha'

const prisma = new PrismaClient()

async function main() {
  await prisma.empresa.upsert({
    where: { cnpj: EMPRESA.cnpj },
    update: {},
    create: EMPRESA,
  })

  for (const categoria of CATEGORIAS) {
    await prisma.categoria.upsert({
      where: { nome: categoria.nome },
      update: { tipo: categoria.tipo, nivelCusto: categoria.nivelCusto },
      create: { ...categoria, sistema: true },
    })
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const senha = process.env.ADMIN_SENHA
  const nome = process.env.ADMIN_NOME?.trim() || 'Administrador'

  const quantos = await prisma.usuario.count()
  if (quantos > 0) {
    if (email) await corrigirAdminAindaNaoUsado(email, nome)
    console.log(`Produção preparada: ${await prisma.categoria.count()} categorias, ${quantos} usuário(s) — nenhum criado.`)
    return
  }

  if (!email || !senha) {
    console.log(
      'Produção preparada, mas SEM nenhum usuário: defina ADMIN_EMAIL e ADMIN_SENHA ' +
        'e faça um novo deploy, senão não há como entrar no sistema.',
    )
    return
  }

  const critica = criticarSenha(senha)
  if (critica) {
    // Falhar o build é melhor do que subir com um administrador de senha fraca.
    throw new Error(`ADMIN_SENHA recusada: ${critica}`)
  }

  await prisma.usuario.create({
    data: {
      nome,
      email,
      perfil: 'ADMIN',
      senhaHash: await gerarHashSenha(senha),
      // Provisória: o sistema obriga a troca no primeiro acesso.
      trocarSenha: true,
    },
  })
  console.log(`Produção preparada. Administrador ${email} criado com senha provisória.`)
}

/**
 * Corrige a identidade do administrador de bootstrap enquanto ninguém entrou.
 *
 * Sem isto, errar o `ADMIN_EMAIL` na primeira subida é uma tranca sem saída:
 * o e-mail é como se entra, a tela de usuários exige estar logado, e no deploy
 * não há terminal com acesso ao banco. Quem digitou errado fica de fora do
 * próprio sistema, e a única saída é mexer no banco na mão.
 *
 * As três condições são estreitas de propósito — só vale enquanto a instalação
 * ainda está sendo montada:
 *
 * 1. existe um único usuário (ninguém montou equipe ainda);
 * 2. ele é o administrador;
 * 3. a senha dele **ainda é provisória**, ou seja, ninguém nunca completou um
 *    primeiro acesso.
 *
 * Depois que alguém entra e escolhe a senha, a condição 3 cai para sempre e
 * este caminho nunca mais roda — trocar e-mail passa a ser pela tela, como
 * deve. A senha não é tocada aqui: a provisória continua valendo.
 */
async function corrigirAdminAindaNaoUsado(email: string, nome: string) {
  const unico = await prisma.usuario.findFirst({
    select: { id: true, email: true, nome: true, perfil: true, trocarSenha: true },
  })
  if (!unico) return
  if ((await prisma.usuario.count()) !== 1) return
  if (unico.perfil !== 'ADMIN' || !unico.trocarSenha) return
  if (unico.email === email && unico.nome === nome) return

  await prisma.usuario.update({ where: { id: unico.id }, data: { email, nome } })
  // Sessão aberta com a identidade antiga não continua valendo.
  await prisma.sessao.deleteMany({ where: { usuarioId: unico.id } })
  console.log(
    `Administrador de bootstrap corrigido: ${unico.email} → ${email}. ` +
      'A senha provisória continua a mesma; as sessões abertas foram encerradas.',
  )
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
