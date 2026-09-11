# 08 — Análise do levantamento (Lysor Transportes, 09/09/2026)

Fonte: `07-levantamento-lysor-2026-09-09.md` — entrevista com Ana Veronica
(sócia/gestora), mais 7 páginas de folhas manuscritas de ago–set/2026 e a
planilha de acerto do agregado Dorival Osti.

O levantamento **derrubou cinco premissas** do planejamento anterior, sendo uma
delas estrutural. Este documento registra o que muda e por quê.

---

## 1. A inversão: agregado não é custo, é receita

**Era a premissa mais errada de todo o planejamento.**

Todo o desenho anterior tratava o agregado como no mercado geral: a
transportadora contrata o caminhão de terceiro e **paga** a ele um percentual do
frete. Na Lysor é o contrário — o agregado usa a estrutura da Lysor e **paga**
por isso:

| | Modelo assumido antes | Realidade da Lysor |
|---|---|---|
| Direção do dinheiro | Lysor **paga** o agregado | Lysor **cobra** do agregado |
| Base | % do frete | 10% do CT-e + 0,06% do valor da NFe (seguro) |
| Diesel e pedágio | discussão em aberto | 100% do agregado |
| Custo da Lysor | alto (o repasse) | praticamente zero |

Conferido contra o acerto real (Dorival Osti, 27/08/2026, placa NBO8C70):

```
7 CT-e de agosto/2026 ......................... R$  11.642,00
comissão 10% .................................. R$   1.164,20
valor das NFe (carga) ......................... R$ 528.550,00
seguro 0,06% .................................. R$     317,13
                                                ─────────────
receita da Lysor nesse acerto ................. R$   1.481,33   (12,72% do bruto)
```

Os números fecham exatamente com a planilha dela.

### Consequências no modelo de dados

O `frete` passa a ter **modalidade**, e a receita reconhecida muda conforme ela:

- `FROTA_PROPRIA` → receita = valor do frete; custos diretos = diesel, pedágio,
  comissão do motorista
- `AGREGADO` → receita = comissão (10%) + seguro (0,06% × valor da carga);
  custo direto ≈ zero

O **motor de rateio do veículo não se aplica** a frete de agregado — não há
caminhão da Lysor rodando. A comparação frota própria × agregado deixa de ser
"quem tem margem maior" e passa a ser **duas linhas de negócio diferentes**.

### O insight de negócio que o relatório vai entregar

Na pergunta G47 ela disse: *"o agregado não é pra dar lucro, é para não perder o
cliente."*

Os números dizem outra coisa. **12,72% de margem sem custo variável nenhum** —
sem diesel, sem pedágio, sem manutenção, sem motorista, sem parcela de
financiamento. É a operação mais rentável por real investido que a Lysor tem
hoje, e ela não sabe.

Isso não muda o sistema, mas muda o que o relatório precisa mostrar com clareza:
**receita e margem por linha de negócio (própria × agregado)**, lado a lado. É
provavelmente a informação com maior potencial de mudar decisão estratégica dela
— crescer via agregado custa muito menos capital que comprar o sétimo caminhão.

---

## 2. O valor do CT-e não é o valor do frete

Segundo achado mais grave, e ataca direto a estratégia de importação.

> *"às vezes fazemos cte pelo mínimo"* · *"nem sempre fazemos complemento"* ·
> onde fica o valor real? **"na cabeça do Hygor"**

Nas folhas manuscritas o padrão aparece:

```
Viagem Faz. Vitória — 398 km — Frete R$ 5.970,00 — complemento R$ 3.594,00
Viagem Faz. Camila  — 503 km — 4.630,00 / 7.545,00 — complemento 2.915,00
```

**Impacto:** a comissão de 12% do motorista incide sobre o **frete real**, não
sobre o CT-e (ela foi explícita: *"sobre o frete efetivamente pago, pois às
vezes fazemos cte pelo mínimo"*). O lucro por frete também. Ou seja: importar o
XML **não resolve a receita sozinho** — traz o valor fiscal, não o gerencial.

### Solução de desenho

O frete carrega **dois valores**, sempre:

| Campo | Origem | Usado para |
|---|---|---|
| `valor_cte` | XML, automático | conferência fiscal, faturamento, base da comissão do agregado (10%) |
| `valor_frete_real` | confirmado na tela | lucro por frete, comissão do motorista (12%) |

Na tela: o XML entra e o sistema pergunta *"o valor real é o mesmo?"* — se sim,
um clique; se não, digita. Sem esse par, nem o lucro nem a comissão fecham.

> **Nota, uma vez e sem rodeio:** CT-e emitido abaixo do valor praticado, sem
> complemento, tem implicação fiscal que é assunto da Ana com o contador dela —
> não é nosso papel resolver nem julgar. Do lado do sistema, o requisito é
> técnico e neutro: os dois valores precisam existir para os cálculos fecharem.
> O sistema também torna visível quando um complemento **deixou** de ser
> emitido, o que joga a favor dela.

---

## 3. Sem cartão de combustível — mas com rotina de anotação

A premissa de "importar em vez de digitar" perde sua maior alavanca:

- **Não usam cartão de combustível.** Abastecem em posto com cadastro, que emite
  fatura — sem detalhamento por abastecimento e sem arquivo aproveitável.
- **Mas os motoristas já anotam km e litros à mão.** A rotina existe. É papel,
  não é ausência de hábito.

Isso **corrige o diagnóstico anterior**: o problema da Lysor não é falta de
rotina de coleta — é que a coleta morre no papel. Bem menos grave, e muda a
solução: em vez de *criar* hábito, é *redirecionar* um que já existe do papel
para o celular. A Ana já pediu isso (H51: *"tudo pelo celular"*).

**Três caminhos, em ordem de retorno:**

1. **Lançamento pelo motorista via celular** com foto do cupom — km, litros,
   valor. É o que ela quer e o que substitui o papel diretamente. **Recomendado.**
2. **Pedir ao posto o relatório detalhado por abastecimento.** Posto que fatura
   normalmente consegue emitir por veículo e data. Custo zero, retorno alto —
   vale uma ligação antes de assumir que não existe.
3. **Avaliar cartão de combustível** (Ticket Log, Repom) numa fase futura. Não é
   decisão de projeto, é decisão dela — mas resolveria a digitação de vez.

---

## 4. O XML resolve o trabalho manual do acerto do agregado

Achado 6 do levantamento: o valor da NFe da carga — base do seguro de 0,06% — é
digitado à mão porque *"o relatório de CT-e não traz esse dado"*.

O relatório `.xlsx` do Simples CT-e não traz, mas **o XML do CT-e traz**: o campo
`infCarga/vCarga` carrega o valor total da carga. Se confirmar nos XMLs reais
dela, a importação elimina a digitação mais chata do acerto de agregado — que
hoje é feita CT-e a CT-e, à mão.

→ **Validar no primeiro XML que ela enviar.** Está na lista de follow-up.

---

## 5. Correções de escopo e prioridade

### 5.1 O dashboard é financeiro, não gerencial

Perguntada sobre a tela da manhã (G44), ela respondeu: **contas a pagar, contas
a receber e saldo de caixa.** Não pediu lucro por caminhão.

O planejamento anterior propunha um dashboard de indicadores gerenciais
(custo/km, km/l, margem). Está errado para esta cliente. O correto:

- **Dashboard** = financeiro puro: a pagar, a receber, saldo, vencimentos da
  semana. É o que ela abre todo dia.
- **Lucro por caminhão, por frete, por cliente, por rota** = relatórios, que ela
  abre no fechamento do mês. Ela pediu todos (G48: *"tudo"*).

### 5.2 O critério de sucesso é velocidade de lançamento

G45: *"o descontrole, pois qd fecha o mês perde muito tempo"* · G46: *"ganho
tempo para resolver outras coisas"* · B12: **"muitas horas" por dia**, feito por
ela e pelo Hygor.

O objetivo declarado não é decidir melhor — é **parar de perder o dia**. Isso
reordena tudo: um sistema bonito com lançamento lento falha nesta cliente, mesmo
que os relatórios sejam perfeitos. Volume real: **70 a 90 viagens/mês**, ou 3 a 4
por dia útil.

**Meta de projeto:** fechar uma viagem completa em menos de 60 segundos.

### 5.3 Veículos são identificados por apelido

Nas folhas não aparece uma única placa. Aparecem: *Scania 440, Scania Amarela
JS4, FH Cinza, FH Vermelha, Carreta Viloças, Carreta 2 eixos*.

**Requisito de interface:** `apelido` é campo obrigatório e é o que aparece em
toda a tela. A placa fica no cadastro, para o CT-e e o documento. Tela que mostra
placa é tela que ela não reconhece.

### 5.4 Cavalo e carreta são veículos separados

As folhas listam 4 cavalos e 2 carretas, com despesas próprias — inclusive ANTT
por carreta. E-29 confirma 4 motoristas. A carreta é fixa por cavalo, *"às vezes
acontece de trocar"*.

Modelo: `veiculo` com `tipo` (`CAVALO` | `CARRETA` | `TRUCK`) e um vínculo de
conjunto com vigência, para o custo da carreta seguir o cavalo no período certo.

> ⚠️ **Discrepância a confirmar:** o briefing inicial falava em **6 caminhões
> próprios**. As folhas mostram **4 cavalos + 2 carretas = 6 veículos**. São
> coisas diferentes e mudam o cadastro. Está no follow-up.

### 5.5 Pagamento do agregado amarrado ao recebimento

D26 e achado 5: o acerto com o agregado acontece *"quando o cliente paga"*, CT-e
a CT-e. O título a pagar não tem vencimento por data — tem **gatilho**: nasce
quando o título a receber correspondente é baixado.

Modelo: `lancamento.gatilho_vencimento` (`DATA` | `AO_RECEBER`) +
`lancamento_origem_id`. Sem isso, o fluxo de caixa projeta pagamento que não vai
acontecer.

### 5.6 Formas de pagamento e parcelamento

Achado 4: as folhas trazem *cheque, parcelado cartão, parcelado boleto, PG* junto
de cada despesa. O título único já previa isso, mas confirma o requisito de
**parcelamento** — uma compra parcelada gera N títulos com vencimentos próprios.

### 5.7 Km improdutivo por erro de terceiro

Achado 9: *"Jangada/LK → 2.200 — Marcinha — 01/09 — andou 200 km — endereço
errado."* Km rodado a mais por informação errada do cliente, anotado e nunca
cobrado nem somado.

Campo pequeno, valor alto: `km_improdutivo` + `motivo` na viagem, e um relatório
de km improdutivo por cliente. Dá base factual pra ela cobrar ou renegociar.

### 5.8 Retorno vazio é a regra e não é medido

A4: *"na grande maioria vazio"*, sem estimativa. Transporte de gado
raramente tem carga de retorno.

Se ela roda ~400 km carregada e volta ~400 km vazia, o custo real por km
**faturado** é aproximadamente o dobro do que a intuição sugere. Ela já
desconfia disso — as anotações a lápis mostram a conta sendo tentada à mão:
*"Faz. Camila teria que aumentar 0,40 no kg"*, *"Faz. Vitória teria que
aumentar"*.

Medir km carregado × km vazio é um dos maiores valores que o sistema entrega
aqui, e alimenta direto a precificação.

### 5.9 Precificação por cabeça e por kg

Achado 7: existe uma conta informal de preço por cabeça de gado e por kg
(*"78 cabeças — Camila R$ 110,00"*, *"77 cabeças — Vitória R$ 87,00"*), que
convive com a tabela por km (C14).

O frete precisa registrar **cabeças** e **peso**, e o relatório precisa mostrar
R$/km, R$/cabeça e R$/kg lado a lado. É a conta que ela já faz a lápis — o
sistema só precisa devolvê-la pronta.

### 5.10 Depreciação fora — decisão fechada

F43: *"só o dinheiro que sai do caixa"*. Fecha a decisão D4: **visão de caixa é
o padrão**, com a parcela do financiamento entrando integralmente como custo do
veículo. A visão econômica com depreciação fica como opção futura, não no MVP.

Peso disso: **2 caminhões financiados, R$ 42.000 por caminhão/mês, ~40 parcelas
restantes** — R$ 84 mil/mês de desembolso fixo. É o maior custo fixo da empresa e
torna o relatório de resultado por caminhão o número mais importante do sistema:
*esses dois caminhões pagam a própria parcela?*

---

## 6. Riscos revistos

| Risco | Antes | Agora |
|---|---|---|
| Ausência de rotina de coleta | **Alto** | **Médio** — a rotina existe em papel; é migrá-la, não criá-la |
| Digitação de abastecimento | Baixo (cartão resolveria) | **Alto** — sem fonte automática, 100% manual |
| Valor real do frete não registrado | não identificado | **Alto** — bloqueia lucro por frete e comissão do motorista |
| Importação de XML resolve a receita | premissa aceita | **Derrubada** — resolve o fiscal, não o gerencial |
| Volume de lançamentos | 300–500/mês | **600–900/mês** — ainda tranquilo em Postgres, mas exige UX rápida |
| Adoção pelo motorista | Alto | **Médio** — ela já quer celular e eles já anotam |

---

## 7. Follow-up com a Ana (7 perguntas, curtas)

Nada aqui bloqueia o começo do trabalho. São confirmações:

1. **Quantos veículos ao todo?** O briefing dizia 6 caminhões; as folhas mostram
   4 cavalos + 2 carretas. Confirmar cavalos, carretas e se há algum veículo fora
   das folhas.
2. **O dinheiro do frete do agregado passa pela conta da Lysor?** Ou seja: o
   cliente paga a Lysor e ela repassa ao agregado descontando os 10% + seguro, ou
   o agregado recebe direto e paga a comissão depois? Muda o contas a receber.
3. **R$ 42.000/mês é por caminhão mesmo?** Com ~40 parcelas dá R$ 1,68 milhão por
   veículo. Confirmar se é por unidade, se inclui carreta, e se é financiamento
   ou consórcio.
4. **Quais veículos têm IPVA e licenciamento?** A resposta ficou ambígua
   (*"dois têm, outros 2 não"*) — e o porquê.
5. **"Tudo pelo celular" (H51) significa o quê?** O motorista lançando
   abastecimento pelo celular, ou o sistema inteiro sendo usado por celular?
6. **Morte ou perda de animal na viagem** — acontece? Existe desconto, seguro ou
   acerto com o cliente quando acontece? (Não foi perguntado e é específico de
   carga viva.)
7. **GTA (Guia de Trânsito Animal)** — precisa ficar registrada junto do frete,
   ou fica só no processo do cliente?

**Pedir junto:** os XMLs de CT-e (para validar o `vCarga`), o extrato do Sem
Parar em PDF e o relatório de CT-e em xlsx do Simples CT-e.
