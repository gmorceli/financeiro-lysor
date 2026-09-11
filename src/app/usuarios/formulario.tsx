'use client'

import { Campo, Checkbox, Input, Select } from '@/components/ui'
import { Formulario } from '@/components/formulario'
import { DESCRICOES_PERFIL, ROTULOS_PERFIL } from '@/lib/permissoes'
import type { PerfilUsuario } from '@prisma/client'
import { salvarUsuario } from './actions'
import { SenhaSugerida } from './senha-sugerida'

const PERFIS: PerfilUsuario[] = ['ADMIN', 'FINANCEIRO', 'OPERACAO', 'MOTORISTA']

export function FormularioUsuario({
  usuario,
  motoristas,
  ehVocMesmo,
}: {
  usuario?: {
    id: string
    nome: string
    email: string
    perfil: PerfilUsuario
    motoristaId: string | null
    ativo: boolean
  }
  motoristas: { id: string; nome: string }[]
  ehVocMesmo?: boolean
}) {
  return (
    <Formulario action={salvarUsuario} voltarPara="/usuarios">
      {(erros) => (
        <>
          {usuario && <input type="hidden" name="id" value={usuario.id} />}

          <Campo label="Nome" erro={erros.nome} obrigatorio>
            <Input name="nome" defaultValue={usuario?.nome} required />
          </Campo>

          <Campo
            label="E-mail"
            dica="É com ele que a pessoa entra."
            erro={erros.email}
            obrigatorio
          >
            <Input
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              defaultValue={usuario?.email}
              required
            />
          </Campo>

          <Campo label="Perfil" erro={erros.perfil} obrigatorio>
            <Select name="perfil" defaultValue={usuario?.perfil ?? 'OPERACAO'} required>
              {PERFIS.map((perfil) => (
                <option key={perfil} value={perfil}>
                  {ROTULOS_PERFIL[perfil]} — {DESCRICOES_PERFIL[perfil]}
                </option>
              ))}
            </Select>
          </Campo>

          {!usuario && <SenhaSugerida erro={erros.senha} />}

          <Campo
            label="Motorista vinculado"
            dica="Só para quando o aplicativo do motorista existir. Pode deixar em branco."
            erro={erros.motoristaId}
          >
            <Select name="motoristaId" defaultValue={usuario?.motoristaId ?? ''}>
              <option value="">Nenhum</option>
              {motoristas.map((motorista) => (
                <option key={motorista.id} value={motorista.id}>
                  {motorista.nome}
                </option>
              ))}
            </Select>
          </Campo>

          <label className="flex items-center gap-2">
            {/* Checkbox desmarcado não é enviado; o hidden garante o "false". */}
            <input type="hidden" name="ativo" value="false" />
            <Checkbox name="ativo" value="true" defaultChecked={usuario?.ativo ?? true} />
            <span className="text-sm text-texto">
              Pode entrar no sistema
              {ehVocMesmo && (
                <span className="ml-1 text-xs text-texto-suave">(este é o seu usuário)</span>
              )}
            </span>
          </label>
        </>
      )}
    </Formulario>
  )
}
