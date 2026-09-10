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

**Cadastros, operação, custos e financeiro funcionando.** Schema com 21 tabelas,
migration aplicada, as cinco telas de cadastro, o fluxo operacional (abrir
viagem, lançar frete, fechar viagem), o lançamento de custos e o financeiro
completo — contas a pagar e a receber, baixa de títulos, fluxo de caixa e a tela
da manhã.

```bash
npm install
cp .env.example .env      # preencher DATABASE_URL
npm run db:migrate        # cria as tabelas
npm run db:seed           # categorias + frota + motoristas
npm run dev               # http://localhost:3000
```

Verificações:

```bash
npm run typecheck         # tipos
npm run verificar         # regras de validação dos cadastros
npm run verificar:fluxo   # fluxo operacional contra o banco
npm run verificar:custos  # custos, títulos e margem contra o banco
npm run verificar:financeiro  # títulos, baixas e o gatilho ao-receber
npm run build             # build de produção
```

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

## Stack

Next.js (App Router) + TypeScript · PostgreSQL + Prisma · shadcn/ui + Tailwind ·
Auth.js · storage S3-compatível · deploy Vercel com Postgres em Railway/Supabase.

## Próximo passo

Acerto de motorista e agregado, e o relatório de resultado por caminhão e por
frete — a pergunta que originou o projeto. O DRE em cascata já tem todas as
peças no banco: falta a tela que as apresenta.

Faltando: **autenticação** (antes de qualquer deploy) e os **XMLs de CT-e** da
cliente, para validar se `infCarga/vCarga` traz o valor da nota — o que
eliminaria a digitação manual no acerto do agregado.
