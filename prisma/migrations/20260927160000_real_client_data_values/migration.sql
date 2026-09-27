-- The client's real data, for databases that already have rows.
--
-- Production carries the placeholder range, prices and wedding figures, and the
-- seed does not run on a database that already has rows. So the real values
-- arrive here.
--
-- Deliberately non-destructive about identity: mini-classico, grande-classico
-- and suprema-classico keep their ids, because live orders reference them. They
-- are updated in place; the other fifteen products are new. Old wedding
-- packages are deactivated rather than deleted, because existing quotes point at
-- them and "what did we agree" must survive.
--
-- "unitsPerBatch" is set on insert but deliberately NOT overwritten on conflict.
-- Batch yields are still the client's unknown, and the placeholder is editable in
-- Products & Recipes — if the kitchen has since entered a real number on live,
-- this migration must not throw it away.

-- The shop's own details, and the client's wedding terms.
UPDATE "calendar_settings" SET
  "shopName" = 'Paradiso Authentic Italian',
  "shopAddress" = '345 Sharrow Vale Road, Sheffield, S11 8ZG',
  "shopPhone" = '01143215027',
  "shopEmail" = 'info@paradisoauthenticitalian.com',
  "shopOpeningHours" = 'Monday closed · Tuesday to Saturday 10:00–17:00 · Sunday 10:00–16:00',
  "earliestCollectionTime" = '10:00',
  "blockedWeekdays" = ARRAY[1],
  "weddingDepositPercent" = 50,
  "weddingBalanceDueDaysBefore" = 14,
  "weddingQuoteTurnaround" = '2-3 days',
  "deliveryPerMile" = 300,
  "deliveryMaxMiles" = 50,
  "deliveryMinimumOrder" = 20000,
  "loanReturnDays" = 7
WHERE "id" = 1;

-- The range: three sizes across six flavours.
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('mini-classico', 'Mini-misu Classico', '6″. Coffee-soaked savoiardi, mascarpone cream, dusted with cocoa.', 'Serves ~4', false, 0, 2, 8, 1500)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('mini-biscoff', 'Mini-misu Biscoff', '6″. Biscoff biscuit and caramelised spread, no coffee.', 'Serves ~4', false, 1, 2, 8, 1800)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('mini-pistacchio-nutella', 'Mini-misu Pistacchio & Nutella', '6″. Pistachio cream layered with Nutella, no coffee.', 'Serves ~4', false, 2, 2, 8, 1800)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('mini-oreo-white-chocolate', 'Mini-misu Oreo & White Chocolate', '6″. Crushed Oreo and white chocolate, no coffee.', 'Serves ~4', false, 3, 2, 8, 1800)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('mini-vegan-classico', 'Mini-misu Vegan Classico', '6″. The Classico, made without dairy or egg.', 'Serves ~4', false, 4, 2, 8, 3000)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('mini-gf-classico', 'Mini-misu GF Classico', '6″. The Classico, made with gluten-free savoiardi.', 'Serves ~4', false, 5, 2, 8, 3000)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('grande-classico', 'Grande-misu Classico', '8″. Coffee-soaked savoiardi, mascarpone cream, dusted with cocoa.', 'Serves ~9', false, 6, 2, 4, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('grande-biscoff', 'Grande-misu Biscoff', '8″. Biscoff biscuit and caramelised spread, no coffee.', 'Serves ~9', false, 7, 2, 4, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('grande-pistacchio-nutella', 'Grande-misu Pistacchio & Nutella', '8″. Pistachio cream layered with Nutella, no coffee.', 'Serves ~9', false, 8, 2, 4, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('grande-oreo-white-chocolate', 'Grande-misu Oreo & White Chocolate', '8″. Crushed Oreo and white chocolate, no coffee.', 'Serves ~9', false, 9, 2, 4, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('grande-vegan-classico', 'Grande-misu Vegan Classico', '8″. The Classico, made without dairy or egg.', 'Serves ~9', false, 10, 2, 4, 3000)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('grande-gf-classico', 'Grande-misu GF Classico', '8″. The Classico, made with gluten-free savoiardi.', 'Serves ~9', false, 11, 2, 4, 3000)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('suprema-classico', 'Suprema-misu Classico', '12″. Coffee-soaked savoiardi, mascarpone cream, dusted with cocoa.', 'Serves ~20–25', false, 12, 4, 2, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('suprema-biscoff', 'Suprema-misu Biscoff', '12″. Biscoff biscuit and caramelised spread, no coffee.', 'Serves ~20–25', false, 13, 4, 2, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('suprema-pistacchio-nutella', 'Suprema-misu Pistacchio & Nutella', '12″. Pistachio cream layered with Nutella, no coffee.', 'Serves ~20–25', false, 14, 4, 2, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('suprema-oreo-white-chocolate', 'Suprema-misu Oreo & White Chocolate', '12″. Crushed Oreo and white chocolate, no coffee.', 'Serves ~20–25', false, 15, 4, 2, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('suprema-vegan-classico', 'Suprema-misu Vegan Classico', '12″. The Classico, made without dairy or egg.', 'Serves ~20–25', false, 16, 4, 2, 3000)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('suprema-gf-classico', 'Suprema-misu GF Classico', '12″. The Classico, made with gluten-free savoiardi.', 'Serves ~20–25', false, 17, 4, 2, 3000)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "servings" = EXCLUDED."servings", "sortOrder" = EXCLUDED."sortOrder",
  "leadTimeDays" = EXCLUDED."leadTimeDays", "priceAmount" = EXCLUDED."priceAmount",
  "archived" = false;

-- Recipes are rewritten wholesale for these products, so the coffee rule holds:
-- Classico (including Vegan and GF Classico) has coffee; nothing else does.
DELETE FROM "recipe_items" WHERE "variantId" IN ('mini-classico', 'mini-biscoff', 'mini-pistacchio-nutella', 'mini-oreo-white-chocolate', 'mini-vegan-classico', 'mini-gf-classico', 'grande-classico', 'grande-biscoff', 'grande-pistacchio-nutella', 'grande-oreo-white-chocolate', 'grande-vegan-classico', 'grande-gf-classico', 'suprema-classico', 'suprema-biscoff', 'suprema-pistacchio-nutella', 'suprema-oreo-white-chocolate', 'suprema-vegan-classico', 'suprema-gf-classico');
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-classico', "id", 2 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-classico', "id", 150 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-classico', "id", 100 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-classico', "id", 50 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-biscoff', "id", 2 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-biscoff', "id", 150 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-biscoff', "id", 100 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-pistacchio-nutella', "id", 2 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-pistacchio-nutella', "id", 150 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-pistacchio-nutella', "id", 100 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-oreo-white-chocolate', "id", 2 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-oreo-white-chocolate', "id", 150 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-oreo-white-chocolate', "id", 100 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-vegan-classico', "id", 2 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-vegan-classico', "id", 150 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-vegan-classico', "id", 100 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-vegan-classico', "id", 50 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-gf-classico', "id", 2 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-gf-classico', "id", 150 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-gf-classico', "id", 100 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-gf-classico', "id", 50 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-classico', "id", 4 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-classico', "id", 300 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-classico', "id", 200 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-classico', "id", 100 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-biscoff', "id", 4 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-biscoff', "id", 300 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-biscoff', "id", 200 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-pistacchio-nutella', "id", 4 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-pistacchio-nutella', "id", 300 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-pistacchio-nutella', "id", 200 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-oreo-white-chocolate', "id", 4 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-oreo-white-chocolate', "id", 300 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-oreo-white-chocolate', "id", 200 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-vegan-classico', "id", 4 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-vegan-classico', "id", 300 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-vegan-classico', "id", 200 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-vegan-classico', "id", 100 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-gf-classico', "id", 4 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-gf-classico', "id", 300 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-gf-classico', "id", 200 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-gf-classico', "id", 100 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 10 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 750 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 500 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 250 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 100 FROM "ingredients" WHERE "key" = 'butter';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-biscoff', "id", 10 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-biscoff', "id", 750 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-biscoff', "id", 500 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-biscoff', "id", 100 FROM "ingredients" WHERE "key" = 'butter';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-pistacchio-nutella', "id", 10 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-pistacchio-nutella', "id", 750 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-pistacchio-nutella', "id", 500 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-pistacchio-nutella', "id", 100 FROM "ingredients" WHERE "key" = 'butter';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-oreo-white-chocolate', "id", 10 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-oreo-white-chocolate', "id", 750 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-oreo-white-chocolate', "id", 500 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-oreo-white-chocolate', "id", 100 FROM "ingredients" WHERE "key" = 'butter';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-vegan-classico', "id", 10 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-vegan-classico', "id", 750 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-vegan-classico', "id", 500 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-vegan-classico', "id", 250 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-vegan-classico', "id", 100 FROM "ingredients" WHERE "key" = 'butter';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-gf-classico', "id", 10 FROM "ingredients" WHERE "key" = 'eggs';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-gf-classico', "id", 750 FROM "ingredients" WHERE "key" = 'mascarpone';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-gf-classico', "id", 500 FROM "ingredients" WHERE "key" = 'savoiardi';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-gf-classico', "id", 250 FROM "ingredients" WHERE "key" = 'coffee';
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-gf-classico', "id", 100 FROM "ingredients" WHERE "key" = 'butter';

-- Old placeholder packages stay on the books but stop being offered.
UPDATE "wedding_packages" SET "active" = false
 WHERE "id" IN ('classico-tier', 'celebration', 'grand-affair');

INSERT INTO "wedding_packages" ("id","name","description","basePrice","includes","serves","dimensions","stencilOptions","active","sortOrder")
VALUES ('four-tier-cake', 'Four-tier cake', 'The full tiered centrepiece.', 39000, ARRAY['Four tiers', 'Serves up to 83', 'Cake stand on loan (deposit refundable)'], 'Up to 83', '', ARRAY[]::text[], true, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "basePrice" = EXCLUDED."basePrice", "includes" = EXCLUDED."includes",
  "serves" = EXCLUDED."serves", "dimensions" = EXCLUDED."dimensions",
  "stencilOptions" = EXCLUDED."stencilOptions", "active" = true, "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "wedding_packages" ("id","name","description","basePrice","includes","serves","dimensions","stencilOptions","active","sortOrder")
VALUES ('classico-tray', 'Classico tray with stencil', 'A single large tray, finished with a stencilled message.', 15500, ARRAY['32 x 52cm tray', 'Serves approx. 40', 'Stencilled message', 'Tray on loan (deposit refundable)'], 'Approx. 40', '32 x 52cm', ARRAY['Just married', 'Happy birthday', 'Just graduated'], true, 1)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "basePrice" = EXCLUDED."basePrice", "includes" = EXCLUDED."includes",
  "serves" = EXCLUDED."serves", "dimensions" = EXCLUDED."dimensions",
  "stencilOptions" = EXCLUDED."stencilOptions", "active" = true, "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "wedding_packages" ("id","name","description","basePrice","includes","serves","dimensions","stencilOptions","active","sortOrder")
VALUES ('classico-glass-dish', 'Classico glass dish with stencil', 'A glass dish, stencilled — the smaller of the two trays.', 5000, ARRAY['39 x 27cm glass dish', 'Serves approx. 20', 'Stencilled message', 'Dish on loan (deposit refundable)'], 'Approx. 20', '39 x 27cm', ARRAY['Just married', 'Happy birthday', 'Just graduated'], true, 2)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "basePrice" = EXCLUDED."basePrice", "includes" = EXCLUDED."includes",
  "serves" = EXCLUDED."serves", "dimensions" = EXCLUDED."dimensions",
  "stencilOptions" = EXCLUDED."stencilOptions", "active" = true, "sortOrder" = EXCLUDED."sortOrder";

-- The priced extras.
INSERT INTO "wedding_extras" ("id","name","description","unitPrice","unit","bulkFrom","bulkDiscountPercent","active","sortOrder")
VALUES ('pot-8oz', '8oz pot', 'Individual portion.', 600, 'each', NULL, NULL, true, 0)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "unitPrice" = EXCLUDED."unitPrice", "unit" = EXCLUDED."unit",
  "bulkFrom" = EXCLUDED."bulkFrom", "bulkDiscountPercent" = EXCLUDED."bulkDiscountPercent",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "wedding_extras" ("id","name","description","unitPrice","unit","bulkFrom","bulkDiscountPercent","active","sortOrder")
VALUES ('cannoli-maxi', 'Maxi cannoli', '10% off from 30 cannoli.', 400, 'each', 30, 10, true, 1)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "unitPrice" = EXCLUDED."unitPrice", "unit" = EXCLUDED."unit",
  "bulkFrom" = EXCLUDED."bulkFrom", "bulkDiscountPercent" = EXCLUDED."bulkDiscountPercent",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "wedding_extras" ("id","name","description","unitPrice","unit","bulkFrom","bulkDiscountPercent","active","sortOrder")
VALUES ('cannoli-mini', 'Mini cannoli', '10% off from 30 cannoli.', 250, 'each', 30, 10, true, 2)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "unitPrice" = EXCLUDED."unitPrice", "unit" = EXCLUDED."unit",
  "bulkFrom" = EXCLUDED."bulkFrom", "bulkDiscountPercent" = EXCLUDED."bulkDiscountPercent",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "wedding_extras" ("id","name","description","unitPrice","unit","bulkFrom","bulkDiscountPercent","active","sortOrder")
VALUES ('delivery', 'Delivery', 'Up to 50 miles, minimum order £200. Collection is free.', 300, 'per mile', NULL, NULL, true, 3)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "unitPrice" = EXCLUDED."unitPrice", "unit" = EXCLUDED."unit",
  "bulkFrom" = EXCLUDED."bulkFrom", "bulkDiscountPercent" = EXCLUDED."bulkDiscountPercent",
  "active" = true, "sortOrder" = EXCLUDED."sortOrder";
