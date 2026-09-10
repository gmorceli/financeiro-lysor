import { clsx, type ClassValue } from 'clsx'
import type { Route } from 'next'
import type { Prisma } from '@prisma/client'
import { twMerge } from 'tailwind-merge'

/**
 * Valores monetários chegam do Prisma como `Decimal`, e de formulários como
 * string. As funções de formatação aceitam os três.
 */
export type ValorMonetario = number | string | Prisma.Decimal

/**
 * Rotas montadas em tempo de execução (`/viagens/${id}`) não passam pela
 * checagem estática do typedRoutes, que só conhece caminhos literais. Este
 * helper concentra a conversão num lugar só, em vez de espalhar casts.
 */
export function rota(caminho: string) {
  return caminho as Route
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FORMATADOR_MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatarMoeda(valor: ValorMonetario | null | undefined) {
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
