import { INGREDIENT_ORDER } from "@/lib/mock-data"
import { dayKey, productionDateForOrder } from "@/lib/production-schedule"
import type {
  IngredientAmounts,
  IngredientKey,
  Order,
  ProductVariant,
  ShortageReason,
} from "@/lib/types"

/**
 * Forward stock projection: stock with a time dimension.
 *
 * The model is a dated ledger. StockLevel.available is what is physically in the
 * building — scheduling an order no longer touches it. Instead every live
 * scheduled order contributes demand on its *production* day, and the balance on
 * any future day is on-hand minus every production day's demand up to and
 * including it.
 *
 * The thing this buys over the old running total is that "is there enough?" stops
 * being a question about right now. Inserting an order that produces on Tuesday
 * can starve one that produces on Friday, and a single global number cannot see
 * that. Feasibility here means no day's balance goes negative — not merely that
 * today's figure is positive.
 *
 * Orders that never scheduled (On Hold) carry an empty snapshot and so contribute
 * nothing, which is exactly right: they were never promised any stock.
 */

/** Statuses whose ingredients are still spoken for. */
const LIVE_STATUSES = new Set(["Scheduled", "In Production", "Ready", "Completed"])

export type StockRecord = Record<IngredientKey, number>

export interface ProductionDayDemand {
  /** dayKey() of the production day. */
  day: string
  date: Date
  amounts: IngredientAmounts
  /** How many orders are produced that day. */
  orderCount: number
}

type ProjectableOrder = Pick<
  Order,
  "collectionDate" | "productId" | "status" | "consumedIngredients"
>

/**
 * Ingredient demand per production day, oldest first.
 *
 * Demand comes from each order's frozen consumedIngredients snapshot rather than
 * from a fresh recipe calculation, so a recipe edited after an order was taken
 * does not silently re-price work already committed — the same reason the snapshot
 * exists in the first place.
 */
export function demandByProductionDay(
  orders: ProjectableOrder[],
  variantsById: Record<string, Pick<ProductVariant, "leadTimeDays">>
): ProductionDayDemand[] {
  const byDay = new Map<string, ProductionDayDemand>()

  for (const order of orders) {
    if (!LIVE_STATUSES.has(order.status)) continue
    const productionDate = productionDateForOrder(order, variantsById)
    if (!productionDate) continue

    const key = dayKey(productionDate)
    const entry = byDay.get(key) ?? { day: key, date: productionDate, amounts: {}, orderCount: 0 }
    for (const ingredient of INGREDIENT_ORDER) {
      const amount = order.consumedIngredients[ingredient]
      if (amount) entry.amounts[ingredient] = (entry.amounts[ingredient] ?? 0) + amount
    }
    entry.orderCount += 1
    byDay.set(key, entry)
  }

  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

export interface ProjectedDay extends ProductionDayDemand {
  /** On-hand minus all demand up to and including this day, per ingredient. */
  balances: StockRecord
}

/**
 * Walks the production days in order, carrying the running balance forward.
 *
 * `expectedRestocks` is accepted for completeness but is empty in practice today:
 * a restock records stock that has just arrived, so it is already inside onHand by
 * the time it is written. The parameter is the seam for dated deliveries later —
 * including a term for them now would double-count.
 */
export function projectBalances(
  onHand: StockRecord,
  demand: ProductionDayDemand[],
  expectedRestocks: { date: Date; amounts: IngredientAmounts }[] = []
): ProjectedDay[] {
  const running: StockRecord = { ...onHand }
  const projected: ProjectedDay[] = []

  for (const day of demand) {
    for (const restock of expectedRestocks) {
      if (dayKey(restock.date) !== day.day) continue
      for (const ingredient of INGREDIENT_ORDER) {
        const amount = restock.amounts[ingredient]
        if (amount) running[ingredient] = (running[ingredient] ?? 0) + amount
      }
    }
    for (const ingredient of INGREDIENT_ORDER) {
      const amount = day.amounts[ingredient]
      if (amount) running[ingredient] = (running[ingredient] ?? 0) - amount
    }
    projected.push({ ...day, balances: { ...running } })
  }

  return projected
}

/** The projected balance on a given date: the last projected day at or before it. */
export function balanceOn(onHand: StockRecord, demand: ProductionDayDemand[], date: Date): StockRecord {
  const target = dayKey(date)
  const projected = projectBalances(onHand, demand)
  let balances: StockRecord = { ...onHand }
  for (const day of projected) {
    if (day.day > target) break
    balances = day.balances
  }
  return balances
}

/**
 * Total still owed to live scheduled orders, across every production day. This is
 * the "committed" figure the Stock Levels screen shows; under the ledger it is
 * derived rather than being the gap between two stored columns.
 */
export function totalCommitted(demand: ProductionDayDemand[]): StockRecord {
  const committed = {} as StockRecord
  for (const ingredient of INGREDIENT_ORDER) committed[ingredient] = 0
  for (const day of demand) {
    for (const ingredient of INGREDIENT_ORDER) {
      const amount = day.amounts[ingredient]
      if (amount) committed[ingredient] += amount
    }
  }
  return committed
}

/**
 * Would adding this demand on this production day keep every day solvent?
 *
 * Returns the shortages that adding it would cause, worst day first per
 * ingredient. Empty means the whole schedule still works.
 *
 * Deliberately checks *every* day rather than only the new order's own: demand
 * inserted early is drawn from the same pool a later order was counting on, so a
 * new Tuesday order can push Friday's balance negative while Tuesday itself looks
 * perfectly healthy.
 */
export function shortagesAfterAdding(
  onHand: StockRecord,
  demand: ProductionDayDemand[],
  addition: IngredientAmounts,
  productionDate: Date
): ShortageReason[] {
  const key = dayKey(productionDate)
  const merged = demand.map((day) => ({ ...day, amounts: { ...day.amounts } }))
  let target = merged.find((day) => day.day === key)
  if (!target) {
    target = { day: key, date: productionDate, amounts: {}, orderCount: 0 }
    merged.push(target)
    merged.sort((a, b) => a.date.getTime() - b.date.getTime())
  }
  for (const ingredient of INGREDIENT_ORDER) {
    const amount = addition[ingredient]
    if (amount) target.amounts[ingredient] = (target.amounts[ingredient] ?? 0) + amount
  }

  const projected = projectBalances(onHand, merged)
  const shortages: ShortageReason[] = []
  for (const ingredient of INGREDIENT_ORDER) {
    let worst = onHand[ingredient] ?? 0
    for (const day of projected) {
      const balance = day.balances[ingredient] ?? 0
      if (balance < worst) worst = balance
    }
    if (worst < 0) shortages.push({ ingredient, shortBy: Math.round(-worst * 100) / 100 })
  }
  return shortages
}
