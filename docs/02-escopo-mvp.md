# 02 — Escopo do MVP

Princípio de corte: **o MVP entrega o relatório de resultado por caminhão e por
frete com número em que o dono confia.** Tudo que não serve a isso fica para
depois — inclusive coisas que "seriam legais".

---

## Fatia 1 — O núcleo — ✅ **escopo fechado do MVP**

### Cadastros
- Empresa, usuários e perfis (Admin / Financeiro / Operação / Motorista)
- Clientes (embarcadores) com prazo de pagamento padrão
- Veículos: placa, tipo, modelo/ano, eixos, capacidade, **próprio ou agregado**
- Proprietários de agregados + regra de remuneração
- Motoristas: vínculo, CNH e validade, regra de remuneração
- Fornecedores (posto, oficina, borracharia)
- Categorias financeiras **pré-carregadas** para transporte (não configurável na v1)

### Operação
- **Viagem**: veículo + motorista + período + origem/destino + km inicial/final +
  km carregado / km vazio
- **Frete (CT-e / OS)**: vinculado à viagem — cliente, rota, produto, peso,
  valor do frete, pedágio destacado, data de entrega
- Uma viagem aceita N fretes (se o cliente rodar carga fracionada — a confirmar)
- **Tela "Fechar viagem"**: o fluxo principal do sistema, faz tudo num lugar só

### Custos
- **Abastecimento**: data, posto, litros, valor, odômetro, tanque cheio (S/N)
  → calcula **km/l** automaticamente entre abastecimentos de tanque cheio
- **Pedágio**, despesas de estrada, diária/pernoite
- **Manutenção**: preventiva / corretiva / pneu — com km, fornecedor, anexo da NF
- **Custos fixos do veículo**: seguro, IPVA, licenciamento, rastreador,
  parcela de financiamento, depreciação (lançamento recorrente mensal)
- **Custos fixos da empresa**: lançamento recorrente mensal

### Acerto de motorista e agregado
- Adiantamento de viagem (vale)
- Despesas comprovadas do motorista
- Comissão / diária / percentual conforme a regra cadastrada
- **Fechamento da viagem gera o título a pagar** do motorista ou do agregado

### Financeiro
- Contas a receber (gerado pelo faturamento do frete)
- Contas a pagar (gerado por todo custo lançado)
- Baixa com data e valor efetivo, baixa parcial, anexo do comprovante
- Fluxo de caixa por vencimento (previsto × realizado)

### Relatórios — o entregável
1. **Resultado por caminhão** (mês/período): receita, custo direto, custo do
   veículo, margem, **R$/km**, **custo/km**, **km/l**, km rodado, km vazio
2. **Resultado por frete/viagem**: DRE em cascata do frete
3. **Resultado por cliente** e **por rota**
4. **Frota própria × agregados**: comparativo de margem
5. **DRE gerencial** consolidado em cascata
6. **Fluxo de caixa**: a receber e a pagar por vencimento
7. Exportação XLSX e PDF em todos eles

### Dashboard
Seis números e nada mais: faturamento do mês · custo do mês · lucro operacional ·
custo/km da frota · km/l médio · títulos vencendo em 7 dias.
Mais um painel de alerta: **viagens com dados incompletos**.

---

## Fatia 2 — Redução de digitação (fora do MVP, logo em seguida)

Alta prioridade porque é o que garante que o sistema sobreviva ao terceiro mês.

- Importação de **XML de CT-e** (pasta, upload em lote ou leitura de e-mail)
- Importação do **extrato do cartão de combustível** (CSV/API)
- Importação do **extrato da tag de pedágio**, casando por placa e data
- **PWA do motorista**: abastecimento, despesa e fim de viagem — com foto
- Faturamento agrupado: várias CT-e numa fatura só, com boleto/prazo do cliente

---

## Fatia 3 — Gestão (depois)

- Manutenção preventiva por km/data com alerta
- Controle de pneus por posição e custo por km
- Alertas de vencimento: CNH, licenciamento, seguro, revisão
- Tabela de preço por rota e simulador de frete (com piso mínimo ANTT)
- Conciliação bancária por OFX
- Integração com rastreador/telemetria (km automático — mata o problema do odômetro)
- App do cliente/embarcador para acompanhar entrega

---

## Fora de escopo — escrever na proposta

Fronteiras explícitas, para não virar discussão no meio do projeto:

- ❌ **Emissão de CT-e, MDF-e ou NF-e.** O sistema **lê** o XML do emissor atual.
- ❌ **Contabilidade fiscal**: SPED, balanço, apuração de impostos, folha de
  pagamento. Sistema gerencial, não substitui o contador.
- ❌ **Emissão de boleto e cobrança bancária** (avaliar em fase 2 via gateway)
- ❌ **Roteirização, torre de controle, rastreamento em tempo real**
- ❌ **Gestão de armazém / WMS / estoque de peças**
- ❌ **CIOT e pagamento eletrônico de frete** — depende de integração com
  instituição habilitada; avaliar em fase 2 se o cliente contrata TAC avulso
- ❌ Migração de histórico completo das planilhas (entra como **saldo inicial**,
  não como lançamento retroativo)

---

## Sequenciamento sugerido de construção

Não é cronograma de calendário — é ordem de dependência. Cada etapa termina com
algo demonstrável para o cliente.

| # | Etapa | Termina quando |
|---|---|---|
| 1 | Modelo de dados + auth + cadastros | O cliente cadastra os 6 caminhões e os agregados dele |
| 2 | Viagem + frete + lançamento financeiro | Dá pra lançar uma viagem completa e ver o custo |
| 3 | Motor de rateio + relatório por caminhão e por frete | **O relatório que ele pediu existe** |
| 4 | Contas a pagar/receber + fluxo de caixa | O financeiro para de usar a planilha |
| 5 | Acerto de motorista/agregado + dashboard + exports | MVP fechado |
| 6 | Importações (XML, cartão, pedágio) + PWA do motorista | Digitação cai ~70% |

**Recomendação de implantação:** rodar **um mês em paralelo** com a planilha
atual. É o único jeito de o dono confiar no número — ele compara, vê bater (ou
vê o sistema achar erro na planilha, que é o que costuma acontecer) e migra.
