-- AlterTable
ALTER TABLE "calendar_settings" ADD COLUMN     "deliveryMaxMiles" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "deliveryMinimumOrder" INTEGER NOT NULL DEFAULT 20000,
ADD COLUMN     "deliveryPerMile" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "loanReturnDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "shopEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "shopOpeningHours" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "weddingBalanceDueDaysBefore" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "weddingQuoteTurnaround" TEXT NOT NULL DEFAULT '2-3 days',
ALTER COLUMN "weddingDepositPercent" SET DEFAULT 50;

-- AlterTable
ALTER TABLE "equipment_loans" ADD COLUMN     "depositAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositRefundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "wedding_packages" ADD COLUMN     "dimensions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "serves" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "stencilOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "wedding_extras" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "unitPrice" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "bulkFrom" INTEGER,
    "bulkDiscountPercent" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wedding_extras_pkey" PRIMARY KEY ("id")
);
