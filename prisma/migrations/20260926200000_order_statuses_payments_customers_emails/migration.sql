-- Order statuses extended to the client's list, plus payment, customers and
-- rendered customer emails.
--
-- The OrderStatus enum is swapped wholesale rather than altered in place.
-- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block, and two of
-- the existing labels are being renamed, not dropped: 'Ready' becomes 'Ready for
-- collection' and 'Completed' becomes 'Collected or delivered'. Rebuilding the
-- type and converting the columns with an explicit CASE keeps every existing row
-- and runs as one transaction, so a failure leaves nothing half-applied.

-- AlterEnum: rebuild OrderStatus, preserving existing rows
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM (
  'Confirmed',
  'Scheduled',
  'In Production',
  'Ready for collection',
  'Collected or delivered',
  'Details require clarification',
  'On Hold',
  'Cancelled'
);

ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'Ready'     THEN 'Ready for collection'
      WHEN 'Completed' THEN 'Collected or delivered'
      ELSE "status"::text
    END
  )::"OrderStatus";

ALTER TABLE "order_status_events"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'Ready'     THEN 'Ready for collection'
      WHEN 'Completed' THEN 'Collected or delivered'
      ELSE "status"::text
    END
  )::"OrderStatus";

DROP TYPE "OrderStatus_old";

-- CreateEnum
CREATE TYPE "PaymentEventKind" AS ENUM ('Payment', 'Refund');

-- CreateEnum
CREATE TYPE "EmailTemplate" AS ENUM ('Confirmation', 'Reminder', 'Ready for collection', 'Follow-up');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('Ready to send', 'Pending', 'Suppressed');

-- AlterTable: placeholder prices, in pence
ALTER TABLE "product_variants" ADD COLUMN "priceAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: shop identity for the email templates
ALTER TABLE "calendar_settings" ADD COLUMN "shopName" TEXT NOT NULL DEFAULT 'Paradiso';
ALTER TABLE "calendar_settings" ADD COLUMN "shopAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "calendar_settings" ADD COLUMN "shopPhone" TEXT NOT NULL DEFAULT '';

-- AlterTable: money and customer on the order
ALTER TABLE "orders" ADD COLUMN "totalAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "amountPaid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "amountRefunded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "customerId" TEXT;

-- AlterTable: who made the status change
ALTER TABLE "order_status_events" ADD COLUMN "actorId" TEXT;

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "PaymentEventKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "note" TEXT,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "template" "EmailTemplate" NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "toName" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "renderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendAfter" TIMESTAMP(3),
    "suppressedReason" TEXT,
    "triggeredByEventId" INTEGER,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");
CREATE INDEX "payment_events_orderId_idx" ON "payment_events"("orderId");
CREATE INDEX "email_messages_orderId_idx" ON "email_messages"("orderId");
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
