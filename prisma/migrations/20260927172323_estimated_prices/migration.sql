-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "priceEstimated" BOOLEAN NOT NULL DEFAULT false;

-- The two larger sizes get an estimated price instead of none.
--
-- They were left unpriced because the client publishes only the Mini-misu
-- figures, but an unpriced product cannot be ordered, which left two thirds of
-- the range unsellable and looking broken rather than provisional. Each of these
-- is extrapolated from the client's own published prices — servings x £3.75,
-- plus the published flat premiums of £3.00 for a flavour and £15.00 for vegan
-- or gluten-free — and carries "priceEstimated", which every screen showing a
-- price turns into a visible "estimated, pending confirmation".
--
-- The rule reproduces all three published Mini figures exactly, so nothing here
-- contradicts what the client has actually said.
UPDATE "product_variants" SET "priceAmount" = 1500, "priceEstimated" = false WHERE "id" = 'mini-classico';
UPDATE "product_variants" SET "priceAmount" = 1800, "priceEstimated" = false WHERE "id" = 'mini-biscoff';
UPDATE "product_variants" SET "priceAmount" = 1800, "priceEstimated" = false WHERE "id" = 'mini-pistacchio-nutella';
UPDATE "product_variants" SET "priceAmount" = 1800, "priceEstimated" = false WHERE "id" = 'mini-oreo-white-chocolate';
UPDATE "product_variants" SET "priceAmount" = 3000, "priceEstimated" = false WHERE "id" = 'mini-vegan-classico';
UPDATE "product_variants" SET "priceAmount" = 3000, "priceEstimated" = false WHERE "id" = 'mini-gf-classico';
UPDATE "product_variants" SET "priceAmount" = 3375, "priceEstimated" = true WHERE "id" = 'grande-classico';
UPDATE "product_variants" SET "priceAmount" = 3675, "priceEstimated" = true WHERE "id" = 'grande-biscoff';
UPDATE "product_variants" SET "priceAmount" = 3675, "priceEstimated" = true WHERE "id" = 'grande-pistacchio-nutella';
UPDATE "product_variants" SET "priceAmount" = 3675, "priceEstimated" = true WHERE "id" = 'grande-oreo-white-chocolate';
UPDATE "product_variants" SET "priceAmount" = 4875, "priceEstimated" = true WHERE "id" = 'grande-vegan-classico';
UPDATE "product_variants" SET "priceAmount" = 4875, "priceEstimated" = true WHERE "id" = 'grande-gf-classico';
UPDATE "product_variants" SET "priceAmount" = 8250, "priceEstimated" = true WHERE "id" = 'suprema-classico';
UPDATE "product_variants" SET "priceAmount" = 8550, "priceEstimated" = true WHERE "id" = 'suprema-biscoff';
UPDATE "product_variants" SET "priceAmount" = 8550, "priceEstimated" = true WHERE "id" = 'suprema-pistacchio-nutella';
UPDATE "product_variants" SET "priceAmount" = 8550, "priceEstimated" = true WHERE "id" = 'suprema-oreo-white-chocolate';
UPDATE "product_variants" SET "priceAmount" = 9750, "priceEstimated" = true WHERE "id" = 'suprema-vegan-classico';
UPDATE "product_variants" SET "priceAmount" = 9750, "priceEstimated" = true WHERE "id" = 'suprema-gf-classico';

-- Remove three orders that were our own probes against the live database, not
-- the shop's history.
--
-- Each was created before any product had a price, so each shows a £0.00 total
-- on screen. They are not backfilled: an order's total is frozen when it is
-- agreed, and restating it afterwards would rewrite a financial record. These
-- particular rows have no customer attached, no payment events and no messages,
-- which is what marks them as artifacts rather than orders anyone placed.
--
-- Named by id so this can never widen to something real. Priya Raman's order is
-- deliberately left alone: it carries a payment and a partial refund, and is the
-- one that demonstrates a genuine state. Children (items, status events, payment
-- events, messages, production assignments) all cascade.
DELETE FROM "orders" WHERE "id" IN (
  'f80e3ca8-f163-4d96-b1be-365ecdd8724f',  -- mini-classico x2, Scheduled
  '6d3ebad9-5283-442b-89db-ce6343ecfb8f',  -- grande-classico x1, Ready for collection
  '100dea6e-7434-4737-a76d-8fb5fdcb6b7a'   -- suprema-classico x2, Collected or delivered
);
