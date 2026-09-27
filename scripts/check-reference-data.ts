import "dotenv/config"

import { prisma } from "@/lib/prisma"
import { REFERENCE_TABLES } from "@/lib/reference-data"

/**
 * Fails the build if any reference table is empty.
 *
 * Runs after `prisma migrate deploy` and before `next build`, so a deployment
 * whose migrations created a table without filling it stops here rather than
 * going live quietly broken. The previous deployment keeps serving, which is the
 * right failure: a missing recipe list is worse than an older bundle.
 *
 * This is deliberately a hard failure rather than a warning. Both times this
 * happened the symptom was a plausible-looking wrong number — £0.00 prices, an
 * £80 quote — and a warning in a build log is not something anyone reads before
 * sending a customer a price.
 */
async function main() {
  const empty: { table: string; consequence: string }[] = []

  for (const reference of REFERENCE_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[reference.model]
    if (!model?.count) {
      console.error(`  ✗ ${reference.table}: no such Prisma model "${reference.model}"`)
      process.exitCode = 1
      continue
    }
    const count = await model.count()
    if (count === 0) {
      empty.push(reference)
      console.error(`  ✗ ${reference.table} is EMPTY — ${reference.consequence}`)
    } else {
      console.log(`  ✓ ${reference.table}: ${count}`)
    }
  }

  await prisma.$disconnect()

  if (empty.length > 0) {
    console.error("")
    console.error(
      `Reference data check failed: ${empty.length} table${empty.length === 1 ? " is" : "s are"} empty.`
    )
    console.error(
      "A migration created these without filling them, and the seed does not run on a database that already has rows."
    )
    console.error("Fix: add the rows in a migration (idempotent, ON CONFLICT DO NOTHING).")
    process.exit(1)
  }

  console.log("Reference data check passed.")
}

main().catch(async (error) => {
  console.error("Reference data check could not run:", error)
  await prisma.$disconnect()
  process.exit(1)
})
