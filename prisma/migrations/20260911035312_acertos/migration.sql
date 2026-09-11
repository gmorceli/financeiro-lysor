/*
  Warnings:

  - Added the required column `periodoFim` to the `acerto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodoInicio` to the `acerto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "NivelCusto" ADD VALUE 'LIQUIDACAO';

-- AlterTable
ALTER TABLE "acerto" ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "periodoFim" DATE NOT NULL,
ADD COLUMN     "periodoInicio" DATE NOT NULL,
ADD COLUMN     "valorComissao" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "valorSalario" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "valorSeguro" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "frete" ADD COLUMN     "acertoMotoristaId" TEXT;

-- AlterTable
ALTER TABLE "lancamento" ADD COLUMN     "acertoId" TEXT;

-- CreateIndex
CREATE INDEX "acerto_motoristaId_periodoInicio_idx" ON "acerto"("motoristaId", "periodoInicio");

-- CreateIndex
CREATE INDEX "acerto_proprietarioId_periodoInicio_idx" ON "acerto"("proprietarioId", "periodoInicio");

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_acertoMotoristaId_fkey" FOREIGN KEY ("acertoMotoristaId") REFERENCES "acerto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_acertoId_fkey" FOREIGN KEY ("acertoId") REFERENCES "acerto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
