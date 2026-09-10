import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FORMATADOR_MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatarMoeda(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return FORMATADOR_MOEDA.format(Number(valor))
}

export function formatarNumero(valor: number | null | undefined, casas = 0) {
  if (valor === null || valor === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor)
}

export function formatarData(data: Date | string | null | undefined) {
  if (!data) return '—'
  const d = typeof data === 'string' ? new Date(data) : data
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}

/** Formata CPF ou CNPJ conforme a quantidade de dígitos. */
export function formatarCpfCnpj(valor: string | null | undefined) {
  if (!valor) return '—'
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return valor
}

/** Placa no padrão antigo (ABC-1234) ou Mercosul (ABC1D23). */
export function formatarPlaca(placa: string | null | undefined) {
  if (!placa) return '—'
  const limpa = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (/^[A-Z]{3}\d{4}$/.test(limpa)) return `${limpa.slice(0, 3)}-${limpa.slice(3)}`
  return limpa
}
