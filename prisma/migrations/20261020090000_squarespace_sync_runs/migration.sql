-- Squarespace sync runs: a log of each import run, so staff can see when the
-- shop was last checked and whether it worked. Purely additive.

-- CreateTable
CREATE TABLE "squarespace_sync_runs" (
    "id" SERIAL NOT NULL,
    "trigger" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "ordersSeen" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "cancelled" INTEGER NOT NULL DEFAULT 0,
    "flagged" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "squarespace_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "squarespace_sync_runs_startedAt_idx" ON "squarespace_sync_runs"("startedAt");
