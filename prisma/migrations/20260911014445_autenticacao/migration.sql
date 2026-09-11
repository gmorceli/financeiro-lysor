-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "bloqueadoAte" TIMESTAMP(3),
ADD COLUMN     "senhaDefinidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tentativasFalhas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trocarSenha" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ultimoAcessoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sessao" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "navegador" TEXT,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessao_tokenHash_key" ON "sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "sessao_usuarioId_idx" ON "sessao"("usuarioId");

-- CreateIndex
CREATE INDEX "sessao_expiraEm_idx" ON "sessao"("expiraEm");

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
