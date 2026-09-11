/**
 * O nome do cookie mora sozinho num módulo porque o middleware precisa dele e
 * roda no runtime de borda: importar de `sessao.ts` arrastaria o Prisma para
 * dentro do bundle da borda, onde ele não funciona.
 */
export const NOME_COOKIE = 'lysor_sessao'
