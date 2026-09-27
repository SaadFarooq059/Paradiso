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
  collectionDateUnavailableReason,
  collectionMomentFor,
  dayKey,
  OCCUPIES_PRODUCTION_DAY,
  productionDateFor,
  type UnavailableReason,
} from "@/lib/production-schedule"
import { ORDER_STATUS_ORDER } from "@/lib/mock-data"
import { shopMoment, type ShopDay } from "@/lib/shop-time"
import { renderEmailsForStatus } from "@/lib/server/email-service"
import { formatMoney } from "@/lib/payments"
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
  StaffMember,
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
    priceAmount: variant.priceAmount,
    priceEstimated: variant.priceEstimated,
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
  // `id` is carried so a caller can exclude the order it is about to move —
  // scheduling an order must not count that order against its own day ceiling.
  const shaped: (Pick<Order, "collectionDate" | "productId" | "status"> & { id: string })[] =
    orders.map((order) => ({
      id: order.id,
      collectionDate: order.collectionDate,
      productId: order.items[0]?.variantId ?? "",
      status: toAppStatus(order.status),
    }))
  return { orders: shaped, variantsById }
}

function isKnownStatus(value: string): boolean {
  return ORDER_STATUS_ORDER.includes(value as OrderStatus)
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
  // Active only. A suspended account keeps its history but must not be handed
  // new work — it cannot sign in to do it, and the order would look staffed.
  const staff = await tx.staff.findMany({
    where: { active: true },
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
    if (!OCCUPIES_PRODUCTION_DAY.includes(status)) continue
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

export interface CustomerDetails {
  name: string
  email: string
  phone?: string | null
}

/**
 * Takes an order and confirms it. Deliberately does NOT hold oven capacity.
 *
 * The collection date is still validated against the calendar rules, because an
 * unofferable date is wrong the moment it is agreed. Stock is not checked and no
 * staff member is assigned: that is what Schedule does, and until it runs a
 * confirmed order contributes nothing to any production day.
 */
export async function createOrder(
  productId: string,
  quantity: number,
  collectionDay: ShopDay,
  customer: CustomerDetails,
  actor: StaffMember | null = null
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const variant = await readVariant(tx, productId)
    if (!variant) return { message: "Unknown product.", tone: "error" as const }

    // Same rule as a missing wedding package: a product nobody has priced is
    // refused rather than sold for nothing. Some of the range has no published
    // price yet, and an order silently totalling £0.00 is the kind of plausible
    // wrong number that reaches a customer before anyone notices.
    if (variant.priceAmount <= 0) {
      return {
        message: `${variant.name} has no published price yet. Set one in Products & Recipes before taking an order.`,
        tone: "error" as const,
      }
    }

    // The calendar rules are enforced here, not only in the picker. The picker
    // greys these days out, but it is a convenience — the server is what makes
    // the rule true, and an order arriving by any other route gets the same answer.
    const settings = await readCalendarSettings(tx)
    const { orders: existingOrders, variantsById } = await readScheduleContext(tx)
    // Rebuilt as a moment only to ask the availability rules, which take a Date.
    // The day is the authority; this never round-trips back through the client.
    const candidateMoment = shopMoment(collectionDay)
    const unavailable = collectionDateUnavailableReason(candidateMoment, {
      variant,
      settings,
      orders: existingOrders,
      variantsById,
    })
    if (unavailable) {
      return { message: UNAVAILABLE_MESSAGE[unavailable], tone: "error" as const }
    }

    // Stored as a real moment, opening time included, rather than midnight —
    // built in the shop's timezone from the day the client chose, so the
    // server's own zone never shifts it.
    const collectionAt = collectionMomentFor(collectionDay, settings.earliestCollectionTime)

    // The customer is matched on email so a repeat order attaches to the same
    // record rather than creating a duplicate. Name and phone are refreshed from
    // what was just given, because the latest is the most likely to be current.
    const email = customer.email.trim().toLowerCase()
    const existing = await tx.customer.findFirst({ where: { email } })
    const customerRow = existing
      ? await tx.customer.update({
          where: { id: existing.id },
          data: { name: customer.name.trim(), phone: customer.phone?.trim() || null },
        })
      : await tx.customer.create({
          data: { name: customer.name.trim(), email, phone: customer.phone?.trim() || null },
        })

    // Frozen from the variant's price, exactly as consumedIngredients freezes
    // the recipe: repricing a product later must not restate what this customer
    // was quoted.
    const totalAmount = variant.priceAmount * quantity

    const order = await tx.order.create({
      data: {
        collectionDate: collectionAt,
        status: toDbStatus("Confirmed"),
        consumedIngredients: {},
        shortages: [],
        totalAmount,
        customerId: customerRow.id,
        items: { create: { variantId: productId, quantity } },
        statusHistory: {
          create: { status: toDbStatus("Confirmed"), actorId: actor?.id ?? null },
        },
      },
    })

    await renderEmailsForStatus(tx, order.id, "Confirmed")

    return {
      message: "Order confirmed — schedule it to book the kitchen",
      tone: "success" as const,
      orderId: order.id,
    }
  })

  return { ...result, state: await loadDashboardState() }
}

/**
 * Confirmed -> Scheduled. This is where oven capacity is first claimed, so it
 * runs the full feasibility check that createOrder no longer does: if the
 * schedule cannot absorb these units the order goes On Hold with its shortages,
 * exactly as an over-committed order always has.
 */
export async function scheduleOrder(
  orderId: string,
  actor: StaffMember | null = null
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order || toAppStatus(order.status) !== "Confirmed") {
      return { message: "Only a confirmed order can be scheduled.", tone: "error" as const }
    }

    const item = order.items[0]
    const variant = item ? await readVariant(tx, item.variantId) : null
    if (!variant || !item) {
      return { message: "That order's product is no longer available.", tone: "error" as const }
    }

    // Re-validated, not just re-costed. An order can sit Confirmed long enough
    // for its collection date to fall inside the lead time or onto a day the
    // shop has since closed.
    const settings = await readCalendarSettings(tx)
    const { orders: existingOrders, variantsById } = await readScheduleContext(tx)
    const unavailable = collectionDateUnavailableReason(order.collectionDate, {
      variant,
      settings,
      orders: existingOrders.filter((other) => other.id !== orderId),
      variantsById,
    })
    if (unavailable) {
      return { message: UNAVAILABLE_MESSAGE[unavailable], tone: "error" as const }
    }

    const productionDate = productionDateFor(order.collectionDate, variant.leadTimeDays)
    const onHand = await readOnHand(tx)
    const { lines, batchable } = await readProductionContext(tx)
    const candidate = { variantId: item.variantId, units: item.quantity, productionDate }
    const shortages = shortagesAfterAdding(onHand, lines, batchable, candidate)

    if (shortages.length > 0) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: toDbStatus("On Hold"),
          shortages: asJson(shortages),
          statusHistory: {
            create: {
              status: toDbStatus("On Hold"),
              note: "Couldn't schedule — insufficient stock",
              actorId: actor?.id ?? null,
            },
          },
        },
      })
      return { message: "Order put on hold — insufficient stock", tone: "warning" as const }
    }

    const assignee = await pickStaff(tx, productionDate)
    if (!assignee) {
      return {
        message: "Can't schedule — there's no staff to assign. Add staff in Staff Management.",
        tone: "error" as const,
      }
    }

    await tx.staff.update({ where: { id: assignee.id }, data: { orderCount: { increment: 1 } } })
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toDbStatus("Scheduled"),
        // The snapshot is written here, not at confirmation: it records what the
        // order draws once it is genuinely booked into a batch.
        consumedIngredients: perUnitShare(variant, item.quantity),
        shortages: [],
        statusHistory: {
          create: { status: toDbStatus("Scheduled"), actorId: actor?.id ?? null },
        },
        // Upsert, not create: an order can reach Scheduled more than once —
        // query it, clarify, schedule again — and ProductionAssignment.orderId
        // is unique, so a second create violates the relation. Re-assigning
        // clears releasedAt so the row counts toward workload again. Same shape
        // recheckOrder already uses.
        assignment: {
          upsert: {
            create: { staffId: assignee.id },
            update: { staffId: assignee.id, assignedAt: new Date(), releasedAt: null },
          },
        },
      },
    })

    await renderEmailsForStatus(tx, orderId, "Scheduled")

    return { message: `Order scheduled and assigned to ${assignee.name}`, tone: "success" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

export async function recheckOrder(
  orderId: string,
  actor: StaffMember | null = null
): Promise<MutationResult> {
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
              actorId: actor?.id ?? null,
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
            create: { status: toDbStatus("On Hold"), note: "Re-checked — still short", actorId: actor?.id ?? null },
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
          create: { status: toDbStatus("Scheduled"), note: "Re-checked and scheduled", actorId: actor?.id ?? null },
        },
        assignment: {
          upsert: {
            create: { staffId: assignee.id },
            update: { staffId: assignee.id, assignedAt: new Date(), releasedAt: null },
          },
        },
      },
    })
    await renderEmailsForStatus(tx, orderId, "Scheduled")

    return { message: `Order re-checked and scheduled — assigned to ${assignee.name}`, tone: "success" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

/**
 * Straight-line lifecycle moves. `schedule` is the one that matters: it is where
 * a confirmed order first asks for oven capacity, so it does not live here — it
 * has to run the full feasibility check and is handled by scheduleOrder below.
 */
const FORWARD_TRANSITIONS: Record<string, { from: OrderStatus; to: OrderStatus; message: string }> = {
  start: { from: "Scheduled", to: "In Production", message: "Order moved to production" },
  ready: {
    from: "In Production",
    to: "Ready for collection",
    message: "Order ready for collection",
  },
  complete: {
    from: "Ready for collection",
    to: "Collected or delivered",
    message: "Order marked collected",
  },
}

export async function advanceOrder(
  orderId: string,
  action: string,
  actor: StaffMember | null = null
): Promise<MutationResult> {
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
        statusHistory: {
          create: { status: toDbStatus(transition.to), actorId: actor?.id ?? null },
        },
      },
    })
    await renderEmailsForStatus(tx, orderId, transition.to)

    return { message: transition.message, tone: "success" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

/**
 * Hands a production slot back. Decrements the workload counter so round-robin
 * reflects current load; the assignment row itself stays, because Order Detail
 * still shows who had it.
 *
 * Shared by cancelling and by querying an order: both stop the work, so both
 * must stop counting it. Idempotent — an already-released assignment is left
 * alone rather than decremented twice.
 */
async function releaseAssignment(
  tx: Tx,
  orderId: string,
  assignment: { staffId: string; releasedAt: Date | null } | null
) {
  if (!assignment || assignment.releasedAt) return
  await tx.staff.update({
    where: { id: assignment.staffId },
    data: { orderCount: { decrement: 1 } },
  })
  await tx.productionAssignment.update({ where: { orderId }, data: { releasedAt: new Date() } })
  // Clamp: a counter must never go negative even if rows were edited directly.
  await tx.staff.updateMany({ where: { orderCount: { lt: 0 } }, data: { orderCount: 0 } })
}

/**
 * A collected order is not cancellable — the cake has gone. Refunding one is a
 * money event and leaves the status alone (see recordRefund).
 */
const CANCELLABLE: OrderStatus[] = [
  "Confirmed",
  "Scheduled",
  "In Production",
  "Ready for collection",
  "Details require clarification",
  "On Hold",
]

export async function cancelOrder(
  orderId: string,
  actor: StaffMember | null = null
): Promise<MutationResult> {
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

    await releaseAssignment(tx, orderId, order.assignment)

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toDbStatus("Cancelled"),
        statusHistory: { create: { status: toDbStatus("Cancelled"), actorId: actor?.id ?? null } },
      },
    })

    await renderEmailsForStatus(tx, orderId, "Cancelled")

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

/* ------------------------------------------------------------ clarification */

/**
 * Statuses an order can be queried from. A collected or cancelled order is
 * finished; querying it would imply work that is no longer pending.
 */
const QUERYABLE: OrderStatus[] = ["Confirmed", "Scheduled", "In Production", "On Hold"]

/**
 * Park an order on the customer. This releases oven capacity, because
 * "Details require clarification" is not a live status — which is the point:
 * the kitchen should not be holding ingredients for an order nobody can make
 * yet. Resolving it returns to Confirmed, and Schedule re-runs feasibility.
 */
export async function queryOrder(
  orderId: string,
  note: string | null,
  actor: StaffMember | null = null
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { assignment: true },
    })
    if (!order || !QUERYABLE.includes(toAppStatus(order.status))) {
      return { message: "That order can't be queried.", tone: "error" as const }
    }

    // It is giving up its slot, so the assignment is released the same way a
    // cancellation releases it — otherwise the round-robin keeps counting work
    // that is not happening.
    await releaseAssignment(tx, orderId, order.assignment)

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toDbStatus("Details require clarification"),
        shortages: [],
        statusHistory: {
          create: {
            status: toDbStatus("Details require clarification"),
            note: note?.trim() || null,
            actorId: actor?.id ?? null,
          },
        },
      },
    })
    return { message: "Order held — details require clarification", tone: "warning" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

/** Details sorted: back to Confirmed, where Schedule can claim capacity again. */
export async function resolveOrderQuery(
  orderId: string,
  actor: StaffMember | null = null
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order || toAppStatus(order.status) !== "Details require clarification") {
      return { message: "That order has no open query.", tone: "error" as const }
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toDbStatus("Confirmed"),
        statusHistory: {
          create: {
            status: toDbStatus("Confirmed"),
            note: "Details clarified",
            actorId: actor?.id ?? null,
          },
        },
      },
    })
    return { message: "Details clarified — schedule it to book the kitchen", tone: "success" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

/* ------------------------------------------------------------------- money */

/**
 * Records money in or out and re-derives the order's running totals from the
 * ledger.
 *
 * The totals on the order are a cache of the events, never set by hand: summing
 * them here in one place is what stops amountPaid and the ledger disagreeing.
 * Nothing about a payment or a refund touches order status or stock — a refund
 * is a money event, and if the cake is also not to be made the order is
 * cancelled, which is what frees the ingredients.
 */
async function recordMoney(
  tx: Tx,
  orderId: string,
  kind: "Payment" | "Refund",
  amount: number,
  actor: StaffMember | null,
  note?: string | null
) {
  await tx.paymentEvent.create({
    data: { orderId, kind, amount, actorId: actor?.id ?? null, note: note?.trim() || null },
  })
  const events = await tx.paymentEvent.findMany({ where: { orderId } })
  const paid = events.filter((e) => e.kind === "Payment").reduce((sum, e) => sum + e.amount, 0)
  const refunded = events.filter((e) => e.kind === "Refund").reduce((sum, e) => sum + e.amount, 0)
  await tx.order.update({ where: { id: orderId }, data: { amountPaid: paid, amountRefunded: refunded } })
}

/** Amounts arrive as pence and must be whole, positive and not absurd. */
function invalidAmount(amount: number): string | null {
  if (!Number.isInteger(amount)) return "Amount must be a whole number of pence."
  if (amount <= 0) return "Amount must be more than zero."
  return null
}

export async function recordPayment(
  orderId: string,
  amount: number,
  actor: StaffMember | null = null,
  note?: string | null
): Promise<MutationResult> {
  const invalid = invalidAmount(amount)
  if (invalid) return { state: await loadDashboardState(), message: invalid, tone: "error" }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) return { message: "Unknown order.", tone: "error" as const }
    if (order.amountPaid + amount > order.totalAmount) {
      return {
        message: "That would take the order over its total. Record a smaller payment.",
        tone: "error" as const,
      }
    }
    await recordMoney(tx, orderId, "Payment", amount, actor, note)
    return { message: `Payment of ${formatMoney(amount)} recorded`, tone: "success" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

export async function recordRefund(
  orderId: string,
  amount: number,
  actor: StaffMember | null = null,
  note?: string | null
): Promise<MutationResult> {
  const invalid = invalidAmount(amount)
  if (invalid) return { state: await loadDashboardState(), message: invalid, tone: "error" }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) return { message: "Unknown order.", tone: "error" as const }
    // You cannot refund more than came in. Without this, amountRefunded could
    // exceed amountPaid and the derived state would read "Refunded" for an order
    // that was never fully paid.
    if (order.amountRefunded + amount > order.amountPaid) {
      return {
        message: "That's more than has been paid on this order.",
        tone: "error" as const,
      }
    }
    await recordMoney(tx, orderId, "Refund", amount, actor, note)
    return { message: `Refund of ${formatMoney(amount)} recorded`, tone: "success" as const }
  })

  return { ...result, state: await loadDashboardState() }
}

/**
 * The common case, as one action: stop making it and give the money back.
 *
 * Two events are recorded, not one. The cancel is what releases the ingredients;
 * the refund only moves money. Keeping them separate in the history is what lets
 * a refund on a collected order — where no ingredients come back — be recorded
 * by the same ledger without pretending the order was un-collected.
 */
export async function cancelAndRefundOrder(
  orderId: string,
  amount: number,
  actor: StaffMember | null = null,
  note?: string | null
): Promise<MutationResult> {
  const cancelled = await cancelOrder(orderId, actor)
  if (cancelled.tone === "error") return cancelled
  const refunded = await recordRefund(orderId, amount, actor, note)
  if (refunded.tone === "error") {
    // The cancel stands — it is correct on its own, and silently reversing it
    // would leave the kitchen holding an order the operator has stopped.
    return {
      ...refunded,
      message: `Order cancelled, but the refund was not recorded: ${refunded.message}`,
      tone: "warning",
    }
  }
  return { ...refunded, message: `Order cancelled and ${formatMoney(amount)} refunded` }
}
