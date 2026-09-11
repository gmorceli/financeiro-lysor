# O que os XML revelaram — e por que mudam a fila

Em 10/09 a cliente mandou os XML de setembro. **Não são CT-e: são 28 MDF-e**
autorizados (modelo 58), de 01 a 08/09/2026, mais os eventos de encerramento.

O pedido original era validar se o CT-e traz `infCarga/vCarga`, para eliminar a
digitação do valor da nota no acerto do agregado. A resposta veio por outro
caminho, e melhor.

> Os dados extraídos têm CPF e CNPJ de pessoas reais e **não estão neste
> repositório**. Foram entregues ao autor em arquivo separado.

## O achado que muda o desenho

**Cada MDF-e traz exatamente um CT-e.** Nos 28, sem exceção. Isso torna o MDF-e
um registro por frete, e não por comboio — e ele carrega, num arquivo só, o que
hoje é digitado a mão:

| Campo do MDF-e | O que é no sistema |
|---|---|
| `tot/vCarga` | **o valor da carga**, base do seguro de 0,06% |
| `infANTT/infPag/vContrato` | o valor do frete |
| `infDoc//chCTe` | a chave do CT-e, de onde sai o número |
| `veicTracao/placa` | o veículo |
| `veicTracao/prop` | **quem é o dono** — ausente na frota própria, presente no agregado |
| `veicTracao/condutor` | nome e CPF do motorista |
| `ide/xMunCarrega` e `infMunDescarga/xMunDescarga` | origem e destino |
| `ide/dhIniViagem` | a saída |
| `prodPred/xProd` | a categoria do gado |

`veicTracao/prop` é o campo mais útil de todos: a presença dele **é** a distinção
entre frete próprio e frete de agregado, que hoje o operador escolhe na tela.

## A conta do agregado fecha sozinha

Os três fretes do Dorival Osti na semana somam R$ 3.752,00 de CT-e e
R$ 188.400,00 de carga. Aplicando a regra dele:

- comissão de 10% sobre o CT-e: **R$ 375,20**
- seguro de 0,06% sobre a carga: **R$ 113,04**
- acerto: **R$ 488,24**

É a mesma aritmética que fechou contra o acerto manual de 27/08 (R$ 1.481,33),
agora com os dois números vindo do arquivo em vez da cabeça de alguém.

## O modelo invertido, confirmado por documento

Em todo MDF-e de agregado, o responsável pelo pagamento declarado no CIOT é a
**Lysor**. Em todo MDF-e de frota própria, é um **terceiro** — o pecuarista que
contratou. É a confirmação documental do fluxo que a cliente descreveu de
memória, e vale registrar: até aqui essa era a única peça central do sistema
apoiada só em conversa.

## O que isso muda na fila

A importação de XML estava listada como "corta boa parte da digitação". Ela vale
mais do que isso: com o MDF-e, lançar um frete deixa de ser digitação e vira
conferência. Em uma semana foram 28 fretes — em um mês, entre 70 e 90, que é
exatamente o volume que a cliente descreveu.

Duas ressalvas honestas antes de prometer:

1. **O CT-e continua sendo necessário** para o valor fiscal exato e para o
   tomador do serviço. O MDF-e dá o frete contratado, que no caso próprio é o
   que a Lysor recebe e no caso agregado é o que a Lysor paga.
2. **`vContrato` é o valor declarado no CIOT**, não necessariamente o "valor real
   do frete" que a cliente registra à parte quando o CT-e sai pelo mínimo. A tela
   que mostra a divergência continua fazendo falta.

## Também resolveu o cadastro inicial

O roteiro de cadastro (`docs/12`) listava como lacuna placa, CPF de motorista,
documento de agregado e nome de cliente. Os XML entregaram os quatro:

- **4 motoristas** com nome e CPF — o número bate com o levantamento;
- **as placas** dos veículos que rodaram na semana;
- **10 agregados** com documento e RNTRC — o "vários" do primeiro contato,
  quantificado;
- **os clientes**, que não são frigoríficos e sim **pecuaristas**. O mesmo CPF
  aparece com três razões sociais diferentes (a fazenda muda, o pagador não), o
  que reforça guardar o documento como chave, que é o que o sistema já faz.
