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

**Cadastros funcionando.** Schema com 21 tabelas, migration aplicada e as cinco
telas de cadastro — veículos, motoristas, clientes, agregados e fornecedores —
com listagem, criação e edição.

```bash
npm install
cp .env.example .env      # preencher DATABASE_URL
npm run db:migrate        # cria as tabelas
npm run db:seed           # categorias + frota + motoristas
npm run dev               # http://localhost:3000
```

Verificações:

```bash
npm run typecheck    # tipos
npm run verificar    # regras de negócio dos cadastros
npm run build        # build de produção
```

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

Viagem e frete — a tela do dia a dia, com a meta de fechar uma viagem em menos
de 60 segundos. Depois custos e o relatório de resultado.

Faltando: **autenticação** (antes de qualquer deploy) e os **XMLs de CT-e** da
cliente, para validar se `infCarga/vCarga` traz o valor da nota — o que
eliminaria a digitação manual no acerto do agregado.
