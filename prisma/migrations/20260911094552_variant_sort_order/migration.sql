-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "servings" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_product_variants" ("archived", "description", "id", "name", "servings") SELECT "archived", "description", "id", "name", "servings" FROM "product_variants";
DROP TABLE "product_variants";
ALTER TABLE "new_product_variants" RENAME TO "product_variants";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
