'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { AvisoErro, Button, Card, Checkbox, Input, Select } from '@/components/ui'
import { EXPLICACAO } from '@/lib/importacao'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { processarImportacao, type EstadoImportacao, type LinhaNaTela } from './actions'

const INICIAL: EstadoImportacao = {}

function Botao({ acao, rotulo, variante = 'primario', disabled }: {
  acao: string
  rotulo: string
  variante?: 'primario' | 'secundario'
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" name="acao" value={acao} variante={variante} disabled={pending || disabled}>
      {pending ? 'Processando…' : rotulo}
    </Button>
  )
}

function Linha({
  linha,
  clientes,
  marcada,
  aoMarcar,
}: {
  linha: LinhaNaTela
  clientes: { id: string; razaoSocial: string; nomeFantasia: string | null }[]
  marcada: boolean
  aoMarcar: (chave: string, valor: boolean) => void
}) {
  const bloqueios = linha.pendencias.filter((p) => p !== 'ESCOLHER_CLIENTE')

  return (
    <li className={linha.pronta ? 'py-4' : 'py-4 opacity-70'}>
      <div className="flex items-start gap-3">
        <span className="flex min-h-11 items-center">
          <Checkbox
            checked={marcada}
            disabled={!linha.pronta}
            onChange={(e) => aoMarcar(linha.chaveCte, e.target.checked)}
            aria-label={`Importar CT-e ${linha.numeroCte}`}
          />
          {marcada && linha.pronta && (
            <input type="hidden" name={`importar_${linha.chaveCte}`} value="sim" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium text-texto">
              CT-e {linha.numeroCte ?? '—'}
              <span className="ml-2 text-xs font-normal text-texto-suave">
                MDF-e {linha.numeroMdfe}
              </span>
            </span>
            <span className="whitespace-nowrap tabular-nums font-semibold text-texto">
              {formatarMoeda(linha.valorCte)}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-texto-suave">
            {formatarData(linha.data)} · {linha.origem} → {linha.destino}
            {linha.produto && ` · ${linha.produto.toLowerCase()}`}
          </p>

          <p className="mt-1 text-sm text-texto-suave">
            {linha.agregado ? (
              <>
                <span className="font-medium text-texto">Agregado</span>{' '}
                {linha.proprietarioNome ?? (
                  <span className="text-alerta">{linha.proprietarioDoXml} (não cadastrado)</span>
                )}{' '}
                · carga {formatarMoeda(linha.valorCarga)} · comissão{' '}
                {formatarMoeda(linha.comissao)} + seguro {formatarMoeda(linha.seguro)}
              </>
            ) : (
              <>
                {linha.veiculoApelido ?? (
                  <span className="text-alerta">placa {linha.placa} (não cadastrada)</span>
                )}
                {' · '}
                {linha.motoristaNome ?? (
                  <span className="text-alerta">{linha.motoristaDoXml} (não cadastrado)</span>
                )}
              </>
            )}
          </p>

          {bloqueios.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {bloqueios.map((p) => (
                <li
                  key={p}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-alerta"
                >
                  {EXPLICACAO[p]}
                </li>
              ))}
            </ul>
          )}

          {linha.pronta && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {linha.agregado ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-texto-suave">Cliente do frete</span>
                  <Select name={`cliente_${linha.chaveCte}`} defaultValue="" required={marcada}>
                    <option value="">Escolha…</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nomeFantasia || c.razaoSocial}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-texto-suave">Cliente</span>
                    <span className="flex min-h-11 items-center text-texto">
                      {linha.clienteNome}
                    </span>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-texto-suave">
                      Valor combinado{' '}
                      <span className="text-xs">(mude se o CT-e saiu pelo mínimo)</span>
                    </span>
                    <Input
                      name={`real_${linha.chaveCte}`}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      defaultValue={linha.valorCte}
                    />
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function FormularioImportacao({
  clientes,
}: {
  clientes: { id: string; razaoSocial: string; nomeFantasia: string | null }[]
}) {
  const [estado, formAction] = useActionState(processarImportacao, INICIAL)
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set())
  const [conteudos, setConteudos] = useState<string[]>([])
  const [selecionados, setSelecionados] = useState(0)
  const router = useRouter()

  /**
   * Filtra aqui mesmo o que não é manifesto. Numa pasta de um mês, metade dos
   * arquivos é evento de encerramento, e mandar todos ao servidor dobraria o
   * corpo da requisição sem necessidade. `<mod>58</mod>` é o modelo do MDF-e.
   */
  async function escolherArquivos(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(evento.target.files ?? [])
    setSelecionados(arquivos.length)
    setDesmarcadas(new Set())
    const textos = await Promise.all(arquivos.map((a) => a.text()))
    setConteudos(textos.filter((t) => t.includes('<mod>58</mod>')))
  }

  useEffect(() => {
    if (estado.ok) router.refresh()
  }, [estado.ok, router])

  const linhas = estado.linhas ?? []
  const prontas = linhas.filter((l) => l.pronta)
  const marcadas = prontas.filter((l) => !desmarcadas.has(l.chaveCte))
  const bloqueadas = linhas.filter((l) => !l.pronta)

  function marcar(chave: string, valor: boolean) {
    setDesmarcadas((atual) => {
      const proximo = new Set(atual)
      if (valor) proximo.delete(chave)
      else proximo.add(chave)
      return proximo
    })
  }

  if (estado.ok) {
    return (
      <Card className="p-6">
        <h2 className="text-base font-semibold text-texto">
          {estado.importados} frete{estado.importados === 1 ? '' : 's'} importado
          {estado.importados === 1 ? '' : 's'}
        </h2>
        <p className="mt-2 text-sm text-texto-suave">
          As viagens de frota própria ficaram <strong>em andamento</strong>: falta fechar cada uma
          com a quilometragem de chegada.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/fretes">
            <Button variante="secundario">Ver os fretes</Button>
          </Link>
          <Link href="/viagens">
            <Button variante="secundario">Fechar as viagens</Button>
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AvisoErro mensagem={estado.erroGeral} />

      <Card className="p-5">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto">Arquivos XML do MDF-e</span>
          <input
            type="file"
            multiple
            accept=".xml,text/xml,application/xml"
            onChange={escolherArquivos}
            className="min-h-11 w-full rounded-lg border border-borda bg-superficie px-3 py-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-fundo file:px-3 file:py-1.5 file:text-sm file:text-texto sm:text-sm"
          />
          <span className="text-xs text-texto-suave">
            Pode marcar a pasta inteira. O emissor exporta o manifesto e os eventos de
            encerramento juntos, e o sistema separa sozinho.
          </span>
        </label>

        {/*
          O XML viaja como campo escondido, não como arquivo. O React 19 limpa o
          formulário depois que a action responde, e o `input type=file` voltaria
          vazio no segundo clique — o de confirmar a importação.
        */}
        {conteudos.map((c, i) => (
          <input key={i} type="hidden" name="conteudo" value={c} />
        ))}

        {selecionados > 0 && (
          <p className="mt-3 text-sm text-texto-suave">
            {selecionados} arquivo{selecionados === 1 ? '' : 's'} escolhido
            {selecionados === 1 ? '' : 's'};{' '}
            <strong className="font-medium text-texto">
              {conteudos.length} {conteudos.length === 1 ? 'é manifesto' : 'são manifestos'}
            </strong>
            {selecionados > conteudos.length &&
              `, ${selecionados - conteudos.length} são eventos ou outra coisa`}
            .
          </p>
        )}

        <div className="mt-4">
          <Botao
            acao="conferir"
            rotulo="Ler os arquivos"
            variante="secundario"
            disabled={conteudos.length === 0}
          />
        </div>
      </Card>

      {linhas.length > 0 && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-texto">
                {estado.lidos} manifesto{estado.lidos === 1 ? '' : 's'} de {estado.arquivos}{' '}
                arquivo{estado.arquivos === 1 ? '' : 's'}
              </h2>
              <p className="text-sm text-texto-suave">
                {prontas.length} pronto{prontas.length === 1 ? '' : 's'}
                {bloqueadas.length > 0 && `, ${bloqueadas.length} com pendência`}
              </p>
            </div>

            {linhas.some((l) => l.agregado) && (
              <label className="mt-4 flex flex-col gap-1 text-sm sm:max-w-sm">
                <span className="text-texto-suave">
                  Nos fretes de agregado, o dinheiro do cliente
                </span>
                <Select name="fluxoFinanceiro" defaultValue="INTERMEDIADO">
                  <option value="INTERMEDIADO">passa pela Lysor, que repassa descontando</option>
                  <option value="DIRETO">vai direto ao agregado, que repassa a comissão</option>
                </Select>
              </label>
            )}

            <ul className="mt-2 divide-y divide-borda">
              {linhas.map((l) => (
                <Linha
                  key={l.chaveMdfe}
                  linha={l}
                  clientes={clientes}
                  marcada={l.pronta && !desmarcadas.has(l.chaveCte)}
                  aoMarcar={marcar}
                />
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <Botao
              acao="importar"
              rotulo={`Importar ${marcadas.length} frete${marcadas.length === 1 ? '' : 's'}`}
              disabled={marcadas.length === 0}
            />
            <p className="mt-2 text-xs text-texto-suave">
              Cada frete de frota própria cria também uma viagem, em andamento, com a
              quilometragem atual do caminhão. O que já estiver no sistema não entra de novo.
            </p>
          </Card>
        </>
      )}
    </form>
  )
}
