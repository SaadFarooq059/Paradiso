// Side-effect import, and it must stay first.
//
// ES imports are hoisted and evaluated in order, so a `loadEnv()` *call* placed
// above the other imports still runs after them — lib/prisma would be evaluated,
// and read DATABASE_URL, before dotenv had put it there. That was invisible while
// lib/prisma fell back to a local SQLite file; with Postgres there is nothing
// sensible to fall back to, so the seed simply failed to connect.
import "dotenv/config"

import { prisma } from "../lib/prisma"
import { seedDatabase } from "../lib/server/seed-data"

/**
 * Seeding is destructive: seedDatabase() clears every table it owns and rewrites
 * it from lib/mock-data.ts. That is exactly right for a brand-new database and
 * exactly wrong for one holding real orders — and this command sits in the deploy
 * notes, where it will eventually be run by someone who has not read them.
 *
 * So it refuses to touch a database that already has anything in it. Overriding
 * is deliberate and loud: `--force`, or FORCE_SEED=true for a non-interactive
 * context like CI.
 *
 * The "Reset demo data" button does NOT come through here — it calls
 * seedDatabase() via the API, where the caller is an authenticated admin who has
 * asked for precisely this. Guarding the script does not disarm the demo.
 */
const OWNED_TABLES = [
  "orders",
  "order_items",
  "order_status_events",
  "production_assignments",
  "restock_entries",
  "stock_levels",
  "recipe_items",
  "ingredients",
  "product_variants",
  "staff",
  "calendar_settings",
] as const

async function countExistingRows(): Promise<{ table: string; rows: number }[]> {
  const counts = await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.orderStatusEvent.count(),
    prisma.productionAssignment.count(),
    prisma.restockEntry.count(),
    prisma.stockLevel.count(),
    prisma.recipeItem.count(),
    prisma.ingredient.count(),
    prisma.productVariant.count(),
    prisma.staff.count(),
    prisma.calendarSettings.count(),
  ])
  return OWNED_TABLES.map((table, index) => ({ table, rows: counts[index] })).filter(
    (entry) => entry.rows > 0
  )
}

function forced(): boolean {
  if (process.argv.includes("--force")) return true
  const flag = process.env.FORCE_SEED?.toLowerCase()
  return flag === "1" || flag === "true" || flag === "yes"
}

async function main() {
  const existing = await countExistingRows()

  if (existing.length > 0 && !forced()) {
    const summary = existing.map((entry) => `${entry.table}=${entry.rows}`).join(", ")
    const orderCount = existing.find((entry) => entry.table === "orders")?.rows ?? 0

    console.error("Refusing to seed: this database is not empty.")
    console.error(`  Existing rows: ${summary}`)
    if (orderCount > 0) {
      console.error(
        `  ${orderCount} order${orderCount === 1 ? "" : "s"} would be deleted. If any of them are real, seeding destroys them.`
      )
    }
    console.error("")
    console.error("Seeding clears every table listed above and rewrites it from lib/mock-data.ts.")
    console.error("If that is genuinely what you want:  npm run db:seed -- --force")
    console.error("or, non-interactively:               FORCE_SEED=true npm run db:seed")
    await prisma.$disconnect()
    process.exit(1)
  }

  if (existing.length > 0) {
    console.warn(
      `Forced: overwriting a non-empty database (${existing
        .map((entry) => `${entry.table}=${entry.rows}`)
        .join(", ")}).`
    )
  }

  const counts = await seedDatabase()
  console.log("Seeded:", counts)
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
