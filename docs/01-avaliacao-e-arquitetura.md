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
| Auth | **Sessão própria** em tabela, e-mail/senha + perfis por área | Revisto na implementação: ver nota abaixo. SSO não faz sentido aqui |
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
| ~~Não existe rotina de coleta~~ → **rotina existe, mas em papel** | **Médio** (rebaixado pelo levantamento) — motoristas já anotam km e litros; o risco é a tela ser mais lenta que a folha | Meta de fechar viagem em <60s; lançamento pelo celular do motorista; painel de viagens incompletas |
| **Sem fonte automática de combustível** | **Alto** — sem cartão e sem fatura detalhada, o maior custo variável é 100% digitado | Celular do motorista com foto do cupom; investigar relatório detalhado junto ao posto |
| **Valor real do frete não fica registrado em lugar nenhum** | **Alto** — bloqueia lucro por frete e a comissão de 12% do motorista | Dois campos de valor no frete (fiscal e gerencial), ver `08-analise-do-levantamento.md` §2 |
| Sem baseline para conferir o primeiro relatório | O dono vê o número e não sabe se está certo | Reconstruir linha de base retroativa a partir de extratos que já existem (§9) |
| Dono querer conferir com o contador e não bater | Perda de confiança | Deixar explícito: gerencial ≠ fiscal, e mostrar o anexo de cada número |

---

## 9. Cliente sem controle formalizado — implicações

O cliente **não tem planilha nem sistema hoje**; está estruturando a operação
agora. Isso muda o projeto em quatro pontos.

### 9.1 O que melhora

- **Sem migração e sem legado.** Corte limpo por data. Nenhum saldo herdado de
  planilha inconsistente, nenhuma gambiarra do controle antigo para acomodar.
- **O sistema pode ditar o processo.** Não precisa espelhar um fluxo ruim que já
  existe — desenha-se o fluxo certo e o sistema o impõe.
- **Escopo menor.** Some a importação de histórico e some o piloto em paralelo.

### 9.2 O que piora — ✏️ **revisto pelo levantamento de 09/09/2026**

> **Correção:** este diagnóstico estava mais pessimista que a realidade. O
> levantamento mostrou que a Lysor **tem rotina de coleta** — ela é só toda em
> papel. Os motoristas já anotam km e litros a cada abastecimento; a Ana e o
> Hygor já lançam despesa por veículo e viagem por viagem em folhas
> manuscritas, gastando *"muitas horas"* por dia nisso.
>
> O problema não é criar hábito, é **redirecionar um hábito que já existe** do
> papel para a tela. Risco rebaixado de **Alto** para **Médio**, e a solução
> muda: menos evangelização, mais velocidade de lançamento. Detalhes em
> `08-analise-do-levantamento.md` §3.

O que continua valendo: **não há fonte automática de dado.** A Lysor não usa
cartão de combustível e a fatura do posto não vem detalhada, então o
abastecimento — maior custo variável — depende 100% de lançamento manual. Sem
uma tela de lançamento muito rápida, a rotina volta pro papel.

Isso reclassifica o projeto. Não é entrega de software, é **implantação de
gestão**. Se a rotina não for combinada e cobrada, o sistema fica vazio no
segundo mês e a conclusão do cliente será "o sistema não funcionou".

Consequências de projeto:

1. **A importação deixa de ser conveniência e vira a fonte primária confiável.**
   Dado que chega sozinho (extrato de cartão de combustível, extrato de tag,
   XML de CT-e) é o único que não depende de hábito que ainda não existe.
   → Se o cliente usar cartão de combustível (pergunta F34), **puxar a
   importação do extrato para dentro do MVP**, não deixar na Fatia 2.
2. **O painel de "viagens incompletas" vira feature de primeira ordem**, não
   detalhe: é o instrumento de cobrança da rotina.
3. **A implantação precisa de uma rotina semanal escrita e acordada** — quem
   fecha viagem, quando, e o que acontece quando não fecha. Isso entra na
   proposta como item de escopo, não como cortesia.

### 9.3 Onde está o histórico que ele acha que não tem

Ele não tem planilha, mas a operação roda há tempo — então as **fontes
primárias existem**, só nunca foram consolidadas:

| Fonte | O que dá | Cobertura típica |
|---|---|---|
| Extrato do cartão de combustível | Litros, valor, posto, data, às vezes odômetro | 6–12 meses |
| XMLs de CT-e emitidos | Receita por frete, cliente, rota, peso | Desde o início da emissão |
| Extrato da tag de pedágio | Pedágio por placa e data | 6–12 meses |
| Extrato bancário | Pagamentos de manutenção, seguro, parcelas | 12 meses |
| Notas fiscais de manutenção | Custo por veículo | O que estiver arquivado |

**Recomendação: pedir 3 a 6 meses dessas fontes e reconstruir uma linha de base
retroativa antes do go-live.** Retorno alto por três motivos:

- Dá **custo/km e km/l reais** desde o dia 1, sem esperar três meses de operação.
- Resolve o problema de confiança: o dono abre o sistema e já vê o passado dele
  ali, em vez de uma tela vazia pedindo que ele digite.
- Serve de **validação do motor de cálculo** — o papel que a planilha teria.

Custo: um script de importação que já estava previsto na Fatia 2, adiantado.

### 9.4 Onboarding de dia zero

Sem planilha, o arranque exige uma sessão de cadastro assistido. O que precisa
ser levantado na virada:

- Odômetro atual de cada caminhão (foto do painel, com data)
- Valor e data de aquisição de cada veículo (para depreciação)
- Parcelas de financiamento em aberto: valor e quantidade restante
- Contas a receber já emitidas e ainda não recebidas
- Contas a pagar já assumidas e ainda não pagas
- Saldo das contas bancárias na data de corte
- Adiantamentos a motoristas e agregados em aberto

**Recomendação: tratar isso como uma tela de "abertura" no sistema**, guiada,
não como planilha de importação. É a primeira coisa que o cliente vai usar — e a
primeira impressão dele sobre a facilidade do sistema.

---

## Nota de implementação — autenticação (11/09/2026)

A tabela acima previa Auth.js. A implementação não usou, e vale dizer por quê,
porque a decisão contraria o caminho mais batido.

O que este sistema precisa de autenticação é pouco e específico: e-mail e senha,
quatro perfis, revogação imediata. Não há login social, não há SSO, não há
múltiplos provedores — os três problemas que o Auth.js resolve bem. O que
sobraria do Auth.js aqui seria o *Credentials provider*, que por decisão do
próprio projeto **obriga sessão por JWT**, e JWT é justamente o que não serve:
token assinado auto-contido não se revoga, só vence. "Desativei a Ana agora" tem
que valer agora, não no fim da validade do token.

Sessão em tabela custa duas coisas — uma consulta por navegação, já deduplicada
por requisição com o `cache` do React, e o middleware não poder validar nada,
porque roda na borda onde o Prisma não roda. A segunda é a que exige atenção: o
middleware só pergunta se existe cookie, e a checagem real acontece no layout de
cada área e em toda action. Cookie forjado passa pelo middleware de propósito, e
morre uma camada adiante.

Em troca: nenhuma dependência nova, nenhum segredo em variável de ambiente,
revogação imediata na troca de senha e na desativação, e o `verificar:auth`
exercitando bloqueio, expiração e permissão contra o Postgres de verdade.
