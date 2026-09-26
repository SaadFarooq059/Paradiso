import { prisma } from "@/lib/prisma"
import { restockIngredients } from "@/lib/order-engine"
import {
  perUnitShare,
  productionLinesFrom,
  shortagesAfterAdding,
  type BatchableVariant,
  type StockRecord,
} from "@/lib/stock-projection"
import { loadDashboardState, readCalendarSettings } from "@/lib/server/state"
import {
  applyEarliestCollectionTime,
  collectionDateUnavailableReason,
  dayKey,
  productionDateFor,
  type UnavailableReason,
} from "@/lib/production-schedule"
import {
  asJson,
  parseConsumed,
  toAppStatus,
  toDbStatus,
  type DashboardState,
} from "@/lib/server/serialize"
import type {
  IngredientAmounts,
  IngredientKey,
  Order,
  OrderStatus,
  ProductVariant,
} from "@/lib/types"

/**
 * Server-side order scheduling.
 *
 * Stock is a dated ledger: StockLevel.onHand is what is physically in the
 * building and only a restock moves it. Scheduling an order records demand
 * against its production day — the order's frozen consumedIngredients snapshot
 * *is* that demand — and feasibility asks whether any day's running balance
 * would go negative, not whether today's total is big enough. Cancelling takes
 * the order out of the live set, which removes its demand by itself; there is
 * nothing to refund because nothing was deducted.
 *
 * Everything still runs in an interactive transaction: the read-decide-write
 * sequence is not atomic the way a single React setState was, and two orders
 * submitted at once must not both be told the same day has room.
 */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** What is physically in the building, per ingredient. */
async function readOnHand(tx: Tx): Promise<StockRecord> {
  const ingredients = await tx.ingredient.findMany({ include: { stockLevel: true } })
  const onHand = {} as StockRecord
  for (const ingredient of ingredients) {
    onHand[ingredient.key as IngredientKey] = ingredient.stockLevel?.onHand ?? 0
  }
  return onHand
}

/**
 * Live production lines plus the recipes to batch them against.
 *
 * Demand is derived from units and yields, not from orders' consumedIngredients
 * snapshots: a batch's cost belongs to the production day, and a snapshot only
 * records one order's share of it. Summing shares back up would lose the
 * rounding that made them whole batches in the first place.
 */
async function readProductionContext(tx: Tx) {
  const [orders, variants] = await Promise.all([
    tx.order.findMany({ include: { items: true } }),
    tx.productVariant.findMany({ include: { recipeItems: { include: { ingredient: true } } } }),
  ])

  const leadTimes = Object.fromEntries(
    variants.map((variant) => [variant.id, { leadTimeDays: variant.leadTimeDays }])
  )
  const batchable: Record<string, BatchableVariant> = Object.fromEntries(
    variants.map((variant) => [
      variant.id,
      {
        unitsPerBatch: variant.unitsPerBatch,
        requires: Object.fromEntries(
          variant.recipeItems.map((item) => [
            item.ingredient.key as IngredientKey,
            item.amountPerBatch,
          ])
        ),
      },
    ])
  )

  const lines = productionLinesFrom(
    orders.map((order) => ({
      collectionDate: order.collectionDate,
      productId: order.items[0]?.variantId ?? "",
      status: toAppStatus(order.status),
      quantity: order.items[0]?.quantity ?? 0,
    })),
    leadTimes
  )

  return { lines, batchable, leadTimes }
}

/**
 * Writes on-hand back. Under the ledger this has exactly one caller — restocking.
 * Scheduling and cancelling no longer move stock at all: they add and remove
 * demand against a production day, and the projection does the rest.
 */
async function writeOnHand(tx: Tx, before: StockRecord, after: StockRecord) {
  const ingredients = await tx.ingredient.findMany()
  for (const ingredient of ingredients) {
    const key = ingredient.key as IngredientKey
    if (before[key] === after[key]) continue
    await tx.stockLevel.update({
      where: { ingredientId: ingredient.id },
      data: { onHand: after[key] },
    })
  }
}

/** Loads a variant with its recipe, shaped like the client-side ProductVariant. */
async function readVariant(tx: Tx, variantId: string): Promise<ProductVariant | null> {
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    include: { recipeItems: { include: { ingredient: true } } },
  })
  if (!variant || variant.archived) return null
  return {
    id: variant.id,
    name: variant.name,
    description: variant.description,
    servings: variant.servings,
    requires: Object.fromEntries(
      variant.recipeItems.map((item) => [item.ingredient.key as IngredientKey, item.amountPerBatch])
    ),
    unitsPerBatch: variant.unitsPerBatch,
    leadTimeDays: variant.leadTimeDays,
  }
}

/**
 * Every order in the shape the scheduling rules need, plus the lead times to
 * derive their production days. Read inside the transaction so a date is
 * validated against the same rows the write will land among.
 */
async function readScheduleContext(tx: Tx) {
  const [orders, variants] = await Promise.all([
    tx.order.findMany({ include: { items: true } }),
    tx.productVariant.findMany(),
  ])
  const variantsById = Object.fromEntries(
    variants.map((variant) => [variant.id, { leadTimeDays: variant.leadTimeDays }])
  )
  const shaped: Pick<Order, "collectionDate" | "productId" | "status">[] = orders.map((order) => ({
    collectionDate: order.collectionDate,
    productId: order.items[0]?.variantId ?? "",
    status: toAppStatus(order.status),
  }))
  return { orders: shaped, variantsById }
}

function isKnownStatus(value: string): boolean {
  return CANCELLABLE.includes(value as OrderStatus) || value === "Completed" || value === "Cancelled"
}

const UNAVAILABLE_MESSAGE: Record<UnavailableReason, string> = {
  "blocked-weekday": "The shop doesn't do collections that day — pick another date.",
  "inside-lead-time": "Not enough lead time to make that — pick a later collection date.",
  "production-day-full": "That day's production is already full — pick another date.",
}

/** Terse form of the above, for the order's own lifecycle trail. */
const UNAVAILABLE_NOTE: Record<UnavailableReason, string> = {
  "blocked-weekday": "collection day is now blocked",
  "inside-lead-time": "collection date has passed its lead time",
  "production-day-full": "production day is now full",
}

/**
 * Round-robin, now keyed to the production day rather than to lifetime totals.
 *
 * The question the kitchen actually asks is "who is making things on the day
 * this gets made", not "who has had the most orders ever" — two orders due the
 * same day are the ones that compete for a person's time, and their collection
 * dates may be weeks apart if their lead times differ.
 *
 * Ties fall back to the previous behaviour: the staff list is read in
 * (orderCount, sortOrder, id) order and a strict `<` keeps the first of an equal
 * set, so when nobody is working that day this picks exactly who it used to.
 */
async function pickStaff(tx: Tx, productionDate: Date) {
  const staff = await tx.staff.findMany({
    orderBy: [{ orderCount: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  })
  if (staff.length === 0) return null

  const load = await productionDayLoadByStaff(tx, productionDate)
  let best = staff[0]
  let bestLoad = load.get(best.id) ?? 0
  for (const member of staff.slice(1)) {
    const memberLoad = load.get(member.id) ?? 0
    if (memberLoad < bestLoad) {
      best = member
      bestLoad = memberLoad
    }
  }
  return best
}

/** How many live orders each staff member already has producing on a given day. */
async function productionDayLoadByStaff(tx: Tx, productionDate: Date): Promise<Map<string, number>> {
  const assignments = await tx.productionAssignment.findMany({
    where: { releasedAt: null },
    include: { order: { include: { items: { include: { variant: true } } } } },
  })
  const target = dayKey(productionDate)
  const load = new Map<string, number>()
  for (const assignment of assignments) {
    const order = assignment.order
    const status = toAppStatus(order.status)
    if (status === "Cancelled" || status === "On Hold") continue
    const line = order.items[0]
    if (!line) continue
    const producedOn = productionDateFor(order.collectionDate, line.variant.leadTimeDays)
    if (dayKey(producedOn) !== target) continue
    load.set(assignment.staffId, (load.get(assignment.staffId) ?? 0) + 1)
  }
  return load
}

export interface MutationResult {
  state: DashboardState
  /** Mirrors the toast the client used to raise locally. */
  message: string
  tone: "success" | "warning" | "error"
  /** Set for createOrder so the client can open the new order's detail view. */
  orderId?: string
}

export async function createOrder(
  productId: string,
  quantity: number,
  collectionDate: Date
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const variant = await readVariant(tx, productId)
    if (!variant) return { message: "Unknown product.", tone: "error" as const }

    // The calendar rules are enforced here, not only in the picker. The picker
    // greys these days out, but it is a convenience — the server is what makes
    // the rule true, and an order arriving by any other route gets the same answer.
    const settings = await readCalendarSettings(tx)
    const { orders: existingOrders, variantsById } = await readScheduleContext(tx)
    const unavailable = collectionDateUnavailableReason(collectionDate, {
      variant,
      settings,
      orders: existingOrders,
      variantsById,
    })
    if (unavailable) {
      return { message: UNAVAILABLE_MESSAGE[unavailable], tone: "error" as const }
    }

    // Stored as a real moment, opening time included, rather than midnight.
    const collectionAt = applyEarliestCollectionTime(collectionDate, settings.earliestCollectionTime)
    const productionDate = productionDateFor(collectionDate, variant.leadTimeDays)

    // Feasibility asks whether the whole schedule still works once this order's
    // units are batched in — not whether today's total is big enough, and not
    // against a fixed per-unit amount. Re-batching is what lets an order slot
    // into surplus a batch was already going to produce and cost nothing.
    const onHand = await readOnHand(tx)
    const { lines, batchable } = await readProductionContext(tx)
    const candidate = { variantId: productId, units: quantity, productionDate }
    const shortages = shortagesAfterAdding(onHand, lines, batchable, candidate)
    // This order's share of its batch: the batch recipe over the batch's yield,
    // times the units ordered. Depends only on the recipe and this order, so a
    // later order joining the same batch never rewrites it.
    const needed = perUnitShare(variant, quantity)

    if (shortages.length === 0) {
      const assignee = await pickStaff(tx, productionDate)
      if (!assignee) {
        return {
          message: "Can't schedule — there's no staff to assign. Add staff in Staff Management.",
          tone: "error" as const,
        }
      }

      // No stock write: the order's snapshot below IS the demand, and the
      // projection reads it from there.
      await tx.staff.update({
        where: { id: assignee.id },
        data: { orderCount: { increment: 1 } },
      })

      const order = await tx.order.create({
        data: {
          collectionDate: collectionAt,
          status: toDbStatus("Scheduled"),
          consumedIngredients: needed,
          shortages: [],
          items: { create: { variantId: productId, quantity } },
          statusHistory: { create: { status: toDbStatus("Scheduled") } },
          assignment: { create: { staffId: assignee.id } },
        },
      })
      return {
        message: `Order scheduled and assigned to ${assignee.name}`,
        tone: "success" as const,
        orderId: order.id,
      }
    }

    const order = await tx.order.create({
      data: {
        collectionDate: collectionAt,
        status: toDbStatus("On Hold"),
        consumedIngredients: {},
        shortages: asJson(shortages),
        items: { create: { variantId: productId, quantity } },
        statusHistory: { create: { status: toDbStatus("On Hold") } },
      },
    })
    return {
      message: "Order put on hold — insufficient stock",
      tone: "warning" as const,
      orderId: order.id,
    }
  })

  return { ...result, state: await loadDashboardState() }
}

export async function recheckOrder(orderId: string): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order || toAppStatus(order.status) !== "On Hold") {
      return { message: "Order can't be re-checked.", tone: "error" as const }
    }

    const line = order.items[0]
    const variant = line ? await readVariant(tx, line.variantId) : null
    if (!variant) {
      return { message: "Can't re-check — this product's recipe no longer exists.", tone: "error" as const }
    }

    const onHand = await readOnHand(tx)
    const { lines, batchable, leadTimes } = await readProductionContext(tx)
    const productionDate = productionDateFor(order.collectionDate, variant.leadTimeDays)

    // The date is re-validated, not just the stock. An order can sit On Hold long
    // enough for its own lead time to run out: the collection day was reachable
    // when it was taken, and is not any more. Scheduling it then would promise a
    // cake that has to start production in the past. The same rule set decides
    // this as decides a brand new order, so re-checking can never produce a
    // schedule the New Order screen would have refused.
    const settings = await readCalendarSettings(tx)
    const { orders: existingOrders } = await readScheduleContext(tx)
    const unavailable = collectionDateUnavailableReason(order.collectionDate, {
      variant,
      settings,
      orders: existingOrders,
      variantsById: leadTimes,
    })
    if (unavailable) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          statusHistory: {
            create: {
              status: toDbStatus("On Hold"),
              note: `Re-checked — ${UNAVAILABLE_NOTE[unavailable]}`,
            },
          },
        },
      })
      return { message: UNAVAILABLE_MESSAGE[unavailable], tone: "error" as const }
    }

    const candidate = { variantId: variant.id, units: line!.quantity, productionDate }
    const shortages = shortagesAfterAdding(onHand, lines, batchable, candidate)
    const needed = perUnitShare(variant, line!.quantity)

    if (shortages.length > 0) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          shortages: asJson(shortages),
          statusHistory: {
            create: { status: toDbStatus("On Hold"), note: "Re-checked — still short" },
          },
        },
      })
      return { message: "Still insufficient stock", tone: "warning" as const }
    }

    // Re-checking deliberately does not re-validate the collection date: the date
    // was legal when the order was taken, and an order going On Hold on stock is
    // not a reason to also refuse the customer's agreed day. It does assign
    // against that order's production day, same as a fresh one.
    const assignee = await pickStaff(tx, productionDate)
    if (!assignee) {
      return {
        message: "Can't re-check — there's no staff to assign. Add staff in Staff Management.",
        tone: "error" as const,
      }
    }

    await tx.staff.update({ where: { id: assignee.id }, data: { orderCount: { increment: 1 } } })
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toDbStatus("Scheduled"),
        shortages: [],
        consumedIngredients: needed,
        statusHistory: {
          create: { status: toDbStatus("Scheduled"), note: "Re-checked and scheduled" },
        },
        assignment: {
          upsert: {
            create: { staffId: assignee.id },
            update: { staffId: assignee.id, assignedAt: new Date(), releasedAt: null },
          },
        },
      },
    })
    return { message: `Order re-checked and scheduled — assigned to ${assignee.name}`, tone: "success" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

const FORWARD_TRANSITIONS: Record<string, { from: OrderStatus; to: OrderStatus; message: string }> = {
  start: { from: "Scheduled", to: "In Production", message: "Order moved to production" },
  ready: { from: "In Production", to: "Ready", message: "Order marked ready" },
  complete: { from: "Ready", to: "Completed", message: "Order marked completed" },
}

export async function advanceOrder(orderId: string, action: string): Promise<MutationResult> {
  const transition = FORWARD_TRANSITIONS[action]
  if (!transition) {
    return { state: await loadDashboardState(), message: "Unknown action.", tone: "error" }
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    // Same guard as the in-memory version: a transition only applies from its
    // specific predecessor status, otherwise it is silently a no-op.
    if (!order || toAppStatus(order.status) !== transition.from) {
      return { message: "Order is not in a state for that action.", tone: "error" as const }
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toDbStatus(transition.to),
        statusHistory: { create: { status: toDbStatus(transition.to) } },
      },
    })
    return { message: transition.message, tone: "success" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

const CANCELLABLE: OrderStatus[] = ["Scheduled", "In Production", "Ready", "On Hold"]

export async function cancelOrder(orderId: string): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { assignment: true },
    })
    if (!order || !CANCELLABLE.includes(toAppStatus(order.status))) {
      return { message: "Order can't be cancelled.", tone: "error" as const }
    }

    // Nothing to refund: under the dated ledger scheduling never deducted stock.
    // Cancelling drops the order out of the live set, which removes its demand
    // from every projection by itself. The consumedIngredients snapshot is left
    // exactly as written — it is still the record of what this order was for,
    // and Order Detail still shows it.
    const consumed = parseConsumed(order.consumedIngredients)
    const hadConsumedStock = Object.keys(consumed).length > 0

    // Releasing the assignment decrements the workload counter so round-robin
    // reflects current load; the row itself stays for the audit trail.
    if (order.assignment && !order.assignment.releasedAt) {
      await tx.staff.update({
        where: { id: order.assignment.staffId },
        data: { orderCount: { decrement: 1 } },
      })
      await tx.productionAssignment.update({
        where: { orderId },
        data: { releasedAt: new Date() },
      })
      // Clamp: a counter must never go negative even if rows were edited directly.
      await tx.staff.updateMany({ where: { orderCount: { lt: 0 } }, data: { orderCount: 0 } })
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toDbStatus("Cancelled"),
        statusHistory: { create: { status: toDbStatus("Cancelled") } },
      },
    })

    return {
      message: hadConsumedStock
        ? "Order cancelled — its ingredients are free again"
        : "Order cancelled",
      tone: "success" as const,
    }
  })

  return { ...result, state: await loadDashboardState() }
}

export async function restockIngredient(
  ingredientKey: string,
  amount: number
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    if (!(amount > 0)) return { message: "Amount must be greater than zero.", tone: "error" as const }
    const ingredient = await tx.ingredient.findUnique({ where: { key: ingredientKey } })
    if (!ingredient) return { message: "Unknown ingredient.", tone: "error" as const }

    // The only place on-hand moves under the ledger: stock has physically arrived.
    const onHand = await readOnHand(tx)
    const key = ingredient.key as IngredientKey
    await writeOnHand(tx, onHand, restockIngredients(onHand, { [key]: amount }))
    await tx.restockEntry.create({ data: { ingredientId: ingredient.id, amount } })

    return {
      message: `Restocked ${amount}${ingredient.unit} ${ingredient.label.toLowerCase()}`,
      tone: "success" as const,
    }
  })

  return { ...result, state: await loadDashboardState() }
}
