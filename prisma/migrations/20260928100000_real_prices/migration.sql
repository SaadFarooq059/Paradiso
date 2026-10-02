-- The client's own prices replace the extrapolated ones.
--
-- Classico and the three flavoured variants now have published figures at every
-- size, and they do not follow the servings x £3.75 rule the previous migration
-- extrapolated from: Grande is £30 and Suprema £40 for Classico, with a flat
-- £3.00 premium for any other flavour. Those twelve are no longer estimates.
--
-- Vegan and gluten-free have no published figure at any size. The £30 the
-- previous migration read as a flat vegan price was the Grande Classico price,
-- so their £15.00 premium had no basis. They now take the same £3.00 premium as
-- any non-Classico flavour, the only premium there is evidence for, and stay
-- flagged "priceEstimated".
--
-- Existing orders are untouched: a total is frozen when the order is agreed.
UPDATE "product_variants" SET "priceAmount" = 1500, "priceEstimated" = false WHERE "id" = 'mini-classico';
UPDATE "product_variants" SET "priceAmount" = 1800, "priceEstimated" = false WHERE "id" = 'mini-biscoff';
UPDATE "product_variants" SET "priceAmount" = 1800, "priceEstimated" = false WHERE "id" = 'mini-pistacchio-nutella';
UPDATE "product_variants" SET "priceAmount" = 1800, "priceEstimated" = false WHERE "id" = 'mini-oreo-white-chocolate';
UPDATE "product_variants" SET "priceAmount" = 1800, "priceEstimated" = true  WHERE "id" = 'mini-vegan-classico';
UPDATE "product_variants" SET "priceAmount" = 1800, "priceEstimated" = true  WHERE "id" = 'mini-gf-classico';
UPDATE "product_variants" SET "priceAmount" = 3000, "priceEstimated" = false WHERE "id" = 'grande-classico';
UPDATE "product_variants" SET "priceAmount" = 3300, "priceEstimated" = false WHERE "id" = 'grande-biscoff';
UPDATE "product_variants" SET "priceAmount" = 3300, "priceEstimated" = false WHERE "id" = 'grande-pistacchio-nutella';
UPDATE "product_variants" SET "priceAmount" = 3300, "priceEstimated" = false WHERE "id" = 'grande-oreo-white-chocolate';
UPDATE "product_variants" SET "priceAmount" = 3300, "priceEstimated" = true  WHERE "id" = 'grande-vegan-classico';
UPDATE "product_variants" SET "priceAmount" = 3300, "priceEstimated" = true  WHERE "id" = 'grande-gf-classico';
UPDATE "product_variants" SET "priceAmount" = 4000, "priceEstimated" = false WHERE "id" = 'suprema-classico';
UPDATE "product_variants" SET "priceAmount" = 4300, "priceEstimated" = false WHERE "id" = 'suprema-biscoff';
UPDATE "product_variants" SET "priceAmount" = 4300, "priceEstimated" = false WHERE "id" = 'suprema-pistacchio-nutella';
UPDATE "product_variants" SET "priceAmount" = 4300, "priceEstimated" = false WHERE "id" = 'suprema-oreo-white-chocolate';
UPDATE "product_variants" SET "priceAmount" = 4300, "priceEstimated" = true  WHERE "id" = 'suprema-vegan-classico';
UPDATE "product_variants" SET "priceAmount" = 4300, "priceEstimated" = true  WHERE "id" = 'suprema-gf-classico';

-- Every product is two days. The client says the four-day product is
-- Number-misu, which is not in this range; Suprema's four days were our guess.
UPDATE "product_variants" SET "leadTimeDays" = 2 WHERE "id" LIKE 'suprema-%';
