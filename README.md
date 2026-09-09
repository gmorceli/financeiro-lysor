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

| Documento | O que é |
|---|---|
| [`docs/01-avaliacao-e-arquitetura.md`](docs/01-avaliacao-e-arquitetura.md) | Avaliação de boas práticas, decisões de arquitetura e o modelo de custo em cascata |
| [`docs/02-escopo-mvp.md`](docs/02-escopo-mvp.md) | Escopo do MVP, o que fica de fora e o roadmap |
| [`docs/03-modelo-de-dados.md`](docs/03-modelo-de-dados.md) | Entidades, relacionamentos e regras de rateio |
| [`docs/04-questionario-cliente.md`](docs/04-questionario-cliente.md) | Questionário pronto para enviar ao cliente |
| [`docs/05-decisoes-pendentes.md`](docs/05-decisoes-pendentes.md) | Decisões que dependem de resposta antes de codar |
| [`docs/06-entrevista-guiada.md`](docs/06-entrevista-guiada.md) | **Enviar ao cliente.** Roteiro para o Claude dele conduzir a entrevista, uma pergunta por vez, e exportar as respostas em arquivo |

## Próximo passo

Enviar `docs/06-entrevista-guiada.md` ao cliente — ele anexa no Claude dele, é
entrevistado uma pergunta por vez e devolve um `LEVANTAMENTO-<EMPRESA>-<data>.md`
com as respostas estruturadas.

(`docs/04-questionario-cliente.md` é a mesma coleta em formato de questionário
escrito — alternativa para quando a entrevista guiada não for viável.)

Sem essas respostas, o modelo de rateio não fecha.
