import { prisma } from "@/lib/prisma"
import {
  demandByProductionDay,
  productionLinesFrom,
  totalCommitted,
  type BatchableVariant,
  type StockRecord,
} from "@/lib/stock-projection"
import { INITIAL_CALENDAR_SETTINGS } from "@/lib/mock-data"
import type {
  CalendarSettings,
  IngredientKey,
  Order,
  ProductVariant,
  StaffMember,
} from "@/lib/types"
import {
  type DashboardState,
  parseConsumed,
  parseShortages,
  type SerializedOrder,
  toAppStatus,
} from "@/lib/server/serialize"

/** Any Prisma client or interactive-transaction client. */
export type Db = Pick<
  typeof prisma,
  "ingredient" | "productVariant" | "staff" | "order" | "restockEntry" | "calendarSettings"
>

/**
 * Reads the singleton calendar settings row, falling back to the seed values if
 * it is somehow missing — the app must still render rather than 500 on a
 * half-seeded database.
 */
export async function readCalendarSettings(db: Db = prisma): Promise<CalendarSettings> {
  const row = await db.calendarSettings.findUnique({ where: { id: 1 } })
  if (!row) return INITIAL_CALENDAR_SETTINGS
  return {
    // A real Int[] column now, so there is nothing to parse.
    blockedWeekdays: row.blockedWeekdays as CalendarSettings["blockedWeekdays"],
    earliestCollectionTime: row.earliestCollectionTime,
    maxOrdersPerProductionDay: row.maxOrdersPerProductionDay,
  }
}

/**
 * Loads the whole dashboard in one pass and shapes it exactly like the state
 * CrmDashboard used to hold locally. One round trip keeps every screen
 * consistent with every other: before, all screens read the same React state, so
 * they could never disagree; served piecemeal they could.
 */
export async function loadDashboardState(db: Db = prisma): Promise<DashboardState> {
  const [ingredients, variants, staff, orders, restocks, calendarSettings] = await Promise.all([
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
    readCalendarSettings(db),
  ])

  const onHand = {} as StockRecord
  for (const ingredient of ingredients) {
    onHand[ingredient.key as IngredientKey] = ingredient.stockLevel?.onHand ?? 0
  }

  const serializedVariants: ProductVariant[] = variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    description: variant.description,
    servings: variant.servings,
    requires: Object.fromEntries(
      variant.recipeItems.map((item) => [item.ingredient.key as IngredientKey, item.amountPerBatch])
    ),
    unitsPerBatch: variant.unitsPerBatch,
    leadTimeDays: variant.leadTimeDays,
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
      status: toAppStatus(order.status),
      // The assignment row is kept after cancellation as a historical record, so
      // Order Detail still shows who had the order; only the workload counter
      // is released.
      assignedStaff: order.assignment?.staff.name ?? null,
      shortages: parseShortages(order.shortages),
      consumedIngredients: parseConsumed(order.consumedIngredients),
      statusHistory: order.statusHistory.map((event) => ({
        status: toAppStatus(event.status),
        at: event.at.getTime(),
        note: event.note ?? undefined,
      })),
      createdAt: order.createdAt.getTime(),
    } satisfies SerializedOrder
  })

  // Demand per production day, derived from the live orders' frozen snapshots.
  // Everything the Stock Levels screen shows now comes from here rather than from
  // two stored columns: "committed" is what live orders still owe, and the
  // headline figure is what is left uncommitted.
  const variantLeadTimes = Object.fromEntries(
    variants.map((variant) => [variant.id, { leadTimeDays: variant.leadTimeDays }])
  )
  const batchable: Record<string, BatchableVariant> = Object.fromEntries(
    serializedVariants.map((variant) => [
      variant.id,
      { requires: variant.requires, unitsPerBatch: variant.unitsPerBatch },
    ])
  )
  const demand = demandByProductionDay(
    productionLinesFrom(
      serializedOrders.map((order) => ({
        collectionDate: new Date(order.collectionDate),
        productId: order.productId,
        status: order.status,
        quantity: order.quantity,
      })),
      variantLeadTimes
    ),
    batchable
  )
  const committed = totalCommitted(demand)
  const uncommitted = {} as StockRecord
  for (const ingredient of ingredients) {
    const key = ingredient.key as IngredientKey
    uncommitted[key] = (onHand[key] ?? 0) - (committed[key] ?? 0)
  }

  return {
    variants: serializedVariants,
    ingredients: ingredients.map((ingredient) => ({
      key: ingredient.key as IngredientKey,
      label: ingredient.label,
      unit: ingredient.unit,
    })),
    stock: uncommitted,
    capacity: onHand,
    productionDemand: demand.map((day) => ({
      day: day.day,
      date: day.date.toISOString(),
      amounts: day.amounts,
      orderCount: day.orderCount,
      variants: day.variants,
    })),
    staff: serializedStaff,
    orders: serializedOrders,
    restockLog: restocks.map((entry) => ({
      id: entry.id,
      ingredient: entry.ingredient.key as IngredientKey,
      amount: entry.amount,
      at: entry.at.getTime(),
    })),
    calendarSettings,
  }
}

/** Re-hydrates a wire order back into the client-side Order shape. */
export function reviveOrder(order: SerializedOrder): Order {
  return { ...order, collectionDate: new Date(order.collectionDate) }
}
