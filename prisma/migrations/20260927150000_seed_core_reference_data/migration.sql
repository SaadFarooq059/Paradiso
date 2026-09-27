-- The core reference data, for databases built from migrations alone.
--
-- Found by the new reference-data check, which runs migrations into an empty
-- database and asks whether the app could actually work. It could not:
-- ingredients, product_variants and calendar_settings were all empty. Production
-- only works today because it was seeded by hand once, before the seed guard
-- existed — provision a fresh database from these migrations and you get a shop
-- with no recipes, no ingredients and no opening rules.
--
-- This is the same fault as the placeholder prices and the empty wedding
-- packages, found twice before by a customer-facing wrong number. Every table a
-- migration creates empty is a table the seed will never fill on live.
--
-- Idempotent throughout: ON CONFLICT DO NOTHING, so running it against the
-- already-seeded production database changes nothing.

INSERT INTO "ingredients" ("key","label","unit","sortOrder") VALUES ('eggs', 'Eggs', '', 0) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "ingredients" ("key","label","unit","sortOrder") VALUES ('mascarpone', 'Mascarpone', 'g', 1) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "ingredients" ("key","label","unit","sortOrder") VALUES ('savoiardi', 'Savoiardi', 'g', 2) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "ingredients" ("key","label","unit","sortOrder") VALUES ('coffee', 'Coffee', 'ml', 3) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "ingredients" ("key","label","unit","sortOrder") VALUES ('butter', 'Butter', 'g', 4) ON CONFLICT ("key") DO NOTHING;

-- What is physically in the building, per ingredient.
INSERT INTO "stock_levels" ("ingredientId","onHand")
  SELECT "id", 20 FROM "ingredients" WHERE "key" = 'eggs'
  ON CONFLICT ("ingredientId") DO NOTHING;
INSERT INTO "stock_levels" ("ingredientId","onHand")
  SELECT "id", 2000 FROM "ingredients" WHERE "key" = 'mascarpone'
  ON CONFLICT ("ingredientId") DO NOTHING;
INSERT INTO "stock_levels" ("ingredientId","onHand")
  SELECT "id", 1500 FROM "ingredients" WHERE "key" = 'savoiardi'
  ON CONFLICT ("ingredientId") DO NOTHING;
INSERT INTO "stock_levels" ("ingredientId","onHand")
  SELECT "id", 800 FROM "ingredients" WHERE "key" = 'coffee'
  ON CONFLICT ("ingredientId") DO NOTHING;
INSERT INTO "stock_levels" ("ingredientId","onHand")
  SELECT "id", 500 FROM "ingredients" WHERE "key" = 'butter'
  ON CONFLICT ("ingredientId") DO NOTHING;

-- Recipes. Amounts are per BATCH, and priceAmount is a PLACEHOLDER.
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('mini-classico', 'Mini Classico', 'A single elegant portion, dusted with cocoa.', 'Serves 1', false, 0, 2, 8, 650)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('grande-classico', 'Grande Classico', 'Layered for sharing — our most popular size.', 'Serves 4–6', false, 1, 2, 4, 2800)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "product_variants" ("id","name","description","servings","archived","sortOrder","leadTimeDays","unitsPerBatch","priceAmount")
VALUES ('suprema-classico', 'Suprema Classico', 'Our signature showstopper, finished with coffee beans and mint.', 'Serves 8–10', false, 2, 4, 2, 4500)
ON CONFLICT ("id") DO NOTHING;

-- Recipe lines, joined by key so they survive whatever ids exist.
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-classico', "id", 2 FROM "ingredients" WHERE "key" = 'eggs'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-classico', "id", 150 FROM "ingredients" WHERE "key" = 'mascarpone'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-classico', "id", 100 FROM "ingredients" WHERE "key" = 'savoiardi'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'mini-classico', "id", 50 FROM "ingredients" WHERE "key" = 'coffee'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-classico', "id", 4 FROM "ingredients" WHERE "key" = 'eggs'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-classico', "id", 300 FROM "ingredients" WHERE "key" = 'mascarpone'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-classico', "id", 200 FROM "ingredients" WHERE "key" = 'savoiardi'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'grande-classico', "id", 100 FROM "ingredients" WHERE "key" = 'coffee'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 6 FROM "ingredients" WHERE "key" = 'eggs'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 500 FROM "ingredients" WHERE "key" = 'mascarpone'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 350 FROM "ingredients" WHERE "key" = 'savoiardi'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 150 FROM "ingredients" WHERE "key" = 'coffee'
  ON CONFLICT DO NOTHING;
INSERT INTO "recipe_items" ("variantId","ingredientId","amountPerBatch")
  SELECT 'suprema-classico', "id", 100 FROM "ingredients" WHERE "key" = 'butter'
  ON CONFLICT DO NOTHING;

-- The singleton settings row. Every reader looks it up by id 1.
INSERT INTO "calendar_settings"
  ("id","blockedWeekdays","earliestCollectionTime","maxOrdersPerProductionDay","shopName","shopAddress","shopPhone","weddingCapacityStage","weddingDepositPercent")
VALUES (1, ARRAY[1], '10:30', 20, 'Paradiso', '42 Bermondsey Street, London SE1 3XF', '020 7946 0112', 'At deposit'::"WeddingCapacityStage", 25)
ON CONFLICT ("id") DO NOTHING;
