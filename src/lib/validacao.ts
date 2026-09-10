import { z } from 'zod'

/**
 * Checkbox de formulário HTML. Um checkbox desmarcado simplesmente não é
 * enviado, e `Boolean('false')` é `true` — então a conversão precisa ser
 * explícita. Nos formulários, um input hidden com "false" precede o checkbox
 * para que o valor desmarcado chegue mesmo assim.
 */
const booleanoFormulario = z
  .union([z.string(), z.boolean(), z.undefined()])
  .transform((v) => v === true || v === 'true' || v === 'on' || v === '1')

/** Campo de texto opcional: string vazia do formulário vira `undefined`. */
const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional()

/** Número opcional vindo de input HTML (que sempre entrega string). */
const numeroOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isFinite(v), 'Número inválido')
  .optional()

const decimalOpcional = numeroOpcional.refine(
  (v) => v === undefined || v >= 0,
  'Não pode ser negativo',
)

const dataOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), 'Data inválida')
  .optional()

/** Aceita CPF (11 dígitos) ou CNPJ (14), guardando só os números. */
const cpfCnpj = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11 || v.length === 14, 'Informe um CPF ou CNPJ completo')

export const veiculoSchema = z.object({
  apelido: z
    .string()
    .trim()
    .min(2, 'Dê um apelido — é como o veículo aparece em todas as telas'),
  placa: z
    .string()
    .trim()
    .min(7, 'Placa incompleta')
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  tipo: z.enum(['CAVALO', 'TRUCK', 'CARRETA']),
  tipoPosse: z.enum(['PROPRIO', 'AGREGADO']),
  proprietarioId: textoOpcional,
  marca: textoOpcional,
  modelo: textoOpcional,
  ano: numeroOpcional,
  eixos: numeroOpcional,
  capacidadeKg: numeroOpcional,
  capacidadeCabecas: numeroOpcional,
  odometroAtual: numeroOpcional,
  isentoIpva: booleanoFormulario,
  isentoLicenciamento: booleanoFormulario,
  dataAquisicao: dataOpcional,
  valorAquisicao: decimalOpcional,
  status: z.enum(['ATIVO', 'MANUTENCAO', 'INATIVO', 'VENDIDO']),
  observacoes: textoOpcional,
})
  .refine((v) => v.tipoPosse === 'PROPRIO' || !!v.proprietarioId, {
    message: 'Veículo agregado precisa ter um proprietário',
    path: ['proprietarioId'],
  })
  // Carreta é rebocada: não roda sozinha, então não tem odômetro próprio.
  .refine((v) => v.tipo !== 'CARRETA' || v.odometroAtual === undefined, {
    message: 'Carreta não tem odômetro — deixe em branco',
    path: ['odometroAtual'],
  })

export const motoristaSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo'),
  cpf: cpfCnpj,
  cnh: textoOpcional,
  cnhCategoria: textoOpcional,
  cnhValidade: dataOpcional,
  telefone: textoOpcional,
  vinculo: z.enum(['CLT', 'AUTONOMO', 'AGREGADO']),
  modeloRemuneracao: z.enum(['FIXO_MENSAL', 'COMISSAO', 'HIBRIDO']),
  salarioFixo: decimalOpcional,
  percentualComissao: decimalOpcional,
  baseComissao: z.enum(['FRETE_REAL', 'VALOR_CTE']),
  valorDiaria: decimalOpcional,
  veiculoPadraoId: textoOpcional,
  ativo: booleanoFormulario,
})
  .refine(
    (v) => v.modeloRemuneracao === 'COMISSAO' || (v.salarioFixo ?? 0) > 0,
    { message: 'Quem tem salário precisa ter o valor informado', path: ['salarioFixo'] },
  )
  .refine(
    (v) => v.modeloRemuneracao === 'FIXO_MENSAL' || (v.percentualComissao ?? 0) > 0,
    { message: 'Quem recebe comissão precisa ter o percentual', path: ['percentualComissao'] },
  )

export const clienteSchema = z.object({
  razaoSocial: z.string().trim().min(2, 'Informe o nome do cliente'),
  nomeFantasia: textoOpcional,
  cnpj: z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v.replace(/\D/g, '')))
    .refine((v) => v === undefined || v.length === 11 || v.length === 14, 'CPF ou CNPJ inválido')
    .optional(),
  contato: textoOpcional,
  telefone: textoOpcional,
  email: z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success, 'E-mail inválido')
    .optional(),
  prazoPagamentoDias: numeroOpcional,
  ativo: booleanoFormulario,
})

export const proprietarioSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome do agregado'),
  cpfCnpj,
  tipoPessoa: z.enum(['PF', 'PJ']),
  contato: textoOpcional,
  telefone: textoOpcional,
  // Regra de COBRANÇA: na Lysor o agregado paga a transportadora.
  percentualCte: z.coerce
    .number({ invalid_type_error: 'Informe o percentual' })
    .min(0, 'Não pode ser negativo')
    .max(100, 'Não pode passar de 100%'),
  percentualSeguroCarga: z.coerce
    .number({ invalid_type_error: 'Informe o percentual do seguro' })
    .min(0, 'Não pode ser negativo')
    .max(100, 'Não pode passar de 100%'),
  quemPagaCombustivel: z.enum(['AGREGADO', 'TRANSPORTADORA']),
  quemPagaPedagio: z.enum(['AGREGADO', 'TRANSPORTADORA']),
  ativo: booleanoFormulario,
})

export const fornecedorSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do fornecedor'),
  cpfCnpj: z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v.replace(/\D/g, '')))
    .refine((v) => v === undefined || v.length === 11 || v.length === 14, 'CPF ou CNPJ inválido')
    .optional(),
  tipoPessoa: z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v))
    .pipe(z.enum(['PF', 'PJ']).optional()),
  categoria: textoOpcional,
  telefone: textoOpcional,
  ativo: booleanoFormulario,
})

export type VeiculoInput = z.infer<typeof veiculoSchema>
export type MotoristaInput = z.infer<typeof motoristaSchema>
export type ClienteInput = z.infer<typeof clienteSchema>
export type ProprietarioInput = z.infer<typeof proprietarioSchema>
export type FornecedorInput = z.infer<typeof fornecedorSchema>
