import { prisma } from "@/lib/prisma"
import {
  calculateIngredientsNeeded,
  deductStock,
  findShortages,
  restockIngredients,
} from "@/lib/order-engine"
import { loadDashboardState, readCalendarSettings } from "@/lib/server/state"
import {
  applyEarliestCollectionTime,
  collectionDateUnavailableReason,
  dayKey,
  productionDateFor,
  type UnavailableReason,
} from "@/lib/production-schedule"
import type { DashboardState } from "@/lib/server/serialize"
import type {
  IngredientAmounts,
  IngredientKey,
  Order,
  OrderStatus,
  ProductVariant,
} from "@/lib/types"

/**
 * Server-side order scheduling. The decision rules are unchanged from the
 * in-memory prototype — the same four pure functions in lib/order-engine.ts still
 * decide everything; they now read stock out of the database inside a transaction
 * instead of out of React state, and write the result back.
 *
 * Everything runs in an interactive transaction because the read-decide-write
 * sequence is no longer atomic the way a single React setState was: two orders
 * submitted at once could both see the same stock and both deduct it.
 */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Current available stock as the plain record the engine functions expect. */
async function readStock(tx: Tx): Promise<Record<IngredientKey, number>> {
  const ingredients = await tx.ingredient.findMany({ include: { stockLevel: true } })
  const stock = {} as Record<IngredientKey, number>
  for (const ingredient of ingredients) {
    stock[ingredient.key as IngredientKey] = ingredient.stockLevel?.available ?? 0
  }
  return stock
}

/** Writes back only the ingredients whose available amount actually changed. */
async function writeStock(
  tx: Tx,
  before: Record<IngredientKey, number>,
  after: Record<IngredientKey, number>,
  { raiseCapacity = false }: { raiseCapacity?: boolean } = {}
) {
  const ingredients = await tx.ingredient.findMany()
  for (const ingredient of ingredients) {
    const key = ingredient.key as IngredientKey
    if (before[key] === after[key]) continue
    const delta = after[key] - before[key]
    await tx.stockLevel.update({
      where: { ingredientId: ingredient.id },
      data: {
        available: after[key],
        // A restock genuinely adds stock to the pool, so it lifts capacity too.
        // Cancelling an order returns stock that was already counted in capacity,
        // so capacity must NOT move there or committed would drift.
        ...(raiseCapacity && delta > 0 ? { capacity: { increment: delta } } : {}),
      },
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
      variant.recipeItems.map((item) => [item.ingredient.key as IngredientKey, item.amountPerUnit])
    ),
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
    status: (isKnownStatus(order.status) ? order.status : "On Hold") as OrderStatus,
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
    if (order.status === "Cancelled" || order.status === "On Hold") continue
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

    const needed = calculateIngredientsNeeded(variant, quantity)
    const stock = await readStock(tx)
    const shortages = findShortages(needed, stock)

    if (shortages.length === 0) {
      const assignee = await pickStaff(tx, productionDate)
      if (!assignee) {
        return {
          message: "Can't schedule — there's no staff to assign. Add staff in Staff Management.",
          tone: "error" as const,
        }
      }

      await writeStock(tx, stock, deductStock(stock, needed))
      await tx.staff.update({
        where: { id: assignee.id },
        data: { orderCount: { increment: 1 } },
      })

      const order = await tx.order.create({
        data: {
          collectionDate: collectionAt,
          status: "Scheduled",
          consumedIngredients: JSON.stringify(needed),
          shortages: "[]",
          items: { create: { variantId: productId, quantity } },
          statusHistory: { create: { status: "Scheduled" } },
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
        status: "On Hold",
        consumedIngredients: "{}",
        shortages: JSON.stringify(shortages),
        items: { create: { variantId: productId, quantity } },
        statusHistory: { create: { status: "On Hold" } },
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
    if (!order || order.status !== "On Hold") {
      return { message: "Order can't be re-checked.", tone: "error" as const }
    }

    const line = order.items[0]
    const variant = line ? await readVariant(tx, line.variantId) : null
    if (!variant) {
      return { message: "Can't re-check — this product's recipe no longer exists.", tone: "error" as const }
    }

    const needed = calculateIngredientsNeeded(variant, line!.quantity)
    const stock = await readStock(tx)
    const shortages = findShortages(needed, stock)

    if (shortages.length > 0) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          shortages: JSON.stringify(shortages),
          statusHistory: { create: { status: "On Hold", note: "Re-checked — still short" } },
        },
      })
      return { message: "Still insufficient stock", tone: "warning" as const }
    }

    // Re-checking deliberately does not re-validate the collection date: the date
    // was legal when the order was taken, and an order going On Hold on stock is
    // not a reason to also refuse the customer's agreed day. It does assign
    // against that order's production day, same as a fresh one.
    const productionDate = productionDateFor(order.collectionDate, variant.leadTimeDays)
    const assignee = await pickStaff(tx, productionDate)
    if (!assignee) {
      return {
        message: "Can't re-check — there's no staff to assign. Add staff in Staff Management.",
        tone: "error" as const,
      }
    }

    await writeStock(tx, stock, deductStock(stock, needed))
    await tx.staff.update({ where: { id: assignee.id }, data: { orderCount: { increment: 1 } } })
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "Scheduled",
        shortages: "[]",
        consumedIngredients: JSON.stringify(needed),
        statusHistory: { create: { status: "Scheduled", note: "Re-checked and scheduled" } },
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
    if (!order || order.status !== transition.from) {
      return { message: "Order is not in a state for that action.", tone: "error" as const }
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: transition.to, statusHistory: { create: { status: transition.to } } },
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
    if (!order || !CANCELLABLE.includes(order.status as OrderStatus)) {
      return { message: "Order can't be cancelled.", tone: "error" as const }
    }

    const consumed = JSON.parse(order.consumedIngredients) as IngredientAmounts
    const hadConsumedStock = Object.keys(consumed).length > 0
    if (hadConsumedStock) {
      const stock = await readStock(tx)
      // Refund the frozen snapshot, never a recomputation from the live recipe.
      await writeStock(tx, stock, restockIngredients(stock, consumed))
    }

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
      data: { status: "Cancelled", statusHistory: { create: { status: "Cancelled" } } },
    })

    return {
      message: hadConsumedStock ? "Order cancelled — ingredients restocked" : "Order cancelled",
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

    const stock = await readStock(tx)
    const key = ingredient.key as IngredientKey
    await writeStock(tx, stock, restockIngredients(stock, { [key]: amount }), { raiseCapacity: true })
    await tx.restockEntry.create({ data: { ingredientId: ingredient.id, amount } })

    return {
      message: `Restocked ${amount}${ingredient.unit} ${ingredient.label.toLowerCase()}`,
      tone: "success" as const,
    }
  })

  return { ...result, state: await loadDashboardState() }
}
