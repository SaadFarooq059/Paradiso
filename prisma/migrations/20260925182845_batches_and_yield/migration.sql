-- Batches and yield.
--
-- Recipes stop being per-unit and become per-batch. The stored numbers do not
-- change — their meaning does. A Suprema batch has always drawn 6 eggs; what
-- changes is that the batch is now understood to yield 2 cakes rather than being
-- assumed to yield exactly the one that was ordered. So `amountPerUnit` is
-- renamed to `amountPerBatch` with its values carried straight across.
--
-- unitsPerBatch is seeded per variant below (Suprema 2, Grande 4, Mini 8); any
-- other variant falls back to 1, which reproduces the old per-unit behaviour
-- exactly and so cannot silently change an existing recipe's draw.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- product_variants: add unitsPerBatch
CREATE TABLE "new_product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "servings" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 2,
    "unitsPerBatch" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_product_variants" ("id", "name", "description", "servings", "archived", "sortOrder", "leadTimeDays", "unitsPerBatch")
SELECT "id", "name", "description", "servings", "archived", "sortOrder", "leadTimeDays",
       CASE "id"
         WHEN 'suprema-classico' THEN 2
         WHEN 'grande-classico'  THEN 4
         WHEN 'mini-classico'    THEN 8
         ELSE 1
       END
FROM "product_variants";
DROP TABLE "product_variants";
ALTER TABLE "new_product_variants" RENAME TO "product_variants";

-- recipe_items: amountPerUnit -> amountPerBatch
CREATE TABLE "new_recipe_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "variantId" TEXT NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "amountPerBatch" REAL NOT NULL,
    CONSTRAINT "recipe_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recipe_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_recipe_items" ("id", "variantId", "ingredientId", "amountPerBatch")
SELECT "id", "variantId", "ingredientId", "amountPerUnit" FROM "recipe_items";
DROP TABLE "recipe_items";
ALTER TABLE "new_recipe_items" RENAME TO "recipe_items";
CREATE UNIQUE INDEX "recipe_items_variantId_ingredientId_key" ON "recipe_items"("variantId", "ingredientId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
