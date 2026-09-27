-- Backfill the placeholder prices and shop details onto an existing database.
--
-- The previous migration adds product_variants."priceAmount" with DEFAULT 0 and
-- calendar_settings' address/phone as empty strings. That is correct for the
-- column definition but wrong as data: a live database that already has rows
-- never runs the seed, so without this every variant stays at £0.00 and every
-- new order totals nothing. Re-seeding is not an option — it is destructive and
-- the database has real rows.
--
-- Written to be idempotent and non-destructive: each statement only touches a
-- row that still holds the default, so re-running changes nothing and a real
-- price entered by hand is never overwritten.

-- Placeholder prices, in pence. Same standing as the batch yields: invented,
-- plausible, and labelled as placeholder in the Recipes screen.
UPDATE "product_variants" SET "priceAmount" = 650  WHERE "id" = 'mini-classico'     AND "priceAmount" = 0;
UPDATE "product_variants" SET "priceAmount" = 2800 WHERE "id" = 'grande-classico'   AND "priceAmount" = 0;
UPDATE "product_variants" SET "priceAmount" = 4500 WHERE "id" = 'suprema-classico'  AND "priceAmount" = 0;

-- Shop identity for the customer email templates. shopName already defaults to
-- 'Paradiso'; these two default to empty, which would render a reminder with no
-- address and no phone number.
UPDATE "calendar_settings"
   SET "shopAddress" = '42 Bermondsey Street, London SE1 3XF'
 WHERE "id" = 1 AND "shopAddress" = '';

UPDATE "calendar_settings"
   SET "shopPhone" = '020 7946 0112'
 WHERE "id" = 1 AND "shopPhone" = '';
