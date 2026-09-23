-- AlterTable
ALTER TABLE "abastecimento" ADD COLUMN     "numeroNota" TEXT,
ALTER COLUMN "odometro" DROP NOT NULL;

-- AlterTable
ALTER TABLE "frete" ADD COLUMN     "canceladoComViagem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "viagem" ADD COLUMN     "excluidaEm" TIMESTAMP(3),
ADD COLUMN     "excluidaPor" TEXT,
ADD COLUMN     "motivoExclusao" TEXT;

-- ---------------------------------------------------------------------------
-- Abastecimento sai de dentro da viagem
-- ---------------------------------------------------------------------------
-- Um tanque cheio atende várias viagens, então amarrar o abastecimento a uma
-- delas sempre errava: o diesel inteiro caía na primeira viagem que o motorista
-- anotou. A partir daqui o abastecimento é custo do caminhão no mês, valor
-- exato e sem rateio.
--
-- Os lançamentos já existentes precisam ser convertidos ANTES de a tela perder
-- o campo, senão ficam pendurados numa viagem que ninguém mais consegue editar.
-- O `veiculoId` já está gravado em todos eles — é o que sustenta a conversão
-- sem perder de quem é o custo.

UPDATE "lancamento" AS l
SET "viagemId" = NULL,
    "observacoes" = COALESCE(NULLIF(l."observacoes", '') || ' · ', '')
      || 'Convertido em custo do caminhão: abastecimento deixou de pertencer a uma viagem.'
FROM "abastecimento" AS a
WHERE a."lancamentoId" = l."id"
  AND l."viagemId" IS NOT NULL;

UPDATE "abastecimento" SET "viagemId" = NULL WHERE "viagemId" IS NOT NULL;
