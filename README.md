# Lysor — Sistema de Gestão de Frotas e Resultado de Fretes

Sistema de gestão financeira e operacional para transportadora de pequeno porte
com **frota própria (6 caminhões) + agregados**.

## Pergunta central que o sistema responde

> Quanto cada caminhão e cada frete **faturou**, quanto **custou** e quanto
> **sobrou de lucro de verdade** — no mês, no ano, por cliente e por rota.

## Estado atual

**Fase de descoberta.** Nenhum código escrito ainda. Este repositório contém a
avaliação técnica, a arquitetura proposta e o questionário de levantamento.

Decisões já fechadas: sistema **single-tenant** (sob medida para este cliente) e
MVP no escopo **Completo** — operação, custos, rateio, relatórios de resultado,
contas a pagar/receber, fluxo de caixa e acerto de motorista/agregado.

**Cliente:** Lysor Transportes LTDA — transporte de **gado vivo** em Mato
Grosso, viagens regionais de até 400 km, 70 a 90 viagens/mês. Controle atual:
folhas manuscritas. Data de corte: 01/09/2026.

⚠️ **A descoberta que mudou o projeto:** na Lysor o agregado **paga** a
transportadora (10% do CT-e + 0,06% de seguro sobre a carga), em vez de receber
dela. Receita de margem quase pura, sem custo variável. Isso inverteu o modelo de
receita e é a maior mudança do planejamento — ver
[`docs/08-analise-do-levantamento.md`](docs/08-analise-do-levantamento.md).

| Documento | O que é |
|---|---|
| [`docs/01-avaliacao-e-arquitetura.md`](docs/01-avaliacao-e-arquitetura.md) | Avaliação de boas práticas, decisões de arquitetura e o modelo de custo em cascata |
| [`docs/02-escopo-mvp.md`](docs/02-escopo-mvp.md) | Escopo do MVP, o que fica de fora e o roadmap |
| [`docs/03-modelo-de-dados.md`](docs/03-modelo-de-dados.md) | Entidades, relacionamentos e regras de rateio |
| [`docs/04-questionario-cliente.md`](docs/04-questionario-cliente.md) | Questionário pronto para enviar ao cliente |
| [`docs/05-decisoes-pendentes.md`](docs/05-decisoes-pendentes.md) | Decisões que dependem de resposta antes de codar |
| [`docs/06-entrevista-guiada.md`](docs/06-entrevista-guiada.md) | Roteiro de entrevista guiada (já aplicado) |
| [`docs/07-levantamento-lysor-2026-09-09.md`](docs/07-levantamento-lysor-2026-09-09.md) | **Respostas do cliente.** Entrevista com Ana Veronica, 09/09/2026 |
| [`docs/08-analise-do-levantamento.md`](docs/08-analise-do-levantamento.md) | **Leia este.** O que o levantamento derrubou, as mudanças no modelo e o follow-up |
| [`docs/09-confirmacoes-ana.md`](docs/09-confirmacoes-ana.md) | Confirmações enviadas à cliente |
| [`docs/10-respostas-confirmacoes-2026-09-10.md`](docs/10-respostas-confirmacoes-2026-09-10.md) | **Respostas da cliente** — tudo confirmado |

## Estado do código

**MVP completo, com autenticação.** Schema com 22 tabelas, migration aplicada,
e as seis fatias da aplicação: cadastros, operação (viagem e frete), custos,
financeiro (contas a pagar e receber, baixa, fluxo de caixa, tela da manhã),
o relatório de resultado por caminhão e por frete, e o acesso — login, perfis,
sessão e cadastro de usuários.

```bash
npm install
cp .env.example .env      # preencher DATABASE_URL
npm run db:migrate        # cria as tabelas
npm run db:seed           # categorias + frota + motoristas
npm run usuario -- --nome "Ana Paula" --email ana@lysor.com.br --perfil ADMIN
npm run dev               # http://localhost:3000
```

O `npm run usuario` existe para o primeiro acesso e só para ele: a tela de
usuários exige estar logado como administrador, e no banco novo não há ninguém
— alguém tem que quebrar esse ovo de fora. A senha é pedida no prompt, sem eco,
e nasce provisória: o sistema obriga a trocar no primeiro login. Daí em diante
o caminho é a tela.

### Deploy

O **start** de produção roda as migrations e prepara a instalação antes de subir:

```
prisma migrate deploy && tsx scripts/preparar-producao.ts && next start
```

No start, e não no build, porque a rede privada do Railway só existe em runtime
— migration no build não alcançaria o banco, e mandá-la pelo endereço público
faria a senha do banco atravessar a internet em texto claro. Por isso `prisma` e
`tsx` são dependências de produção, não de desenvolvimento: o start usa os dois.

É o único momento do deploy com acesso ao banco — o `npm run usuario` precisa de
um terminal, e no deploy não existe um. `preparar-producao` cria a empresa,
garante as 22 categorias (sem elas o DRE não tem onde encaixar lançamento
nenhum) e, **se a tabela de usuários estiver vazia**, cria o primeiro
administrador a partir de `ADMIN_EMAIL`, `ADMIN_NOME` e `ADMIN_SENHA`. A trava é
a contagem de usuários, não o e-mail: a variável pode ficar para trás sem virar
um jeito de sobrescrever a conta de alguém. Senha fraca derruba o build em vez
de subir um administrador frágil.

Ele **não** carrega a frota de exemplo do `db:seed`. Veículo não se apaga neste
sistema — sai de operação mudando de status e continua na lista para sempre.
Oito caminhões com placa inventada seriam oito linhas para a cliente conviver.

Enquanto o administrador criado assim **ainda não tiver feito o primeiro
acesso**, mudar `ADMIN_EMAIL` ou `ADMIN_NOME` e reimplantar corrige a identidade
dele. Sem isso, um e-mail digitado errado na primeira subida é uma tranca sem
saída: o e-mail é como se entra, a tela de usuários exige estar logado, e no
deploy não há terminal com acesso ao banco. Assim que alguém entra e escolhe a
senha, essa porta fecha para sempre e trocar e-mail passa a ser pela tela.

Variáveis necessárias: `DATABASE_URL` e `DIRECT_URL`. Depois do primeiro acesso,
remova `ADMIN_SENHA` do painel: ela não serve mais para nada.

Verificações — **233 asserções contra um Postgres de verdade**:

```bash
npm run typecheck         # tipos
npm run verificar         # regras de validação dos cadastros
npm run verificar:fluxo   # fluxo operacional contra o banco
npm run verificar:custos  # custos, títulos e margem contra o banco
npm run verificar:financeiro  # títulos, baixas e o gatilho ao-receber
npm run verificar:resultado   # cascata do DRE e rateio por frete
npm run verificar:acertos     # acerto de motorista e de agregado
npm run verificar:importacao  # leitura do MDF-e e importação de frete
npm run verificar:auth    # senha, sessão, bloqueio, permissão e guarda das actions
npm run build             # build de produção
```

E mais duas verificações que exigem o servidor no ar e o Chromium instalado
(por isso o Playwright não está em `package.json` — ele baixaria um navegador de
~150 MB em toda instalação, inclusive na do deploy):

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm start
npm run verificar:navegador   # 29 asserções no formulário de verdade
npm run verificar:mobile      # as 31 telas medidas em 375px
```

`verificar:mobile` é o que impede a promessa fácil de "é responsivo". Ele mede,
em cada tela, se a página rola de lado, se algum campo tem fonte abaixo de 16px
(aí o Safari do iOS dá zoom ao focar e a pessoa perde o formulário de vista), se
algum alvo de toque está abaixo de 40px e se algo estoura a largura. Na primeira
execução, 27 de 27 telas falharam.

### O fluxo de operação

1. **Abrir viagem** — escolher o caminhão preenche sozinho o motorista de
   sempre e a quilometragem de saída. Sobram origem e destino.
2. **Lançar frete** — o valor real vem preenchido igual ao do CT-e. Quando são
   iguais, ninguém digita nada; quando não, a tela mostra a diferença e avisa
   que a comissão segue o valor real.
3. **Fechar viagem** — a quilometragem de chegada revela o km rodado, e o km
   vazio sai do que não foi carregado. O odômetro do veículo avança na mesma
   transação.

Frete de agregado não passa por viagem: o caminhão é dele. A tela calcula a
comissão e o seguro conforme os valores são digitados, mas quem grava é o
servidor a partir da regra cadastrada — a tela é conferência, não entrada.

### Custos

Abastecimento e despesa de viagem são lançados **de dentro da viagem**, para o
custo nascer apropriado ao frete certo. Manutenção tem tela própria: é custo do
veículo, não da viagem.

**Todo custo lançado vira um título financeiro na mesma transação.** Não existe
"registrar a despesa" e depois "lançar a conta a pagar" — é um registro só, com
competência, vencimento e pagamento separados. É o que impede o relatório
gerencial e o financeiro de divergirem.

A tela de abastecimento mostra o preço do litro e o consumo desde o último
tanque cheio enquanto o operador digita, o que dá chance de perceber o erro de
digitação na hora: 1,8 km/l salta aos olhos de quem conhece a frota.

### Financeiro

Nada é digitado duas vezes: **os títulos nascem sozinhos**. Cada frete lançado
gera o recebível; cada custo gera o pagável. A tela financeira é de conferência
e baixa, não de digitação.

O frete de agregado gera títulos diferentes conforme o fluxo do dinheiro:

| Fluxo | Títulos gerados |
|---|---|
| Frota própria | recebível do cliente, pelo valor real do frete |
| Agregado intermediado | recebível do cliente (valor cheio) mais repasse ao agregado com gatilho AO_RECEBER |
| Agregado direto | recebível do agregado, só comissão e seguro |

O **gatilho AO_RECEBER** é a tradução do "acerta quando o cliente paga": o
repasse ao agregado nasce sem vencimento e só ganha data quando o recebível do
cliente é quitado. No fluxo de caixa ele fica numa faixa própria — projetá-lo
numa data inventada daria uma falsa sensação de compromisso marcado.

A tela da manhã é o que a cliente pediu: a receber, a pagar, saldo projetado,
o que vence em sete dias e as viagens em aberto — com aviso quando há título
vencido ou viagem fechada sem frete lançado.

### Resultado

A pergunta que originou o projeto, respondida em cascata:

```
Receita de frete
− custos diretos (diesel, pedágio, comissão)
= MARGEM DE CONTRIBUIÇÃO ....... decide preço e aceitar ou recusar carga
− custos dos caminhões (manutenção, seguro, parcela)
= RESULTADO DA FROTA ........... decide manter, trocar ou vender caminhão
+ resultado dos agregados
− custos fixos da empresa
= LUCRO OPERACIONAL ............ o resultado de verdade
```

As duas primeiras camadas são fato: cada lançamento sabe a que viagem e a que
veículo pertence. **Só a última usa rateio**, e por isso fica isolada no fim —
se o critério mudar, as camadas de cima não se mexem.

Frota própria e agregados aparecem **em blocos separados**, nunca somados numa
margem média. O agregado não tem diesel, manutenção nem parcela: comparar os
dois percentuais lado a lado leva a conclusão errada, porque são negócios com
estruturas de capital opostas.

No resultado **por frete**, diesel e pedágio são rateados na proporção da
receita — o frete que responde por dois terços da viagem carrega dois terços do
custo dela. A verificação garante que a soma dos rateios reconstrói o custo
original e que a soma dos resultados por frete reconstrói o resultado da frota:
o rateio não perde nem inventa dinheiro.

### Decisões de interface que vieram do levantamento

- **Veículo é identificado pelo apelido**, não pela placa — nas folhas da
  cliente não aparece uma única placa. A placa fica no cadastro, para o CT-e.
- **`<select>` nativo** em vez de combobox com portal: metade da operação
  acontece no celular, e o nativo é melhor lá.
- **Cada campo com regra tem uma linha explicando o porquê** — o operador não
  deve precisar adivinhar o que preencher.
- **O formulário do agregado mostra a conta pronta** com um exemplo, para
  conferir o percentual e o seguro na hora de cadastrar.
- **Nada é apagado**: veículo sai de operação mudando de status, porque carrega
  histórico de viagem e de custo.

### Importação de MDF-e

O manifesto que a transportadora já emite traz, num arquivo só, o que hoje se
digita: a chave do CT-e, o valor do frete, **o valor da carga** — base do seguro
de 0,06% do agregado —, a placa, o motorista com CPF, a origem e o destino. Nos
28 manifestos de setembro, cada um trouxe exatamente um CT-e, o que faz dele um
registro por frete.

O campo que decide tudo é `veicTracao/prop`: quando existe, o caminhão é de
terceiro e o frete é de agregado; quando não existe, é da frota. É a mesma
escolha que o operador faz na tela, declarada na nota fiscal.

**A importação não cria cadastro.** Ela cria viagem, frete e título, e só.
Criar cliente com prazo de pagamento zero faria o caixa projetar dinheiro à
vista; criar motorista com comissão zero faria o acerto pagar a menos. O arquivo
fiscal tem o nome e o documento, mas não tem a regra de negócio — e é a regra que
faz o número certo. Quando falta cadastro, a linha não entra e a tela diz o quê.

Duas armadilhas de leitura, ambas verificadas: a chave do CT-e tem 44 dígitos e
vira `5.12e+43` se o parser converter número sozinho, e CPF com zero à esquerda
perde o zero. Por isso o XML é lido inteiramente como texto, e os valores viram
número um a um.

A chave do CT-e é única no banco: reimportar a mesma pasta não duplica nada.

### Acerto de motorista e de agregado

Os dois fecham de formas **opostas**, e a diferença é o miolo da fatia:

- **Motorista** — a comissão nunca existiu como título. Ela é calculada frete a
  frete e já entra no resultado no dia do frete, mas ninguém deve nada a ninguém
  até o acerto. Fechar é o que cria a conta a pagar.
- **Agregado** — os títulos já nasceram junto com o CT-e. Fechar não cria nada:
  agrupa, mostra a conta e dá baixa. Criar título aqui duplicaria o dinheiro,
  que é o erro clássico deste tipo de tela.

Daí o nível de custo `LIQUIDACAO`, que só o acerto de motorista usa: o título
dele entra no contas a pagar e no fluxo de caixa, e **não** entra no resultado,
porque a comissão já foi apropriada por competência. Sem isso, fechar um acerto
faria o lucro do mês cair por um custo que já estava lá — e o erro só apareceria
no fechamento, quando ninguém mais lembra do que mudou.

A asserção que guarda essa fronteira está em `verificar:acertos`: **fechar um
acerto não muda o lucro operacional do período.** A gêmea, do outro lado:
**fechar um acerto de agregado não cria título nenhum.**

Na tela do agregado a escolha é por CT-e, um a um — que é como a cliente acerta,
conforme o cliente paga. Vêm marcados os que já foram pagos; os outros aparecem
desmarcados e sinalizados, porque esconder faria ela abrir o extrato do banco
para descobrir por que o CT-e sumiu.

### Acesso

Quatro perfis, e a permissão é por **área**, não por tela — tela muda toda
semana, área é a divisão real do trabalho:

| Perfil | Alcança |
|---|---|
| Administrador | tudo, mais o cadastro de usuários |
| Financeiro | operação, cadastros, financeiro e resultado |
| Operação | viagem, frete, custo e cadastros — não vê dinheiro |
| Motorista | nada: reservado ao aplicativo do motorista, que não existe ainda |

A tabela em `src/lib/permissoes.ts` é a única fonte: o menu, os layouts e as
actions leem dela, então não existe o caso de a tela esconder um botão que a
action ainda aceita. Quem é de Operação não vê as abas de Financeiro e
Resultado, a tela da manhã nem consulta valores a receber, e a URL digitada na
mão cai numa tela que diz o que faltou.

Três decisões que valem registro:

1. **Sessão no banco, não JWT.** Revogação tem que ser imediata: trocar a senha
   ou desativar alguém derruba as sessões no mesmo instante. Com token assinado
   auto-contido, só o vencimento derruba. O cookie carrega um token aleatório;
   o banco guarda só o SHA-256 dele.
2. **O middleware não valida nada.** Ele roda na borda, onde o Prisma não roda,
   então só pergunta se existe cookie — cookie forjado passa por ele e morre no
   layout da área. A checagem de verdade está em `exigirUsuario` e
   `exigirAcesso`, e toda Server Action chama uma das duas: action é endpoint
   HTTP público, não basta esconder o botão.
3. **scrypt do `node:crypto`**, N=2^16, com os parâmetros dentro do próprio
   hash. Sem dependência nativa para compilar no deploy, e quando o custo subir
   as senhas antigas continuam conferindo com os números com que foram criadas.

`npm run verificar:auth` varre `src/app` e falha se alguma action ficou sem
guarda ou se alguma área ficou sem layout protegido — é o que impede o buraco
que não aparece em lugar nenhum da interface.

## Stack

Next.js (App Router) + TypeScript · PostgreSQL + Prisma · Tailwind · sessão
própria em tabela · storage S3-compatível · deploy Vercel com Postgres em
Railway/Supabase.

## Próximo passo

**Acerto de motorista e agregado** — transforma a comissão calculada em título
a pagar. Depois, exportação para Excel dos relatórios e a importação de XML de
CT-e e do extrato de pedágio, que corta boa parte da digitação.

Faltando da cliente: os **XMLs de CT-e**, para validar se `infCarga/vCarga` traz
o valor da nota — o que eliminaria a digitação manual no acerto do agregado.
