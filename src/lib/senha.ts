import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * `promisify(scrypt)` escolhe a sobrecarga sem opções, e é justamente nas
 * opções que moram os parâmetros de custo — daí a promessa escrita à mão.
 */
function derivarChave(
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha, sal, tamanho, opcoes, (erro, chave) =>
      erro ? rejeitar(erro) : resolver(chave),
    )
  })
}

/**
 * Hash de senha com scrypt do `node:crypto`.
 *
 * scrypt em vez de bcrypt ou argon2 porque já vem no Node: nada de dependência
 * nativa para compilar no deploy, e os parâmetros ficam explícitos aqui em vez
 * de escondidos num default de biblioteca.
 *
 * N=2^16, r=8, p=1 gasta ~64 MB e algumas centenas de milissegundos por
 * tentativa — irrelevante num login por dia, caro o suficiente para inviabilizar
 * força bruta em cima de um dump do banco.
 */
const CUSTO_N = 65536
const BLOCO_R = 8
const PARALELISMO_P = 1
const TAMANHO_CHAVE = 64
/** scrypt precisa de ~128 × N × r bytes; o default do Node (32 MB) não cabe. */
const MEMORIA_MAXIMA = 160 * 1024 * 1024

/**
 * Os parâmetros viajam dentro do hash. Quando o custo subir, senha antiga
 * continua conferindo com os números com que foi criada e só é reescrita na
 * próxima troca — sem migração em massa.
 */
const PREFIXO = 'scrypt'

async function derivar(
  senha: string,
  sal: Buffer,
  n: number,
  r: number,
  p: number,
  tamanho: number,
): Promise<Buffer> {
  return derivarChave(senha.normalize('NFKC'), sal, tamanho, {
    N: n,
    r,
    p,
    maxmem: MEMORIA_MAXIMA,
  })
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16)
  const chave = await derivar(senha, sal, CUSTO_N, BLOCO_R, PARALELISMO_P, TAMANHO_CHAVE)
  return [
    PREFIXO,
    CUSTO_N,
    BLOCO_R,
    PARALELISMO_P,
    sal.toString('base64'),
    chave.toString('base64'),
  ].join('$')
}

/**
 * Confere a senha em tempo constante. Hash malformado devolve `false` em vez de
 * estourar: um registro corrompido não deve virar erro 500 na tela de login.
 */
export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  const partes = hash.split('$')
  if (partes.length !== 6 || partes[0] !== PREFIXO) return false

  const [, nBruto, rBruto, pBruto, salBase64, chaveBase64] = partes
  const n = Number(nBruto)
  const r = Number(rBruto)
  const p = Number(pBruto)
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  const sal = Buffer.from(salBase64, 'base64')
  const esperada = Buffer.from(chaveBase64, 'base64')
  if (sal.length === 0 || esperada.length === 0) return false

  try {
    const obtida = await derivar(senha, sal, n, r, p, esperada.length)
    return timingSafeEqual(obtida, esperada)
  } catch {
    return false
  }
}

/**
 * Hash descartável, usado para gastar o mesmo tempo de CPU quando o e-mail não
 * existe. Sem isso o tempo de resposta do login diz quais e-mails estão
 * cadastrados.
 */
export const HASH_FALSO = [
  PREFIXO,
  CUSTO_N,
  BLOCO_R,
  PARALELISMO_P,
  Buffer.alloc(16, 7).toString('base64'),
  Buffer.alloc(TAMANHO_CHAVE, 11).toString('base64'),
].join('$')
