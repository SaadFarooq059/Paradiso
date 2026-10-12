import { config } from "dotenv"

config({ path: ".env.local" })
config()

/**
 * Runs the Squarespace import by hand.
 *
 * A dry run unless `--apply` is given: it reads Squarespace, decides what it
 * would do with every line, and prints that — writing nothing anywhere. Run it
 * dry first against any database you care about.
 *
 *   npx tsx scripts/squarespace-import.ts [--days=30] [--apply]
 *
 * Prints product names and order numbers only, never customer details.
 */
async function main() {
  // Imported after dotenv, because the Prisma client reads DATABASE_URL on load.
  const { importSquarespaceOrders, SQUARESPACE_OUTCOMES } = await import("@/lib/squarespace/import")
  const { prisma } = await import("@/lib/prisma")

  const apply = process.argv.includes("--apply")
  const days = Number(process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1] ?? 3)
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@([^/:]+).*$/, "$1")

  console.log(`${apply ? "APPLYING" : "DRY RUN — nothing will be written"} · last ${days} days · portal database: ${host}\n`)

  const report = await importSquarespaceOrders({ days, apply })

  const byOutcome = new Map<string, typeof report.lines>()
  for (const line of report.lines) {
    const label = SQUARESPACE_OUTCOMES[line.outcome]
    byOutcome.set(label, [...(byOutcome.get(label) ?? []), line])
  }
  for (const [label, lines] of byOutcome) {
    console.log(`${label} (${lines.length})`)
    for (const line of lines) {
      const when = line.collectionDay ? ` → collect ${line.collectionDay}` : ""
      console.log(`  #${line.orderNumber} ${line.product}${when}${line.detail ? `\n      ${line.detail}` : ""}`)
    }
    console.log()
  }

  console.log(
    `${report.ordersSeen} Squarespace orders read${report.truncated ? " (stopped at the page cap)" : ""} · ` +
      `${report.created} cake${report.created === 1 ? "" : "s"} ${apply ? "imported" : "would be imported"} · ` +
      `${report.cancelled} cancelled · ${report.flaggedForStaff} flagged for staff`
  )
  console.log("Squarespace was only read. No customer was emailed.")
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
