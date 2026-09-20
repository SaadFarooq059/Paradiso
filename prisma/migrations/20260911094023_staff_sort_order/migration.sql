-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_staff" ("id", "name", "orderCount", "role") SELECT "id", "name", "orderCount", "role" FROM "staff";
DROP TABLE "staff";
ALTER TABLE "new_staff" RENAME TO "staff";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
