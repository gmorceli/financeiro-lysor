# Roteiro de cadastro inicial — Lysor Transportes

Versão navegável, para a cliente usar no celular marcando o que já fez:
https://claude.ai/code/artifact/6c17250b-cf03-4615-99df-c21ec3019455

Este documento é a fonte. O artifact é a mesma coisa em forma de lista marcável.

## Por que a ordem é essa

Não é arbitrária, é dependência:

1. **Veículos** — não dependem de nada, e tudo o mais aponta para eles.
2. **Motoristas** — cada um aponta para o *caminhão de sempre*, que precisa existir antes.
3. **Clientes** — frete não é lançado sem cliente.
4. **Agregados** — antes do primeiro frete de agregado, e antes de qualquer veículo que seja deles.
5. **Fornecedores** — o único que dá para deixar pela metade sem travar nada.

## O que já é conhecido, e o que falta

O levantamento e as confirmações (`docs/07` e `docs/10`) fecharam quase tudo. O
roteiro entrega isso preenchido e marca as lacunas reais, que são só documentos
e quilometragem.

### Veículos — apelido, tipo e isenção já confirmados

| Apelido | Tipo | IPVA e licenciamento |
|---|---|---|
| Scania 440 | Cavalo | Paga |
| Scania Amarela JS4 | Cavalo | Paga |
| FH Cinza | Cavalo | Isento |
| FH Vermelha | Cavalo | Isento |
| Truck 1 | Truck | Isento |
| Truck 2 | Truck | Isento |
| Carreta Viloças | Carreta | Paga |
| Carreta 2 andares | Carreta | Isento |

Falta: **placa** de cada um e o **quilômetro do painel** dos seis que rodam.

"Truck 1" e "Truck 2" são rótulos meus, não nomes de operação — o roteiro diz
para ela usar o nome que a equipe fala, porque é o apelido que aparece em toda
tela.

### Motoristas — remuneração já confirmada

| Quantos | Forma | Salário | Comissão | Base |
|---|---|---|---|---|
| 2 | Só comissão | 0 | 12% | frete real |
| 2 | Híbrido | R$ 2.805,50 | 12% | frete real |

Diária, pernoite e vale: **zero**. Falta: nome, CPF e CNH.

### Agregados — regra já confirmada

10% sobre o CT-e + 0,06% sobre a nota fiscal da carga. Combustível e pedágio por
conta do agregado. Falta: CPF/CNPJ do Dorival Osti e dos demais.

### Clientes e fornecedores

Nada conhecido. São os dois blocos que dependem inteiramente dela.

## Os quatro campos que o roteiro destaca

Não porque são obrigatórios — porque errar neles custa caro e o erro só aparece
semanas depois:

1. **Quilometragem atual do veículo.** Base de todo cálculo de consumo e de custo
   por km. Número torto aqui torce o km/l de todo mês seguinte.
2. **"A comissão incide sobre" = valor real do frete.** Quando o CT-e sai pelo
   mínimo, a diferença é de R$ 431 num CT-e só.
3. **Prazo de pagamento do cliente.** É o que projeta o caixa. Zero significa
   "paga à vista", e aí o a receber mostra dinheiro que não entrou.
4. **Validade da CNH.** Não é obrigatório, mas é o que gera o aviso antes de
   vencer.

## O que fica de fora de propósito

- **O financiamento** (R$ 42.000/mês por caminhão, dia 20, ~40 parcelas) não é
  cadastro: é conta a pagar, e vale lançar parcelado de uma vez, acompanhado.
- **Viagens e fretes anteriores a 01/09/2026.** A data de corte existe para o
  primeiro relatório não misturar dois períodos e mentir.

## Uma viagem de teste no fim

A última etapa é abrir uma viagem, lançar frete e abastecimento, fechar e abrir o
Resultado. Serve para ela ver o ciclo fechar e os números aparecerem do outro
lado — é mais convincente que qualquer explicação, e expõe cedo qualquer campo
que não faça sentido para a operação.
