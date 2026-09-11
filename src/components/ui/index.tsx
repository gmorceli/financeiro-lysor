/**
 * Primitivos de interface.
 *
 * Escritos à mão em vez de puxados do CLI do shadcn: o conjunto necessário é
 * pequeno e usar `<select>` nativo em vez de um combobox com portal funciona
 * melhor no celular, que é onde metade desta operação acontece.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------- Button

const VARIANTES_BOTAO = {
  primario:
    'bg-primaria text-white hover:bg-primaria/90 focus-visible:outline-primaria',
  secundario:
    'bg-superficie text-texto border border-borda hover:bg-fundo focus-visible:outline-primaria',
  perigo: 'bg-erro text-white hover:bg-erro/90 focus-visible:outline-erro',
  discreto:
    'bg-transparent text-texto-suave hover:bg-fundo hover:text-texto focus-visible:outline-primaria',
} as const

export function Button({
  className,
  variante = 'primario',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES_BOTAO
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        // A altura mínima de 44px no toque vem da regra `pointer: coarse` em
        // globals.css, que vale para todo botão. Repetir aqui criaria duas
        // fontes para a mesma decisão.
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTES_BOTAO[variante],
        className,
      )}
      {...props}
    />
  )
}

// ---------------------------------------------------------------- Campos

/**
 * `text-base` (16px) no celular não é escolha estética: abaixo de 16px o Safari
 * do iOS dá zoom sozinho ao focar o campo, e a pessoa perde o resto do
 * formulário de vista no meio da digitação. No desktop volta para 14px, que é a
 * densidade que o resto da tela usa.
 *
 * A altura de 44px no toque vem da regra `pointer: coarse` em globals.css.
 */
const CLASSE_CAMPO =
  'w-full rounded-lg border border-borda bg-superficie px-3 py-2 ' +
  'text-base sm:text-sm text-texto ' +
  'placeholder:text-texto-suave/60 focus:border-primaria focus:outline-none ' +
  'focus:ring-2 focus:ring-primaria/20 disabled:opacity-60'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(CLASSE_CAMPO, className)} {...props} />
})

/**
 * Sem `appearance-none`: ele tirava a seta que o sistema desenha e o campo
 * ficava idêntico a um campo de texto — nada na tela dizia que ali se escolhe
 * de uma lista. A seta do próprio aparelho é a que a pessoa já reconhece.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(CLASSE_CAMPO, 'pr-9', className)} {...props}>
      {children}
    </select>
  )
})

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(CLASSE_CAMPO, 'min-h-20', className)} {...props} />
})

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'size-5 sm:size-4 rounded border-borda text-primaria focus:ring-2 focus:ring-primaria/20',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Campo com rótulo, dica opcional e erro. A dica existe porque boa parte dos
 * campos deste sistema precisa de uma linha explicando o porquê — o operador
 * não deve ter que adivinhar o que preencher.
 */
export function Campo({
  label,
  dica,
  erro,
  obrigatorio,
  children,
}: {
  label: string
  dica?: string
  erro?: string[]
  obrigatorio?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-texto">
        {label}
        {obrigatorio && <span className="ml-0.5 text-erro">*</span>}
      </span>
      {children}
      {dica && !erro?.length && <span className="text-xs text-texto-suave">{dica}</span>}
      {erro?.length ? <span className="text-xs text-erro">{erro.join('. ')}</span> : null}
    </label>
  )
}

// ---------------------------------------------------------------- Estrutura

/**
 * `min-w-0` importa mais do que parece. Item de grade tem `min-width: auto` por
 * padrão, então um Card com tabela de 36rem dentro esticava a coluna e fazia a
 * página inteira rolar de lado no celular — o cabeçalho terminava no meio da
 * tela e o resto ficava órfão. A tabela já tem rolagem própria; o Card só
 * precisava parar de crescer junto.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('min-w-0 rounded-xl border border-borda bg-superficie', className)}
      {...props}
    />
  )
}

export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao?: string
  acao?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-texto">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-texto-suave">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

export function Badge({
  className,
  tom = 'neutro',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tom?: 'neutro' | 'positivo' | 'alerta' | 'erro'
}) {
  const tons = {
    neutro: 'bg-fundo text-texto-suave border-borda',
    positivo: 'bg-primaria-clara text-primaria border-primaria/20',
    alerta: 'bg-amber-50 text-alerta border-amber-200',
    erro: 'bg-red-50 text-erro border-red-200',
  } as const
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        tons[tom],
        className,
      )}
      {...props}
    />
  )
}

/**
 * Tabela com rolagem horizontal própria — a página nunca rola de lado.
 *
 * `minimo` existe porque 36rem é o certo para as tabelas largas do financeiro e
 * o errado para uma de três colunas: no celular ela empurrava a coluna de valor
 * para fora da tela, e a pessoa via a data e o nome mas não via quanto era.
 * Tabela curta usa `min-w-0` e cabe inteira.
 */
export function Tabela({
  children,
  minimo = 'min-w-[36rem]',
}: {
  children: React.ReactNode
  minimo?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', minimo)}>{children}</table>
    </div>
  )
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-borda px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-texto-suave',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Link dentro de célula de tabela.
 *
 * Um `<a>` solto numa célula tem a altura do texto — 16px. Numa lista de
 * caminhões no celular, isso é pedir para a pessoa acertar uma linha de um
 * milímetro e meio com o polegar. A margem negativa come o `py-3` da própria
 * célula, então o alvo passa a ocupar a linha inteira sem que a tabela cresça.
 */
export const LINK_TABELA =
  '-my-3 inline-flex min-h-11 items-center font-medium text-primaria hover:underline sm:my-0 sm:min-h-0'

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-borda px-4 py-3 align-middle', className)} {...props} />
}

export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao: string
  acao?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-base font-medium text-texto">{titulo}</p>
      <p className="max-w-md text-sm text-texto-suave">{descricao}</p>
      {acao}
    </div>
  )
}

export function AvisoErro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-erro">
      {mensagem}
    </div>
  )
}
