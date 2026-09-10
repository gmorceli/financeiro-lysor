'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { Select } from '@/components/ui'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Últimos 18 meses, do mais recente para o mais antigo. */
function opcoes() {
  const lista: Array<{ valor: string; rotulo: string }> = []
  const agora = new Date()
  for (let i = 0; i < 18; i++) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1))
    const ano = d.getUTCFullYear()
    const mes = d.getUTCMonth() + 1
    lista.push({
      valor: `${ano}-${String(mes).padStart(2, '0')}`,
      rotulo: `${MESES[mes - 1]} de ${ano}`,
    })
  }
  return lista
}

export function SeletorMes({ valor }: { valor: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const parametros = useSearchParams()

  return (
    <Select
      className="w-56"
      value={valor}
      aria-label="Mês do relatório"
      onChange={(e) => {
        const busca = new URLSearchParams(parametros.toString())
        busca.set('mes', e.target.value)
        router.push(`${pathname}?${busca.toString()}` as Route)
      }}
    >
      {opcoes().map((opcao) => (
        <option key={opcao.valor} value={opcao.valor}>
          {opcao.rotulo}
        </option>
      ))}
    </Select>
  )
}
