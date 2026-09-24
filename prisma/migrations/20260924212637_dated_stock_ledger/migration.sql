-- Dated stock ledger.
--
-- `available` becomes `onHand`: it now means what is physically in the building,
-- because scheduling an order records demand against its production day instead
-- of deducting here.
--
-- `capacity` is dropped. It only existed because orders were eating `available`,
-- so the total ever brought in had to be tracked separately. With orders no
-- longer deducting, the two columns hold the same number, and "committed" is
-- derived from live orders' demand instead of from the gap between them.
--
-- Existing rows carry `capacity` forward as the new `onHand`, not `available`:
-- capacity was the true amount in the pool, whereas `available` had already had
-- every scheduled order subtracted from it.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_stock_levels" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ingredientId" INTEGER NOT NULL,
    "onHand" REAL NOT NULL,
    CONSTRAINT "stock_levels_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_stock_levels" ("id", "ingredientId", "onHand")
SELECT "id", "ingredientId", "capacity" FROM "stock_levels";

DROP TABLE "stock_levels";
ALTER TABLE "new_stock_levels" RENAME TO "stock_levels";
CREATE UNIQUE INDEX "stock_levels_ingredientId_key" ON "stock_levels"("ingredientId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
