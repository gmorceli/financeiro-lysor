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

  const quantos = await prisma.usuario.count()
  if (quantos > 0) {
    console.log(`Produção preparada: ${await prisma.categoria.count()} categorias, ${quantos} usuário(s) — nenhum criado.`)
    return
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const senha = process.env.ADMIN_SENHA
  const nome = process.env.ADMIN_NOME?.trim() || 'Administrador'

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

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
