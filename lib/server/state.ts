import { prisma } from "@/lib/prisma"
import type { IngredientKey, Order, ProductVariant, StaffMember } from "@/lib/types"
import {
  type DashboardState,
  isOrderStatus,
  parseConsumed,
  parseShortages,
  type SerializedOrder,
} from "@/lib/server/serialize"

/** Any Prisma client or interactive-transaction client. */
export type Db = Pick<typeof prisma, "ingredient" | "productVariant" | "staff" | "order" | "restockEntry">

/**
 * Loads the whole dashboard in one pass and shapes it exactly like the state
 * CrmDashboard used to hold locally. One round trip keeps every screen
 * consistent with every other: before, all screens read the same React state, so
 * they could never disagree; served piecemeal they could.
 */
export async function loadDashboardState(db: Db = prisma): Promise<DashboardState> {
  const [ingredients, variants, staff, orders, restocks] = await Promise.all([
    db.ingredient.findMany({ orderBy: { sortOrder: "asc" }, include: { stockLevel: true } }),
    db.productVariant.findMany({
      where: { archived: false },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { recipeItems: { include: { ingredient: true } } },
    }),
    // sortOrder is the explicit tie-break the in-memory array got for free.
    db.staff.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        statusHistory: { orderBy: { at: "asc" } },
        assignment: { include: { staff: true } },
      },
    }),
    db.restockEntry.findMany({ orderBy: { at: "desc" }, include: { ingredient: true } }),
  ])

  const stock = {} as Record<IngredientKey, number>
  const capacity = {} as Record<IngredientKey, number>
  for (const ingredient of ingredients) {
    const key = ingredient.key as IngredientKey
    stock[key] = ingredient.stockLevel?.available ?? 0
    capacity[key] = ingredient.stockLevel?.capacity ?? 0
  }

  const serializedVariants: ProductVariant[] = variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    description: variant.description,
    servings: variant.servings,
    requires: Object.fromEntries(
      variant.recipeItems.map((item) => [item.ingredient.key as IngredientKey, item.amountPerUnit])
    ),
  }))

  const serializedStaff: StaffMember[] = staff.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role === "admin" ? "admin" : "staff",
    orderCount: member.orderCount,
  }))

  const serializedOrders: SerializedOrder[] = orders.map((order) => {
    const line = order.items[0]
    return {
      id: order.id,
      productId: line?.variantId ?? "",
      quantity: line?.quantity ?? 0,
      collectionDate: order.collectionDate.toISOString(),
      status: isOrderStatus(order.status) ? order.status : "On Hold",
      // The assignment row is kept after cancellation as a historical record, so
      // Order Detail still shows who had the order; only the workload counter
      // is released.
      assignedStaff: order.assignment?.staff.name ?? null,
      shortages: parseShortages(order.shortages),
      consumedIngredients: parseConsumed(order.consumedIngredients),
      statusHistory: order.statusHistory.map((event) => ({
        status: isOrderStatus(event.status) ? event.status : "On Hold",
        at: event.at.getTime(),
        note: event.note ?? undefined,
      })),
      createdAt: order.createdAt.getTime(),
    } satisfies SerializedOrder
  })

  return {
    variants: serializedVariants,
    ingredients: ingredients.map((ingredient) => ({
      key: ingredient.key as IngredientKey,
      label: ingredient.label,
      unit: ingredient.unit,
    })),
    stock,
    capacity,
    staff: serializedStaff,
    orders: serializedOrders,
    restockLog: restocks.map((entry) => ({
      id: entry.id,
      ingredient: entry.ingredient.key as IngredientKey,
      amount: entry.amount,
      at: entry.at.getTime(),
    })),
  }
}

/** Re-hydrates a wire order back into the client-side Order shape. */
export function reviveOrder(order: SerializedOrder): Order {
  return { ...order, collectionDate: new Date(order.collectionDate) }
}
