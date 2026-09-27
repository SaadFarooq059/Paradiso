-- CreateEnum
CREATE TYPE "WeddingStage" AS ENUM ('Enquiry', 'Quoted', 'Deposit paid', 'Confirmed', 'In production', 'Delivered or collected', 'Completed', 'Cancelled', 'Lost');

-- CreateEnum
CREATE TYPE "WeddingCapacityStage" AS ENUM ('At quote', 'At deposit', 'At final confirmation');

-- AlterTable
ALTER TABLE "payment_events" ADD COLUMN     "weddingId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "wedding_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "includes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wedding_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weddings" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "stage" "WeddingStage" NOT NULL DEFAULT 'Enquiry',
    "customerId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "flavourNotes" TEXT NOT NULL DEFAULT '',
    "dietaryRequirements" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "staffRequired" INTEGER NOT NULL DEFAULT 0,
    "driversRequired" INTEGER NOT NULL DEFAULT 0,
    "currentQuoteId" TEXT,
    "capacityBookedAt" TIMESTAMP(3),
    "balanceDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_quotes" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "packageId" TEXT,
    "basePrice" INTEGER NOT NULL,
    "adjustments" JSONB NOT NULL DEFAULT '[]',
    "total" INTEGER NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "wedding_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_quote_tiers" (
    "id" SERIAL NOT NULL,
    "quoteId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "wedding_quote_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_loans" (
    "id" SERIAL NOT NULL,
    "weddingId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "outAt" TIMESTAMP(3),
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "returnedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "equipment_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_stage_events" (
    "id" SERIAL NOT NULL,
    "weddingId" TEXT NOT NULL,
    "stage" "WeddingStage" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "actorId" TEXT,

    CONSTRAINT "wedding_stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weddings_reference_key" ON "weddings"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "weddings_currentQuoteId_key" ON "weddings"("currentQuoteId");

-- CreateIndex
CREATE INDEX "weddings_customerId_idx" ON "weddings"("customerId");

-- CreateIndex
CREATE INDEX "weddings_eventDate_idx" ON "weddings"("eventDate");

-- CreateIndex
CREATE INDEX "wedding_quotes_weddingId_idx" ON "wedding_quotes"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "wedding_quotes_weddingId_version_key" ON "wedding_quotes"("weddingId", "version");

-- CreateIndex
CREATE INDEX "wedding_quote_tiers_quoteId_idx" ON "wedding_quote_tiers"("quoteId");

-- CreateIndex
CREATE INDEX "equipment_loans_weddingId_idx" ON "equipment_loans"("weddingId");

-- CreateIndex
CREATE INDEX "wedding_stage_events_weddingId_idx" ON "wedding_stage_events"("weddingId");

-- CreateIndex
CREATE INDEX "payment_events_weddingId_idx" ON "payment_events"("weddingId");

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_currentQuoteId_fkey" FOREIGN KEY ("currentQuoteId") REFERENCES "wedding_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_quotes" ADD CONSTRAINT "wedding_quotes_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_quotes" ADD CONSTRAINT "wedding_quotes_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "wedding_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_quotes" ADD CONSTRAINT "wedding_quotes_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_quote_tiers" ADD CONSTRAINT "wedding_quote_tiers_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "wedding_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_quote_tiers" ADD CONSTRAINT "wedding_quote_tiers_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_stage_events" ADD CONSTRAINT "wedding_stage_events_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_stage_events" ADD CONSTRAINT "wedding_stage_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exactly one subject per ledger entry.
--
-- The schema allows both orderId and weddingId to be null, or both to be set;
-- neither is a real payment. Enforced in the database rather than by convention,
-- because a ledger that can hold an entry belonging to nothing is a ledger that
-- will not reconcile, and the application is not the only thing that writes here.
ALTER TABLE "payment_events"
  ADD CONSTRAINT "payment_events_one_subject"
  CHECK (("orderId" IS NOT NULL) <> ("weddingId" IS NOT NULL));
