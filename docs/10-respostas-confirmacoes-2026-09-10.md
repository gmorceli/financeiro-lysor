# RESPOSTAS ÀS CONFIRMAÇÕES — LYSOR TRANSPORTES
Respondido por: Ana Veronica · Data: 10/09/2026
Referência: "Confirmações — Lysor Transportes", de 10/09/2026

---

## Parte 1 — Confirmações

### Sobre os agregados
**CONFIRMADO — está certo.**
O agregado paga a Lysor: 10% sobre o valor do CT-e + 0,06% sobre o valor da nota fiscal da carga (seguro). Diesel, pedágio e manutenção por conta do agregado. Acerto feito quando o cliente paga aquele CT-e, um por um. Os números do acerto do Dorival Osti (R$ 11.642,00 → R$ 1.164,20 + R$ 317,13 = R$ 1.481,33) estão corretos.

### Sobre os motoristas
**CONFIRMADO — está certo.**
4 motoristas, caminhão fixo com troca por manutenção. 2 só com comissão de 12%; 2 com salário de R$ 2.805,50 + os mesmos 12%. Comissão sobre o valor real do frete, não sobre o CT-e. Sem diária, pernoite ou vale de viagem.

### Sobre o lucro
**CONFIRMADO — está certo.**
Só o dinheiro que sai do caixa, sem desvalorização do caminhão. Parcela do financiamento entra inteira como custo do caminhão. 2 caminhões financiados, vencimento todo dia 20.

### Sobre o dia a dia do sistema
**CONFIRMADO — está certo.**
Usuários: Ana Veronica e Hygor. Tela da manhã: contas a pagar, contas a receber e saldo do caixa. Objetivo: parar de perder horas com as folhas e o fechamento. Início do registro: 01/09/2026.

---

## Parte 2 — Respostas às 10 perguntas

**1. Quantos veículos ao todo**
São **8 veículos**:
- 4 cavalos mecânicos
- 2 trucks
- 1 carreta de 2 eixos
- 1 carreta de 2 andares

Isso reconcilia com os "6 caminhões" do primeiro contato: 4 cavalos + 2 trucks = 6 caminhões, mais as 2 carretas.

**2. Quais veículos têm IPVA e licenciamento**
Somente **2 cavalos e 1 carreta**. Os demais são **isentos**.

**3. Valor da parcela do financiamento**
Confirmado: **R$ 42.000,00 por mês, por caminhão** — são dois financiamentos separados, um para cada. É **financiamento**, não consórcio. **Não inclui carreta** — somente o cavalo em cada um. Cerca de 40 parcelas restantes, vencimento dia 20.

**4. O dinheiro do frete do agregado passa pela conta da Lysor?**
**Acontecem os dois modelos:**
- Na maior parte: o cliente paga a Lysor, e a Lysor repassa ao agregado já descontando os 10% + seguro.
- Em alguns casos: o agregado recebe direto do cliente e depois passa para a Lysor apenas o valor dos 10% do CT-e + o seguro.

O sistema precisa suportar as duas formas.

**5. Registrar o valor real do frete quando o CT-e sai pelo mínimo**
**SIM — quer registrar os dois valores.** O fluxo proposto (sistema puxa o CT-e e pergunta "o valor foi esse mesmo?", com um clique para confirmar ou digitação do valor combinado) está aprovado.

**6. Morte ou perda de animal na viagem**
É **muito raro**. Quando acontece, o combinado é **direto com o cliente** e é **muito relativo** — não há regra fixa, desconto padrão nem seguro específico acionado.

**7. GTA no sistema**
**Não precisa guardar a GTA.** A **nota fiscal**, sim — essa é bom guardar.

**8. Controle de preço por cabeça e por quilo**
**Não.** Não querem esse controle dentro do sistema.

**9. Relatório detalhado de abastecimento do posto**
Pode pedir ao posto, mas **prefere que o motorista continue anotando** (km e litros). O lançamento manual pelo motorista é o caminho escolhido.

**10. "Tudo pelo celular"**
**As duas coisas:**
- os motoristas lançam abastecimento e despesa pelo celular deles;
- Ana Veronica e o Hygor também usariam o sistema pelo celular.

(Observação: na entrevista anterior ela disse preferir os relatórios no computador — o celular é adicional, não substitui.)

---

## Parte 3 — Arquivos ainda pendentes

- [ ] XMLs dos CT-e (a gerar no Simples CT-e)
- [ ] Extrato do Sem Parar em PDF
- [ ] Relatório de CT-e em Excel do Simples CT-e

---

## Pontos que mudaram em relação ao levantamento inicial

1. **A frota é maior do que aparecia nas folhas.** 8 veículos no total (4 cavalos, 2 trucks, 2 carretas) — as folhas manuscritas só mostravam 4 caminhões e 2 carretas.
2. **O financiamento não cobre carretas.** R$ 42.000,00/mês por cavalo, dois contratos separados.
3. **Existem dois fluxos financeiros distintos para agregado.** O contas a receber precisa tratar tanto o caso em que o dinheiro passa pela Lysor quanto o caso em que só a comissão entra.
4. **O abastecimento fica manual por escolha.** Mesmo com a possibilidade de relatório do posto, a preferência é manter a anotação do motorista.
5. **Preço por cabeça/kg foi descartado** como funcionalidade.
