# 05 — Decisões pendentes

Duas listas: o que já foi **decidido do nosso lado** e o que ainda depende do
**cliente** (questionário).

---

## Decisões nossas — fechadas

### ✅ D1. Projeto sob medida, single-tenant
**Decidido: sistema sob medida para este cliente, single-tenant.**
Sem `empresa_id` espalhado, sem isolamento por linha, sem configuração por
tenant. Menos código e implantação mais rápida.

Consequência aceita e registrada: se depois a BDN quiser transformar isso em
produto para outras transportadoras, é refatoração do modelo de dados e da
camada de acesso — não é chavinha. A hora de reavaliar é **antes** do segundo
cliente, não durante.

### ✅ D3. Tamanho do MVP: Completo
**Decidido: cadastros + viagem + custos + rateio + relatórios + contas a
pagar/receber + fluxo de caixa + acerto de motorista e agregado.**
É a Fatia 1 inteira de `02-escopo-mvp.md`.

Razão: o AP/AR sai quase de graça porque o modelo de lançamento único já foi
desenhado para isso, e é ele que faz o financeiro **largar a planilha**. Sem
isso o sistema vira relatório paralelo e morre no terceiro mês.

Importação de XML/cartão e PWA do motorista ficam na Fatia 2 — dependem de
respostas do cliente (perguntas B9, F34, F35, H51) que ainda não temos.

---

## Decisões nossas — em aberto

### D2. Stack
Recomendação em `01-avaliacao-e-arquitetura.md` §7: Next.js + TypeScript +
PostgreSQL + Prisma + shadcn/ui, deploy Vercel + Railway/Supabase.
Confirmar antes de gerar o schema.

### D4. Depreciação e financiamento no cálculo de lucro
Pergunta 43 do questionário, mas precisamos de posição técnica antes.
**Recomendação: mostrar as duas visões** — "Resultado de caixa" (só desembolso,
inclui parcela do financiamento) e "Resultado econômico" (inclui depreciação,
exclui a parte de principal da parcela). É um toggle no relatório, não dois
sistemas — e evita a discussão contábil que trava a entrega.

### D5. Piloto em paralelo
**Recomendação: um mês rodando junto com a planilha atual.** Aumenta o prazo até
o "aceite", mas é o que constrói confiança no número. Fechar isso na proposta
para não virar reclamação de atraso.

---

## Decisões que dependem do cliente

| # | Decisão | Pergunta | Impacto se vier errado |
|---|---|---|---|
| C1 | Viagem tem 1 ou N fretes | A1 | Refaz modelo de dados e motor de rateio |
| C2 | Consumo de XML de CT-e | B8, B9 | Adiciona/remove tela de digitação de frete |
| C3 | Regra de remuneração do agregado | D20–D23 | Refaz motor de acerto e relatórios de agregado |
| C4 | Regra de remuneração do motorista | E30 | Muda classificação de custo direto × fixo |
| C5 | Integração com cartão de combustível | F34, F35 | Define a fatia 2 e o maior ganho de usabilidade |
| C6 | Faturamento por CT-e ou agrupado | C16 | Define existência da entidade `fatura` |
| C7 | PWA do motorista no MVP | H50, H51 | ±2 semanas de escopo |
| C8 | Depreciação no lucro | F43 | Muda a definição de "lucro" no relatório principal |
| C9 | Migração de histórico | H56 | Define esforço de importação inicial |
| C10 | Carreta separada do cavalo | A7 | Adiciona entidade `implemento` e rateio de custo entre conjunto |

---

## Premissas assumidas até a resposta chegar

Trabalhando com estas premissas para não parar. Todas revisáveis:

1. Carga majoritariamente **fechada** (1 viagem ≈ 1 frete), mas o modelo já
   suporta N fretes por viagem — o rateio nasce pronto e desligado.
2. O cliente **emite CT-e** por algum emissor e consegue os XMLs.
3. Agregado remunerado por **percentual do frete**, com combustível por conta dele.
4. Operação em **território nacional**, sem transporte internacional.
5. Sem carga perigosa ou refrigerada com exigência regulatória adicional.
6. Volume na casa de **300–500 lançamentos/mês** — não exige otimização especial.
7. **Sem integração com rastreador** no MVP; odômetro entra manualmente.
8. Sem emissão de boleto no MVP — cobrança segue pelo processo atual do cliente.
9. **Single-tenant** — um cliente, uma instalação (decisão D1).
