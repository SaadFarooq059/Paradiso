-- Squarespace import (stage 1 of the migration plan).
--
-- Purely additive: every existing order gets source = Portal and no flags, so
-- nothing already in the portal changes meaning. The new table records each
-- Squarespace line item the import has seen, keyed on Squarespace's own id so
-- the import can run repeatedly without duplicating an order.

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('Portal', 'Squarespace');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "externalOrderNumber" TEXT,
ADD COLUMN     "importFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'Portal';

-- CreateTable
CREATE TABLE "squarespace_import_lines" (
    "lineItemId" TEXT NOT NULL,
    "squarespaceOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "options" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "collectionRaw" TEXT,
    "outcome" TEXT NOT NULL,
    "portalOrderId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "squarespace_import_lines_pkey" PRIMARY KEY ("lineItemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "squarespace_import_lines_portalOrderId_key" ON "squarespace_import_lines"("portalOrderId");

-- CreateIndex
CREATE INDEX "squarespace_import_lines_orderNumber_idx" ON "squarespace_import_lines"("orderNumber");

-- CreateIndex
CREATE INDEX "squarespace_import_lines_outcome_idx" ON "squarespace_import_lines"("outcome");

-- AddForeignKey
ALTER TABLE "squarespace_import_lines" ADD CONSTRAINT "squarespace_import_lines_portalOrderId_fkey" FOREIGN KEY ("portalOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
