# 01 — Avaliação de boas práticas e arquitetura

## 1. Diagnóstico do pedido

O cliente pediu "relatório de quanto cada caminhão e cada frete deu de lucro".
Parece simples. Não é — e é exatamente aqui que 90% dos controles de
transportadora pequena quebram. Três armadilhas clássicas:

**Armadilha 1 — "lucro do frete" não existe sem definir rateio.**
Um frete de R$ 8.000 com R$ 2.400 de diesel parece dar R$ 5.600. Mas o caminhão
tem parcela de financiamento, seguro, IPVA, pneu que vai furar em 40 mil km e uma
revisão de R$ 6.000 que vence daqui a dois meses. Se esses custos não entram na
conta, o dono acha que ganha dinheiro em frete que na verdade destrói caixa.
Se entram **do jeito errado** (rateio arbitrário), a informação é pior que
nenhuma — ele toma decisão de preço com número inventado.

**Armadilha 2 — a unidade de custo é a viagem, não o frete.**
Diesel, pedágio e diária do motorista são gastos **da viagem**. Se um caminhão
leva 3 CT-e numa mesma viagem, não existe "o diesel deste frete" — existe rateio.
Sistema que tenta amarrar despesa direto no frete obriga o operador a inventar
número, e ele vai inventar.

**Armadilha 3 — misturar competência com caixa.**
Frete entregue em março e recebido em maio dá lucro em **março** e caixa em
**maio**. Quem soma tudo numa coluna só nunca sabe se o problema é margem ou
prazo de recebimento. São dois relatórios diferentes, com a mesma base de dados.

> **Conclusão:** o coração do sistema não é o CRUD de caminhões. É o **motor de
> apropriação de custo**. Todo o resto é tela.

---

## 2. Decisão de arquitetura nº 1 — DRE gerencial em cascata

**Recomendação: não ratear tudo em cima do frete. Usar margem em camadas.**

```
                RECEITA DO FRETE                        (CT-e / OS)
              − Custos DIRETOS da viagem                 rastreável
                diesel · pedágio · comissão/diária ·
                pagamento do agregado · despesa de viagem
              ─────────────────────────────────────
              = MARGEM DE CONTRIBUIÇÃO DO FRETE         ← decide preço
                                                          e aceitar/recusar carga

              − Custos do VEÍCULO no período             rateado por km
                manutenção · pneus · seguro · IPVA ·
                rastreador · parcela/depreciação
              ─────────────────────────────────────
              = RESULTADO DO CAMINHÃO                   ← decide manter,
                                                          trocar ou vender

              − Custos FIXOS da empresa                  rateado por receita
                escritório · admin · contador · sistema
              ─────────────────────────────────────
              = LUCRO OPERACIONAL                        ← resultado real
```

Por que assim:

- **Cada camada responde uma pergunta de negócio diferente.** Margem de
  contribuição serve pra decidir preço no telefone com o embarcador. Resultado do
  caminhão serve pra decidir renovação de frota. Só a última linha é "o lucro".
- **Rateio arbitrário fica isolado na base da pirâmide.** As duas primeiras
  camadas são fato, não opinião. Se o cliente discordar do critério de rateio do
  overhead, ele muda um parâmetro sem contaminar a análise de frete.
- **Comparação frota própria × agregado fica honesta.** Agregado tem margem de
  contribuição menor e custo de veículo **zero**. Só nessa estrutura dá pra ver
  que às vezes o agregado é mais rentável que o caminhão próprio parado.

**Critérios de rateio propostos (configuráveis, com default):**

| Custo | Rateado para | Critério default | Alternativa |
|---|---|---|---|
| Custo da viagem → fretes | Frete (CT-e) | proporcional ao valor do frete | por peso / por volume |
| Custo do veículo → viagens | Viagem | km rodados no período | dias em operação |
| Overhead → tudo | Frete | % da receita | por km total da frota |

---

## 3. Decisão de arquitetura nº 2 — título financeiro único

**Recomendação: não existir "módulo de despesas" separado de "contas a pagar".**

Erro comum: o sistema tem uma tela pra lançar manutenção, outra pra lançar conta
a pagar — e o operador lança nas duas, ou em nenhuma. Resultado: relatório
gerencial e financeiro nunca batem.

Modelo correto: **tudo é um lançamento (título)** com quatro datas e um destino.

```
LANÇAMENTO
├── tipo ............ RECEITA | DESPESA
├── categoria ....... Combustível, Manutenção, Pedágio, Frete, ...
├── competência ..... quando o fato aconteceu   → alimenta o DRE / lucro
├── vencimento ...... quando vence              → alimenta o contas a pagar/receber
├── pagamento ....... quando foi pago/recebido  → alimenta o fluxo de caixa
├── apropriação ..... viagem? veículo? frete? empresa?
└── contraparte ..... cliente, fornecedor, motorista ou agregado
```

Um abastecimento lançado é, ao mesmo tempo: custo da viagem, custo/km do
caminhão e conta a pagar do cartão de combustível. **Um lançamento só.** Ninguém
digita nada duas vezes — e é matematicamente impossível os relatórios divergirem.

Contas a receber sai de graça: todo frete faturado gera um título de receita com
vencimento. Contas a pagar idem.

---

## 4. Decisão de arquitetura nº 3 — importar, não digitar

Empresa pequena não tem alguém dedicado a alimentar sistema. **O gargalo do
projeto não é a tela, é a entrada de dados.** Se depender de digitação manual, o
sistema morre em 60 dias — com o agravante de que dado pela metade é pior que
dado nenhum, porque o relatório fica errado sem avisar.

Onde atacar, por ordem de retorno:

| Fonte | O que elimina | Esforço |
|---|---|---|
| **XML do CT-e** (pasta ou e-mail do emissor) | Toda a digitação de receita: cliente, rota, valor, peso, data | Baixo — XML é padronizado |
| **Extrato do cartão de combustível** (CSV/API — Ticket Log, Repom, Shell, Abastece Aí) | Litros, valor, posto, data, às vezes odômetro | Baixo/médio |
| **Extrato da tag de pedágio** (Sem Parar / ConectCar / Veloe) | Pedágio por placa e data → casa com a viagem sozinho | Baixo |
| **Extrato bancário OFX** | Conciliação de baixa de títulos | Médio |
| **Foto do cupom/NF pelo celular** | Manutenção e despesa de estrada | Médio |

**Regra de projeto:** nenhum campo obrigatório que o operador não saiba responder
na hora. Odômetro é a única exceção — sem km confiável não existe custo por km,
e custo por km é o KPI que sustenta o sistema inteiro.

---

## 5. Boas práticas técnicas inegociáveis

**Dinheiro**
- Valores em `numeric/decimal` ou inteiro de centavos. **Nunca float.**
- Lançamento pago não se edita: corrige por estorno + novo lançamento. Preserva
  histórico e evita "o relatório de março mudou sozinho".
- Trilha de auditoria (quem lançou, quando, o que mudou) em tudo que é financeiro.

**Dados**
- **Single-tenant** (decidido): sistema sob medida para este cliente. Uma tabela
  `empresa` guarda razão social, CNPJ e os parâmetros de rateio — mas sem
  `empresa_id` espalhado nem isolamento por linha. Menos código, menos tela de
  configuração, implantação mais rápida.
  Consequência aceita: virar produto SaaS depois exige refatoração do modelo de
  dados e da camada de acesso. Ver `05-decisoes-pendentes.md` §D1.
- Soft delete. Transportadora estorna e recadastra o tempo todo.
- Datas de competência como `DATE`; timestamps em UTC; exibição em
  `America/Sao_Paulo`.
- Odômetro com validação de monotonicidade — km só cresce. É a fonte de erro
  número 1 em controle de frota.

**Anexos**
- Object storage desde o dia 1 (cupom fiscal, NF de manutenção, canhoto de
  entrega, comprovante de pagamento). É o que faz o dono confiar no número — ele
  clica e vê a nota.

**Segurança e LGPD**
- CPF, CNH e dados bancários de motorista/agregado são dado pessoal: acesso por
  perfil, sem exportação aberta, log de acesso.
- Perfis: Administrador (dono), Financeiro, Operação, Motorista (só o que é dele).

**Fiscal — o que NÃO fazer**
- **Não emitir CT-e/MDF-e no MVP.** Emissor fiscal envolve certificado digital,
  SEFAZ, contingência, homologação e responsabilidade legal. É um produto
  inteiro, não uma feature. O cliente já tem um emissor — **consumir o XML dele**
  entrega 100% do valor com 5% do risco.
- Este é um sistema **gerencial**, não contábil. Não substitui o contador, não
  gera SPED, não fecha balanço.

---

## 6. Boas práticas de usabilidade (empresa pequena)

O critério de sucesso é: **a filha do dono / a secretária consegue operar sem
treinamento.** Isso impõe restrições reais de design:

1. **Fluxo por evento, não por cadastro.** A tela principal não é "Lançamentos" —
   é **"Fechar viagem"**: km final, abastecimentos do período, pedágio, despesas,
   acerto do motorista/agregado, confirma. Um fluxo, uma tela, tudo gerado atrás.
2. **Categorias prontas de transporte.** Zero configuração de plano de contas na
   v1. Plano de contas configurável é a feature que trava a implantação por três
   meses e ninguém usa.
3. **Dashboard de 6 números, não 40.** Faturamento do mês, custo do mês, lucro,
   custo/km da frota, km/l médio, títulos vencendo. Mais que isso vira wallpaper.
4. **Mobile só onde precisa.** Motorista não vai usar sistema de escritório.
   PWA responsivo com 3 ações: abastecimento (foto + litros + km), despesa de
   estrada (foto + valor), fim de viagem. Nada mais.
5. **Nada bloqueante.** Frete pode ser lançado sem custo. Viagem pode fechar com
   pendência. O sistema mostra o que está incompleto em vez de impedir o
   trabalho — senão o operador volta pro WhatsApp.

---

## 7. Stack recomendada

Uma recomendação, defendida:

| Camada | Escolha | Por quê |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | Um repo só serve web e API; responsivo cobre o PWA do motorista sem app nativo |
| Banco | **PostgreSQL** | Transacional, `numeric` decente, views materializadas para os relatórios pesados |
| ORM | **Prisma** | Migrations versionadas e schema legível — importa porque o modelo vai mudar |
| UI | **shadcn/ui + Tailwind** | Tabelas e formulários prontos, visual sério sem designer |
| Auth | **Auth.js** com e-mail/senha + perfis | Suficiente; SSO não faz sentido aqui |
| Arquivos | **S3-compatível** (Supabase Storage / R2) | Anexos desde o dia 1 |
| Deploy | **Vercel** (app) + **Railway/Supabase** (Postgres) | Infra que a BDN já opera, custo baixo, backup gerenciado |
| Relatórios | SQL + views materializadas, export XLSX/PDF | O cliente **vai** querer no Excel. Aceite isso e entregue bem feito. |

Anti-recomendações conscientes: sem microserviços, sem fila, sem app nativo, sem
mobile offline-first no MVP. Seis caminhões geram na casa de 300 lançamentos/mês
— isso cabe folgado em um Postgres pequeno.

---

## 8. Riscos do projeto

| Risco | Impacto | Mitigação |
|---|---|---|
| Motorista não alimenta o sistema | Fatal — relatório fica errado sem avisar | Importar cartão de combustível e tag de pedágio; escritório fecha a viagem; painel de "viagens incompletas" |
| Odômetro errado ou não anotado | Custo/km inviável | Validação de km crescente; ler odômetro do cartão de combustível quando disponível |
| Cliente pedir emissão de CT-e no meio do projeto | Estoura prazo e orçamento | Fronteira escrita na proposta desde já (ver `02-escopo-mvp.md`) |
| Regra de pagamento do agregado mais complexa que o previsto | Retrabalho no motor de acerto | Levantar **antes de codar** (questionário, bloco D) |
| Migração das planilhas atuais | Atraso na virada | Definir corte: histórico entra como saldo, não como lançamento |
| Dono querer conferir com o contador e não bater | Perda de confiança | Deixar explícito: gerencial ≠ fiscal, e mostrar o anexo de cada número |
