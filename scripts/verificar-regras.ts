/**
 * Verificação das regras de negócio dos cadastros.
 *
 * Sem framework de teste: são asserções diretas sobre os schemas de validação,
 * que é onde mora a lógica capaz de errar em silêncio. Roda com `npm run verificar`.
 *
 * O último bloco confere a regra de cobrança do agregado contra o acerto real
 * do Dorival Osti de 27/08/2026 — se essa conta parar de fechar, o cálculo de
 * receita da operação de agregado quebrou.
 */
import { veiculoSchema, motoristaSchema, proprietarioSchema } from '../src/lib/validacao'
import { somarMeses } from '../src/lib/calculos'

let falhas = 0
function checar(nome: string, condicao: boolean, detalhe = '') {
  console.log(`${condicao ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!condicao) falhas++
}

const veiculoBase = {
  apelido: 'FH Teste', placa: 'abc1d23', tipo: 'CAVALO', tipoPosse: 'PROPRIO',
  status: 'ATIVO', marca: '', modelo: '', ano: '', eixos: '', capacidadeKg: '',
  capacidadeCabecas: '', odometroAtual: '150000', dataAquisicao: '',
  valorAquisicao: '', observacoes: '', isentoIpva: 'false', isentoLicenciamento: 'true',
}

const v1 = veiculoSchema.safeParse(veiculoBase)
checar('veículo válido passa', v1.success)
checar('placa normalizada para maiúscula sem hífen', v1.success && v1.data.placa === 'ABC1D23')
checar('checkbox "false" vira false', v1.success && v1.data.isentoIpva === false)
checar('checkbox "true" vira true', v1.success && v1.data.isentoLicenciamento === true)
checar('campo vazio vira undefined', v1.success && v1.data.marca === undefined)

const v2 = veiculoSchema.safeParse({ ...veiculoBase, tipo: 'CARRETA' })
checar('carreta com odômetro é rejeitada', !v2.success)

const v3 = veiculoSchema.safeParse({ ...veiculoBase, tipo: 'CARRETA', odometroAtual: '' })
checar('carreta sem odômetro passa', v3.success)

const v4 = veiculoSchema.safeParse({ ...veiculoBase, tipoPosse: 'AGREGADO' })
checar('agregado sem proprietário é rejeitado', !v4.success)

const motoristaBase = {
  nome: 'Fulano de Tal', cpf: '123.456.789-01', vinculo: 'CLT',
  modeloRemuneracao: 'HIBRIDO', salarioFixo: '2805.50', percentualComissao: '12',
  baseComissao: 'FRETE_REAL', valorDiaria: '0', ativo: 'true',
  cnh: '', cnhCategoria: '', cnhValidade: '', telefone: '', veiculoPadraoId: '',
}

const m1 = motoristaSchema.safeParse(motoristaBase)
checar('motorista híbrido válido passa', m1.success)
checar('CPF guardado só com dígitos', m1.success && m1.data.cpf === '12345678901')
checar('base da comissão é o frete real', m1.success && m1.data.baseComissao === 'FRETE_REAL')

const m2 = motoristaSchema.safeParse({ ...motoristaBase, salarioFixo: '0' })
checar('híbrido sem salário é rejeitado', !m2.success)

const m3 = motoristaSchema.safeParse({
  ...motoristaBase, modeloRemuneracao: 'COMISSAO', salarioFixo: '0',
})
checar('só comissão sem salário passa', m3.success)

const m4 = motoristaSchema.safeParse({
  ...motoristaBase, modeloRemuneracao: 'COMISSAO', salarioFixo: '0', percentualComissao: '0',
})
checar('comissão zerada é rejeitada', !m4.success)

const m5 = motoristaSchema.safeParse({ ...motoristaBase, cpf: '123' })
checar('CPF incompleto é rejeitado', !m5.success)

const a1 = proprietarioSchema.safeParse({
  nome: 'Dorival Osti', cpfCnpj: '12345678901', tipoPessoa: 'PF',
  percentualCte: '10', percentualSeguroCarga: '0.06',
  quemPagaCombustivel: 'AGREGADO', quemPagaPedagio: 'AGREGADO',
  ativo: 'true', contato: '', telefone: '',
})
checar('agregado válido passa', a1.success)
checar('percentual do CT-e é numérico', a1.success && a1.data.percentualCte === 10)
checar('percentual do seguro aceita decimal', a1.success && a1.data.percentualSeguroCarga === 0.06)

// A conta que o formulário mostra como exemplo precisa bater com o acerto real.
if (a1.success) {
  const comissao = 11642 * (a1.data.percentualCte / 100)
  const seguro = 528550 * (a1.data.percentualSeguroCarga / 100)
  const total = Number((comissao + seguro).toFixed(2))
  checar(`acerto do Dorival fecha em R$ 1.481,33 (deu ${total})`, total === 1481.33)
}

const a2 = proprietarioSchema.safeParse({
  nome: 'X', cpfCnpj: '12345678901', tipoPessoa: 'PF',
  percentualCte: '150', percentualSeguroCarga: '0.06',
  quemPagaCombustivel: 'AGREGADO', quemPagaPedagio: 'AGREGADO', ativo: 'true',
})
checar('percentual acima de 100 é rejeitado', !a2.success)


// ---------------------------------------------------------------------------
// Parcelamento no fim do mês
// ---------------------------------------------------------------------------
// `setMonth` transborda: 31/01 + 1 mês dá 03/03, e a parcela seguinte volta
// para 31/03. Uma manutenção parcelada lançada dia 31 saía com um vencimento
// no mês errado.
const trintaEUm = new Date(Date.UTC(2026, 0, 31))
const emFevereiro = somarMeses(trintaEUm, 1)
checar(
  '31/01 + 1 mês cai em 28/02, não em março',
  emFevereiro.toISOString().slice(0, 10) === '2026-02-28',
  emFevereiro.toISOString().slice(0, 10),
)
checar(
  'e o mês seguinte volta para o dia 31',
  somarMeses(trintaEUm, 2).toISOString().slice(0, 10) === '2026-03-31',
  somarMeses(trintaEUm, 2).toISOString().slice(0, 10),
)
checar(
  'ano bissexto entra na conta',
  somarMeses(new Date(Date.UTC(2028, 0, 31)), 1).toISOString().slice(0, 10) === '2028-02-29',
)
checar(
  'virada de ano soma certo',
  somarMeses(new Date(Date.UTC(2026, 10, 30)), 3).toISOString().slice(0, 10) === '2027-02-28',
)
checar(
  'doze parcelas a partir de 31/01 nunca saem do mês esperado',
  Array.from({ length: 12 }, (_, i) => somarMeses(trintaEUm, i).getUTCMonth()).join(',') ===
    '0,1,2,3,4,5,6,7,8,9,10,11',
)

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} teste(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
