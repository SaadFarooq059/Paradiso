import { config } from "dotenv"

import { get, listAll } from "@/lib/squarespace/client"

config({ path: ".env.local" })
config()

/**
 * Looks at the live Squarespace shop without touching it.
 *
 * Answers the questions the import has to be built around — does the key work,
 * does the plan include the API, and how does the collection date actually
 * arrive — before any import code exists. Reads only, writes nothing anywhere
 * (not Squarespace, not the portal database, not a file).
 *
 * Customer details stay out of the terminal: no names, emails, phones or
 * addresses. Free-text answers are shown only when their label looks like a
 * date; anything else is reported by length, since a cake message can name
 * the person it is for.
 *
 *   npx tsx scripts/squarespace-probe.ts [days=30] [orders=20]
 */

type LabelValue = { label?: string; value?: string }

type Order = {
  orderNumber?: string
  createdOn?: string
  channel?: string
  testmode?: boolean
  fulfillmentStatus?: string
  grandTotal?: { value?: string; currency?: string }
  formSubmission?: LabelValue[] | null
  lineItems?: {
    productName?: string
    quantity?: number
    lineItemType?: string
    variantOptions?: { optionName?: string; value?: string }[] | null
    customizations?: LabelValue[] | null
  }[]
}

const DATE_LIKE = /date|collect|pick.?up|when|day/i

function show({ label = "(no label)", value = "" }: LabelValue): string {
  return DATE_LIKE.test(label) ? `${label}: "${value}"` : `${label}: [${value.length} chars hidden]`
}

/** Rough shape of a date answer, so we can see which formats the parser must read. */
function shapeOf(value: string): string {
  return value
    .trim()
    .replace(/[A-Za-z]+/g, "A")
    .replace(/\d/g, "9")
}

async function main() {
  const days = Number(process.argv[2] ?? 30)
  const limit = Number(process.argv[3] ?? 20)
  const before = new Date()
  const after = new Date(before.getTime() - days * 86_400_000)

  console.log(`Read-only probe — orders modified in the last ${days} days\n`)

  const { items: orders, truncated } = await listAll<Order>(
    "/1.0/commerce/orders",
    { modifiedAfter: after.toISOString(), modifiedBefore: before.toISOString() },
    5,
  )
  console.log(`✓ Key works and the plan includes the Orders API — ${orders.length} order(s)${truncated ? " (stopped at 5 pages)" : ""}\n`)

  const newest = [...orders].sort((a, b) => (b.createdOn ?? "").localeCompare(a.createdOn ?? "")).slice(0, limit)
  const labels = new Map<string, number>()
  const shapes = new Map<string, number>()

  for (const order of newest) {
    const flags = [order.testmode && "TEST", order.channel && order.channel !== "web" && order.channel]
      .filter(Boolean)
      .join(" ")
    console.log(
      `#${order.orderNumber} · ${order.createdOn?.slice(0, 16)} · ${order.fulfillmentStatus} · ` +
        `${order.grandTotal?.value} ${order.grandTotal?.currency}${flags ? ` · ${flags}` : ""}`,
    )
    for (const line of order.lineItems ?? []) {
      const options = (line.variantOptions ?? []).map((o) => `${o.optionName}=${o.value}`).join(", ")
      console.log(`    ${line.quantity} × ${line.productName}${options ? ` (${options})` : ""}`)
      for (const c of line.customizations ?? []) {
        console.log(`        ${show(c)}`)
        labels.set(`item: ${c.label}`, (labels.get(`item: ${c.label}`) ?? 0) + 1)
        if (DATE_LIKE.test(c.label ?? "") && c.value) shapes.set(shapeOf(c.value), (shapes.get(shapeOf(c.value)) ?? 0) + 1)
      }
    }
    for (const f of order.formSubmission ?? []) {
      console.log(`    form ${show(f)}`)
      labels.set(`form: ${f.label}`, (labels.get(`form: ${f.label}`) ?? 0) + 1)
      if (DATE_LIKE.test(f.label ?? "") && f.value) shapes.set(shapeOf(f.value), (shapes.get(shapeOf(f.value)) ?? 0) + 1)
    }
  }

  console.log("\nQuestions asked at checkout (label → orders):")
  for (const [label, count] of labels) console.log(`  ${count} × ${label}`)
  console.log("\nDate answer formats seen (9 = digit, A = word):")
  for (const [shape, count] of shapes) console.log(`  ${count} × ${shape}`)

  // A second, independent check that the inventory permission was granted.
  const inventory = await get<{ inventory?: unknown[] }>("/1.0/commerce/inventory")
  console.log(`\n✓ Inventory readable — ${inventory.inventory?.length ?? 0} variant(s) on the first page`)
  console.log("\nNothing was changed in Squarespace or the portal.")
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
