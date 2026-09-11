# Deploy — Lysor Transportes

Sistema no ar em **https://app-production-2326.up.railway.app**, subido em
11/09/2026 a partir do commit `cdbca49` da `main`.

## Onde as coisas estão

Tudo num projeto só da Railway, `lysor-transportes`:

| Serviço | O que é |
|---|---|
| `Postgres` | `postgres:16` com volume de 5 GB em `/var/lib/postgresql/data` |
| `app` | o Next.js, ligado à `main` deste repositório |

O `app` fala com o Postgres pela **rede privada** (`postgres.railway.internal`),
não pelo endereço público. A senha do banco não atravessa a internet.

O Postgres também tem um proxy TCP público (`tramway.proxy.rlwy.net`), criado
para as migrations iniciais e mantido para acesso administrativo com `psql`. Ele
**não** é usado pela aplicação. Se ninguém for usá-lo, pode ser removido.

## Por que Railway e não Vercel

A escolha original era Vercel para o app e Railway para o banco. O que mudou:
as ferramentas disponíveis criam o projeto na Vercel e fazem deploy, mas **não
setam variável de ambiente** — e sem `DATABASE_URL` o app não sobe. Ficar na
Railway resolveu isso e, de quebra, colocou app e banco na mesma rede privada.

Migrar para a Vercel depois é colar as variáveis de ambiente lá. Nenhuma linha
de código depende da Railway.

## O volume não é detalhe

Sem volume, o `postgres:16` guarda os dados dentro do contêiner, e todo redeploy
começaria do zero — a cliente perderia tudo sem aviso. `PGDATA` aponta para
`/var/lib/postgresql/data/pgdata`, um subdiretório do ponto de montagem, porque
o Postgres recusa iniciar num diretório que já contém o `lost+found` do volume.

## Variáveis

| Variável | Para quê |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Postgres pela rede privada |
| `PORT=3000` | o domínio aponta para a 3000; sem isso o Next sobe na 8080 e o domínio devolve 404 |
| `NPM_CONFIG_PRODUCTION=false` | com `NODE_ENV=production`, o npm pula as devDependencies e o `next build` fica sem TypeScript |
| `NODE_ENV=production` | é o que faz o cookie de sessão sair com `Secure` |
| `HOSTNAME=0.0.0.0` | para o Next aceitar conexão de fora do contêiner |
| `ADMIN_NOME`, `ADMIN_EMAIL` | identidade do primeiro administrador |
| `ADMIN_SENHA` | **esvaziada depois do primeiro acesso** — ela só serve enquanto a tabela de usuários está vazia |

## O que foi conferido no ar, não deduzido

- migrations `init` e `autenticacao` aplicadas (log do deploy);
- administradora criada com senha provisória (log do deploy);
- `/`, `/financeiro`, `/relatorios`, `/usuarios` e `/viagens` deslogado → 307 para `/entrar`, guardando o destino;
- login com senha errada → "E-mail ou senha incorretos";
- login correto → 303 com `set-cookie: … Secure; HttpOnly; SameSite=lax`;
- com a sessão de pé e a senha ainda provisória, **todas** as rotas desviam para `/conta/senha`, e só ela responde 200.

O `Secure` no cookie era o risco real da mudança de ambiente: ele depende de
`NODE_ENV` chegar como `production` dentro do contêiner. Chegou.

## Primeiro acesso

A senha provisória foi entregue ao autor por fora deste repositório. No primeiro
login o sistema obriga a troca, e a troca **derruba todas as sessões** — inclusive
as de teste criadas durante a verificação do deploy.

## Como mexer daqui pra frente

Push na `main` dispara build e deploy. O start roda
`prisma migrate deploy && tsx scripts/preparar-producao.ts && next start`, então
migration nova entra sozinha no próximo deploy. `preparar-producao` é idempotente:
não recria usuário, não carrega frota de exemplo.
