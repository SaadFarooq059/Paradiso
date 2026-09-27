-- AlterTable
ALTER TABLE "calendar_settings" ADD COLUMN     "weddingCapacityStage" "WeddingCapacityStage" NOT NULL DEFAULT 'At deposit',
ADD COLUMN     "weddingDepositPercent" INTEGER NOT NULL DEFAULT 25;
