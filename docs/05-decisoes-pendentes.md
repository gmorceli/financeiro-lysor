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
desenhado para isso, e é ele que dá ao dinheiro **um lugar único**. Sem isso o
sistema vira relatório paralelo e morre no terceiro mês.

Importação de XML/cartão e PWA do motorista ficam na Fatia 2 — dependem de
respostas do cliente (perguntas B9, F34, F35, H51) que ainda não temos.

### ✅ D4. Depreciação e financiamento — **fechada pelo levantamento**
**Decidido pela cliente (F43): visão de caixa.** *"só o dinheiro que sai do
caixa"* — sem depreciação no relatório de lucro. A parcela do financiamento
entra integralmente como custo do veículo.

Peso: 2 caminhões financiados, **R$ 42.000 por caminhão/mês, ~40 parcelas
restantes** = R$ 84 mil/mês de desembolso fixo (valor a confirmar, follow-up 3
do documento 08). É o maior custo fixo da empresa, e torna o resultado por
caminhão o número mais importante do sistema: *esses dois pagam a própria
parcela?*

A visão econômica com depreciação fica como opção futura, fora do MVP.

<details>
<summary>Recomendação anterior, antes da resposta da cliente</summary>

### D4. Depreciação e financiamento no cálculo de lucro
Pergunta 43 do questionário, mas precisamos de posição técnica antes.
**Recomendação: mostrar as duas visões** — "Resultado de caixa" (só desembolso,
inclui parcela do financiamento) e "Resultado econômico" (inclui depreciação,
exclui a parte de principal da parcela). É um toggle no relatório, não dois
sistemas — e evita a discussão contábil que trava a entrega.

</details>

### ✅ D2. Stack — **fechada**
**Decidido:** Next.js (App Router) + TypeScript · PostgreSQL + Prisma ·
shadcn/ui + Tailwind · Auth.js · storage S3-compatível para anexos ·
deploy Vercel (app) + Railway/Supabase (Postgres).

Detalhes e justificativa em `01-avaliacao-e-arquitetura.md` §7. O schema pode
ser gerado assim que as confirmações da cliente chegarem
(`09-confirmacoes-ana.md`).

---

## Decisões nossas — em aberto

### D5. Como construir confiança no número (revisto)
O cliente **não tem controle formalizado hoje**, então o piloto em paralelo que
eu recomendava não existe — não há com o que comparar.

**Recomendação: baseline retroativo.** Pedir 3 a 6 meses de extrato de cartão de
combustível, XMLs de CT-e e extrato de tag, e reconstruir o passado dele antes do
go-live. O sistema abre mostrando custo/km e km/l reais em vez de tela vazia.
Detalhes em `01-avaliacao-e-arquitetura.md` §9.3 e §9.4.

**Consequência de escopo a decidir:** se ele usar cartão de combustível (F34),
a importação do extrato sai da Fatia 2 e entra no MVP — é a única fonte de dado
confiável enquanto a rotina de coleta não existir. Custo estimado: poucos dias.
**Recomendo aceitar esse custo.**

### D6. A rotina de coleta entra no escopo? — ✏️ revista
O levantamento mostrou que **a rotina existe** — motoristas anotam km e litros,
a Ana e o Hygor lançam tudo em folhas. Ela é manual, não inexistente. Isso
enfraquece o argumento de vender "implantação de rotina" como escopo separado.

**Recomendação revista:** em vez de acompanhamento de rotina, incluir na proposta
**uma semana de acompanhamento assistido no arranque** — as primeiras viagens
fechadas junto com a Ana e o Hygor, para calibrar a velocidade de lançamento e
conferir a conta na mão nas três primeiras (ver D5). Escopo menor, valor maior, e
diretamente ligado ao objetivo declarado dela, que é ganhar tempo.

O que continua valendo: se a tela for mais lenta que a folha de papel, eles
voltam para a folha. A meta de **fechar viagem em menos de 60 segundos** é o
requisito que substitui o discurso de rotina.

---

## Decisões que dependiam do cliente — **respondidas em 09/09/2026**

Levantamento em `07-levantamento-lysor-2026-09-09.md`, análise em
`08-analise-do-levantamento.md`.

| # | Decisão | Resposta | Efeito |
|---|---|---|---|
| C1 | Viagem tem 1 ou N fretes | ✅ **Carga fechada** — 1 cliente por viagem | Rateio viagem→frete nasce pronto e desligado |
| C2 | Consumo de XML de CT-e | ✅ Emite pelo Simples CT-e; XML disponível sob geração manual | Importação viável, mas **não resolve a receita gerencial** (ver C11) |
| C3 | Regra do agregado | 🔄 **Invertida**: a Lysor **cobra** 10% do CT-e + 0,06% da NFe | Refez o modelo de receita. Maior mudança do projeto |
| C4 | Regra do motorista | ✅ 12% de comissão sobre o **frete real**; 2 com salário fixo adicional | Comissão é custo direto; salário é custo fixo |
| C5 | Cartão de combustível | ❌ **Não usa**, e a fatura do posto não é detalhada | Abastecimento 100% manual. Risco alto |
| C6 | Faturamento por CT-e ou agrupado | ✅ CT-e a CT-e, *"às vezes passa 15 dias e juntamos"* | `fatura` continua existindo, uso eventual |
| C7 | PWA do motorista no MVP | ✅ Ela quer *"tudo pelo celular"* (a precisar de confirmação) | Com C5 negativo, vira **essencial**, não opcional |
| C8 | Depreciação no lucro | ✅ Só caixa (ver D4) | Fecha a definição de lucro |
| C9 | Migração de histórico | ✅ Começar do zero em **01/09/2026** | Data de corte definida |
| C10 | Carreta separada do cavalo | ✅ Fixa por cavalo, *"às vezes troca"* | Entidade `conjunto` com vigência |

### Decisões abertas pelo levantamento — **todas respondidas em 10/09/2026**

| # | Decisão | Resposta | Efeito |
|---|---|---|---|
| C11 | Valor real × valor do CT-e | ✅ Quer registrar os dois; fluxo de confirmação por um clique aprovado | Dois campos no `frete`, implementados |
| C12 | O dinheiro do agregado passa pela Lysor? | 🔄 **Os dois casos acontecem** | Novo enum `FluxoFinanceiroAgregado` (`INTERMEDIADO` \| `DIRETO`) |
| C13 | Quantos veículos ao todo | ✅ **8**: 4 cavalos, 2 trucks, 2 carretas | `TipoVeiculo` ganha `TRUCK`; seed com os 8 |
| C14 | Morte/perda de animal | ✅ Muito raro, acerto direto com o cliente, sem regra fixa | **Não modelar.** Vira observação na viagem |
| C15 | GTA junto ao frete | ✅ Não precisa guardar a GTA; **a nota fiscal sim** | `numero_nfe` + anexo no frete |
| C16 | `vCarga` do XML | ⏳ A validar quando os XMLs chegarem | Campo `valor_carga_nfe` já existe |
| — | IPVA e licenciamento | ✅ Só 2 cavalos e 1 carreta pagam; resto isento | `isento_ipva`, `isento_licenciamento` |
| — | Parcela do financiamento | ✅ R$ 42.000/mês **por cavalo**, 2 contratos, sem carreta, ~40 parcelas | R$ 84 mil/mês de custo fixo confirmado |
| — | Preço por cabeça e por kg | ❌ **Descartado** pela cliente | Métricas removidas dos relatórios |
| — | Relatório detalhado do posto | ❌ Prefere manter a anotação do motorista | PWA do motorista vira **essencial** |
| — | "Tudo pelo celular" | ✅ As duas coisas: motorista lança pelo celular, escritório também acessa | Relatórios seguem no computador |

### ✅ D7. PWA do motorista entra no MVP
Consequência direta de C5 (sem cartão) + a escolha da cliente de não pedir
relatório ao posto: **o lançamento pelo celular do motorista é a única fonte do
maior custo variável da operação.** Sai da Fatia 2 e entra na Fatia 1.

Sem ele, o custo por km não existe — e sem custo por km, o relatório que a
cliente pediu não existe.

## Premissas — situação após o levantamento

| # | Premissa original | Situação |
|---|---|---|
| 1 | Carga majoritariamente fechada | ✅ **Confirmada** |
| 2 | Emite CT-e e consegue os XMLs | ✅ **Confirmada** (Simples CT-e) |
| 3 | Agregado remunerado por % do frete, combustível por conta dele | 🔄 **Metade errada**: combustível é dele, mas a Lysor **cobra**, não paga |
| 4 | Operação nacional, sem transporte internacional | ✅ Confirmada — regional em MT, até 400 km |
| 5 | Sem carga perigosa ou refrigerada | 🔄 **É carga viva (gado)**. GTA não precisa ser guardada; perda de animal é rara e sem regra fixa — não modelada |
| 6 | 300–500 lançamentos/mês | 🔄 **600–900/mês** (70 a 90 viagens). Sem impacto técnico, mas exige UX rápida |
| 7 | Sem integração com rastreador; odômetro manual | ✅ Confirmada — odômetro anotado à mão hoje |
| 8 | Sem emissão de boleto no MVP | ✅ Mantida |
| 9 | Single-tenant | ✅ Mantida (decisão D1) |
| 10 | Sem controle formalizado, risco alto de adoção | 🔄 **Revista**: existe controle, todo manuscrito. Risco rebaixado para médio — ver `01` §9.2 |
| 11 | Frota de 6 caminhões | 🔄 **8 veículos**: 4 cavalos, 2 trucks, 2 carretas |
