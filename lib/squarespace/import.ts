import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { collectionMomentFor } from "@/lib/production-schedule"
import { readCalendarSettings } from "@/lib/server/state"
import { renderEmailsForStatus } from "@/lib/server/email-service"
import { cancelOrder } from "@/lib/server/order-service"
import { toAppStatus, toDbStatus } from "@/lib/server/serialize"
import { compareShopDays, shopDayOf, shopMoment, shopWeekdayOf, todayShopDay, type ShopDay } from "@/lib/shop-time"
import { formatMoney } from "@/lib/payments"
import { listAll } from "@/lib/squarespace/client"
import { matchProduct } from "@/lib/squarespace/catalogue"
import { isCollectionDateLabel, parseCollectionDate } from "@/lib/squarespace/collection-date"
import type { OrderStatus } from "@/lib/types"

/**
 * Copies Squarespace orders into the portal's production plan.
 *
 * Stage 1 of the migration: customers keep ordering on Squarespace exactly as
 * they do today, and the portal plans the baking from those orders. Nothing
 * here can disturb that, by construction:
 *
 * - Squarespace is only ever *read* (see client.ts — it has no way to write).
 * - The portal never emails these customers. Squarespace already confirmed the
 *   order; a second message from us would be confusing at best.
 * - The shop's calendar rules warn rather than refuse. The customer has chosen
 *   and paid for that date; the import's job is to tell the kitchen, not to
 *   overrule the shop's own checkout.
 * - Only what is certain is imported. A product without a portal recipe, a
 *   date that cannot be read, a size that is ambiguous — each is recorded with
 *   its reason for a person to look at, never guessed.
 * - Running it twice changes nothing. Every Squarespace line item is keyed on
 *   its own id, so an overlap between two runs fails on that key instead of
 *   duplicating a cake.
 * - Past collections are left alone, so history and reports stay as they are.
 */

export const SQUARESPACE_OUTCOMES = {
  imported: "Imported",
  "no-recipe": "No portal recipe",
  "needs-mapping": "Needs mapping",
  "not-a-product": "Not made in the kitchen",
  "no-date": "No collection date",
  "date-unreadable": "Collection date unreadable",
  past: "Collection already passed",
  cancelled: "Cancelled on Squarespace",
  "missing-variant": "Portal recipe missing",
} as const

export type SquarespaceOutcome = keyof typeof SQUARESPACE_OUTCOMES

type LabelValue = { label?: string; value?: string }
type Money = { value?: string; currency?: string }

export type SquarespaceOrder = {
  id: string
  orderNumber: string
  createdOn: string
  modifiedOn?: string
  testmode?: boolean
  customerEmail?: string | null
  billingAddress?: { firstName?: string; lastName?: string; phone?: string } | null
  fulfillmentStatus?: string
  paymentState?: string
  refundedTotal?: Money
  formSubmission?: LabelValue[] | null
  lineItems?: {
    id: string
    productName?: string
    quantity?: number
    lineItemType?: string
    unitPricePaid?: Money
    variantOptions?: { optionName?: string; value?: string }[] | null
    customizations?: LabelValue[] | null
  }[]
}

type Line = NonNullable<SquarespaceOrder["lineItems"]>[number]

class AlreadyImported extends Error {}

export interface ImportedLineReport {
  orderNumber: string
  product: string
  outcome: SquarespaceOutcome
  collectionDay: ShopDay | null
  detail: string | null
}

export interface ImportReport {
  dryRun: boolean
  window: { from: string; to: string }
  ordersSeen: number
  truncated: boolean
  created: number
  cancelled: number
  /** Imported orders that changed on Squarespace in a way a person should check. */
  flaggedForStaff: number
  lines: ImportedLineReport[]
}

/** "30.00" → 3000. Parsed as text so money never passes through a float. */
export function toPence(money: Money | undefined): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(money?.value?.trim() ?? "")
  if (!match) return 0
  return Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"))
}

function optionsText(line: Line): string {
  return (line.variantOptions ?? []).map((o) => `${o.optionName}=${o.value}`).join(", ")
}

function describe(line: Line): string {
  const options = (line.variantOptions ?? []).map((o) => o.value).join(", ")
  return `${line.quantity ?? 1} × ${line.productName}${options ? ` (${options})` : ""}`
}

/** The line's own date answer, falling back to any other line or the checkout form. */
function collectionRawFor(order: SquarespaceOrder, line: Line): string | null {
  const own = line.customizations?.find((c) => isCollectionDateLabel(c.label))?.value
  if (own) return own
  for (const other of order.lineItems ?? []) {
    const value = other.customizations?.find((c) => isCollectionDateLabel(c.label))?.value
    if (value) return value
  }
  return order.formSubmission?.find((f) => isCollectionDateLabel(f.label))?.value ?? null
}

function daysBetween(from: ShopDay, to: ShopDay): number {
  return Math.round((shopMoment(to).getTime() - shopMoment(from).getTime()) / 86_400_000)
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/**
 * Statuses in which a Squarespace cancellation is applied automatically.
 * Once a cake is in production or ready, stopping it is a person's call.
 */
/**
 * Whether the shop has called this order off. Squarespace shows that two ways:
 * an explicit cancel, or — what the shop actually does — a full refund, which
 * leaves fulfilment saying PENDING. Reading only the first would keep making a
 * cake the customer has had their money back for.
 */
export function isCancelled(order: Pick<SquarespaceOrder, "fulfillmentStatus" | "paymentState">): boolean {
  return order.fulfillmentStatus === "CANCELED" || order.paymentState === "REFUNDED"
}

const AUTO_CANCELLABLE: OrderStatus[] = ["Confirmed", "Scheduled", "On Hold", "Details require clarification"]

export async function importSquarespaceOrders({
  days = 3,
  apply = false,
  now = new Date(),
}: { days?: number; apply?: boolean; now?: Date } = {}): Promise<ImportReport> {
  const to = now
  const from = new Date(now.getTime() - days * 86_400_000)
  const { items: orders, truncated } = await listAll<SquarespaceOrder>("/1.0/commerce/orders", {
    modifiedAfter: from.toISOString(),
    modifiedBefore: to.toISOString(),
  })

  const report: ImportReport = {
    dryRun: !apply,
    window: { from: from.toISOString(), to: to.toISOString() },
    ordersSeen: orders.length,
    truncated,
    created: 0,
    cancelled: 0,
    flaggedForStaff: 0,
    lines: [],
  }

  const today = todayShopDay(now)
  const settings = await readCalendarSettings(prisma)
  const variants = new Map(
    (await prisma.productVariant.findMany({ where: { archived: false } })).map((v) => [v.id, v])
  )

  // Oldest first, so a customer's earlier order is created before their later one.
  orders.sort((a, b) => a.createdOn.localeCompare(b.createdOn))

  for (const order of orders) {
    // Squarespace's own test orders never reach the kitchen.
    if (order.testmode) continue
    const cancelledOnSquarespace = isCancelled(order)
    const lines = order.lineItems ?? []

    for (const line of lines) {
      const raw = collectionRawFor(order, line)
      const day = parseCollectionDate(raw)
      const record = (outcome: SquarespaceOutcome, detail: string | null = null) =>
        report.lines.push({ orderNumber: order.orderNumber, product: describe(line), outcome, collectionDay: day, detail })

      const existing = await prisma.squarespaceImportLine.findUnique({ where: { lineItemId: line.id } })

      // Already in the portal: only follow what Squarespace changed since.
      if (existing?.portalOrderId) {
        const followed = await followUp(existing.portalOrderId, order, apply)
        if (followed === "cancelled") report.cancelled++
        if (followed === "flagged") report.flaggedForStaff++
        if (apply) await touch(line.id)
        record("imported", followed === "unchanged" ? "already imported" : followed)
        continue
      }

      // Decide what this line is.
      let outcome: SquarespaceOutcome
      let detail: string | null = null
      const match = matchProduct(line.productName ?? "", line.variantOptions ?? [])
      if (line.lineItemType && line.lineItemType !== "PHYSICAL_PRODUCT") {
        outcome = "not-a-product"
      } else if (match.kind === "no-recipe") {
        outcome = "no-recipe"
      } else if (match.kind === "needs-mapping") {
        outcome = "needs-mapping"
        detail = match.reason
      } else if (!raw) {
        outcome = "no-date"
      } else if (!day) {
        outcome = "date-unreadable"
        detail = `"${raw}"`
      } else if (compareShopDays(day, today) < 0) {
        outcome = "past"
      } else if (cancelledOnSquarespace) {
        outcome = "cancelled"
      } else if (!variants.has(match.variantId)) {
        outcome = "missing-variant"
        detail = match.variantId
      } else {
        outcome = "imported"
      }

      if (outcome !== "imported" || match.kind !== "recipe" || !day) {
        if (apply) await remember(order, line, raw, outcome, null)
        record(outcome, detail)
        continue
      }

      const variant = variants.get(match.variantId)!
      const flags = flagsFor(order, line, day, variant.leadTimeDays, settings.blockedWeekdays, match.note)

      if (!apply) {
        report.created++
        record("imported", ["would import", ...flags].join(" · "))
        continue
      }

      try {
        await createFromSquarespace(order, line, raw, day, variant.id, settings.earliestCollectionTime, flags)
        report.created++
        record("imported", flags.join(" · ") || null)
      } catch (error) {
        // Another run got there first — the line-item key did its job.
        if (
          error instanceof AlreadyImported ||
          (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        ) {
          record("imported", "already imported")
          continue
        }
        throw error
      }
    }
  }

  return report
}

/** What staff need to know that the shop's checkout did not enforce. */
function flagsFor(
  order: SquarespaceOrder,
  line: Line,
  day: ShopDay,
  leadTimeDays: number,
  blockedWeekdays: number[],
  note: string | null
): string[] {
  const flags: string[] = []
  if (note) flags.push(note)

  const notice = daysBetween(shopDayOf(new Date(order.createdOn)), day)
  if (notice < leadTimeDays) {
    flags.push(`Short notice: ordered ${notice === 0 ? "for the same day" : `${notice} day${notice === 1 ? "" : "s"} ahead`} (recipe needs ${leadTimeDays})`)
  }

  const weekday = shopWeekdayOf(day)
  if (blockedWeekdays.includes(weekday)) {
    flags.push(`Collection on a ${WEEKDAY[weekday]}, when the shop is normally closed`)
  }

  const others = (order.lineItems ?? []).filter((other) => other.id !== line.id)
  if (others.length > 0) {
    flags.push(`Same Squarespace order also has: ${others.map(describe).join("; ")}`)
  }
  return flags
}

async function createFromSquarespace(
  order: SquarespaceOrder,
  line: Line,
  raw: string | null,
  day: ShopDay,
  variantId: string,
  earliestCollectionTime: string,
  flags: string[]
) {
  await prisma.$transaction(async (tx) => {
    // Claimed first. The line may already exist from an earlier run that could
    // not import it (no recipe then, say), so this is an upsert, written in SQL
    // because ON CONFLICT DO UPDATE locks the row: a second run racing this one
    // waits here, then sees our portalOrderId and backs off.
    const row = lineRow(order, line, raw, "imported", null)
    const [claimed] = await tx.$queryRaw<{ portalOrderId: string | null }[]>`
      INSERT INTO "squarespace_import_lines"
        ("lineItemId", "squarespaceOrderId", "orderNumber", "productName", "options", "quantity", "collectionRaw", "outcome")
      VALUES
        (${row.lineItemId}, ${row.squarespaceOrderId}, ${row.orderNumber}, ${row.productName}, ${row.options}, ${row.quantity}, ${row.collectionRaw}, ${row.outcome})
      ON CONFLICT ("lineItemId") DO UPDATE SET "lastSeenAt" = now()
      RETURNING "portalOrderId"`
    if (claimed?.portalOrderId) throw new AlreadyImported()

    // Matched on email like a counter order, but an existing customer's details
    // are left exactly as staff last saw them — the import never edits a person.
    const email = (order.customerEmail ?? "").trim().toLowerCase()
    const name =
      [order.billingAddress?.firstName, order.billingAddress?.lastName].filter(Boolean).join(" ").trim() ||
      "Squarespace customer"
    const existingCustomer = email ? await tx.customer.findFirst({ where: { email } }) : null
    const customer =
      existingCustomer ??
      (await tx.customer.create({
        data: { name, email, phone: order.billingAddress?.phone?.trim() || null },
      }))

    // What the customer actually paid on Squarespace, not the portal's list
    // price — the order record has to match the money that really came in.
    const quantity = line.quantity ?? 1
    const totalAmount = toPence(line.unitPricePaid) * quantity

    const created = await tx.order.create({
      data: {
        collectionDate: collectionMomentFor(day, earliestCollectionTime),
        status: toDbStatus("Confirmed"),
        consumedIngredients: {},
        shortages: [],
        totalAmount,
        customerId: customer.id,
        source: "Squarespace",
        externalOrderNumber: order.orderNumber,
        importFlags: flags,
        createdAt: new Date(order.createdOn),
        items: { create: { variantId, quantity } },
        statusHistory: {
          create: { status: toDbStatus("Confirmed"), note: `Imported from Squarespace #${order.orderNumber}` },
        },
      },
    })

    if (order.paymentState === "PAID" && totalAmount > 0) {
      await tx.paymentEvent.create({
        data: {
          orderId: created.id,
          kind: "Payment",
          amount: totalAmount,
          at: new Date(order.createdOn),
          note: `Paid online on Squarespace #${order.orderNumber}`,
        },
      })
      await tx.order.update({ where: { id: created.id }, data: { amountPaid: totalAmount } })
    }

    // Logged as suppressed, so the order shows what the portal would have sent
    // and why it did not.
    await renderEmailsForStatus(tx, created.id, "Confirmed")

    await tx.squarespaceImportLine.update({
      where: { lineItemId: line.id },
      data: { portalOrderId: created.id, outcome: "imported" },
    })
  })
}

/**
 * An imported order changed on Squarespace. A cancellation is followed while
 * the cake has not been started; anything later, and any refund, is flagged on
 * the order for a person — the import never decides to stop a cake in the oven.
 */
async function followUp(
  portalOrderId: string,
  order: SquarespaceOrder,
  apply: boolean
): Promise<"unchanged" | "cancelled" | "flagged"> {
  const portal = await prisma.order.findUnique({ where: { id: portalOrderId } })
  if (!portal) return "unchanged"
  const status = toAppStatus(portal.status)
  const newFlags: string[] = []

  if (isCancelled(order) && status !== "Cancelled") {
    if (AUTO_CANCELLABLE.includes(status)) {
      if (apply) await cancelOrder(portalOrderId, null, `Cancelled on Squarespace #${order.orderNumber}`)
      return "cancelled"
    }
    newFlags.push(`Cancelled on Squarespace while ${status.toLowerCase()} — check before handing over`)
  }

  const refunded = toPence(order.refundedTotal)
  if (refunded > 0) newFlags.push(`Refunded ${formatMoney(refunded)} on Squarespace`)

  const unseen = newFlags.filter((flag) => !portal.importFlags.includes(flag))
  if (unseen.length === 0) return "unchanged"
  if (apply) {
    await prisma.order.update({
      where: { id: portalOrderId },
      data: { importFlags: [...portal.importFlags, ...unseen] },
    })
  }
  return "flagged"
}

function lineRow(
  order: SquarespaceOrder,
  line: Line,
  raw: string | null,
  outcome: SquarespaceOutcome,
  portalOrderId: string | null
) {
  return {
    lineItemId: line.id,
    squarespaceOrderId: order.id,
    orderNumber: order.orderNumber,
    productName: line.productName ?? "",
    options: optionsText(line),
    quantity: line.quantity ?? 1,
    collectionRaw: raw,
    outcome,
    portalOrderId,
  }
}

/** Records a line that was not imported, so it is re-judged next run and visible meanwhile. */
async function remember(
  order: SquarespaceOrder,
  line: Line,
  raw: string | null,
  outcome: SquarespaceOutcome,
  portalOrderId: string | null
) {
  const row = lineRow(order, line, raw, outcome, portalOrderId)
  await prisma.squarespaceImportLine.upsert({
    where: { lineItemId: line.id },
    create: row,
    update: { ...row, lastSeenAt: new Date() },
  })
}

async function touch(lineItemId: string) {
  await prisma.squarespaceImportLine.update({ where: { lineItemId }, data: { lastSeenAt: new Date() } })
}
