import { prisma } from "@/lib/prisma"
import {
  calculateIngredientsNeeded,
  deductStock,
  findShortages,
  restockIngredients,
} from "@/lib/order-engine"
import { loadDashboardState } from "@/lib/server/state"
import type { DashboardState } from "@/lib/server/serialize"
import type { IngredientAmounts, IngredientKey, OrderStatus, ProductVariant } from "@/lib/types"

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
  }
}

/**
 * Round-robin: the staff member with the fewest orders currently assigned, ties
 * broken by roster position. Identical to the in-memory
 * `[...staff].sort((a, b) => a.orderCount - b.orderCount)[0]`.
 */
async function pickStaff(tx: Tx) {
  const staff = await tx.staff.findMany({
    orderBy: [{ orderCount: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    take: 1,
  })
  return staff[0] ?? null
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

    const needed = calculateIngredientsNeeded(variant, quantity)
    const stock = await readStock(tx)
    const shortages = findShortages(needed, stock)

    if (shortages.length === 0) {
      const assignee = await pickStaff(tx)
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
          collectionDate,
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
        collectionDate,
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

    const assignee = await pickStaff(tx)
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
