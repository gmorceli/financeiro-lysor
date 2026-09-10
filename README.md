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

Descoberta encerrada. **Schema de dados implementado** em
[`prisma/schema.prisma`](prisma/schema.prisma) — 21 tabelas, validado, com DDL
gerando limpo, mais o seed das categorias de transporte e dos cadastros já
conhecidos.

```bash
npm install
cp .env.example .env      # preencher DATABASE_URL
npm run db:migrate        # cria as tabelas
npm run db:seed           # categorias + frota + motoristas
```

## Stack

Next.js (App Router) + TypeScript · PostgreSQL + Prisma · shadcn/ui + Tailwind ·
Auth.js · storage S3-compatível · deploy Vercel com Postgres em Railway/Supabase.

## Próximo passo

Telas de cadastro (veículos, motoristas, clientes, agregados), depois viagem e
frete. Pendente da cliente: os XMLs de CT-e, para validar se `infCarga/vCarga`
traz o valor da nota — o que eliminaria a digitação manual no acerto do agregado.
