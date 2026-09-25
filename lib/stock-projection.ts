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
 * Forward stock projection over a dated ledger, in whole batches.
 *
 * Two ideas stack here.
 *
 * The ledger: StockLevel.onHand is what is physically in the building, and
 * scheduling an order does not touch it. Instead each live order puts *units* on
 * its production day, and the balance on any future day is on-hand minus every
 * production day's draw up to and including it.
 *
 * The batching: the kitchen does not make units, it makes batches. One Suprema
 * batch draws its recipe and yields two cakes whether one or two were ordered.
 * So a day's draw for a variant is ceil(units / unitsPerBatch) x the batch
 * recipe. Two consequences fall straight out of that and are not special-cased
 * anywhere: a single Suprema costs a whole batch and leaves a spare unit, and a
 * second Suprema on the same production day is free, because it is absorbed by
 * the batch that was already being made.
 *
 * Demand is therefore derived from unit counts, NOT summed from orders'
 * consumedIngredients snapshots. It cannot be summed from them: a batch's cost
 * belongs to the day, and splitting it across the orders that share it is a
 * question of attribution, which cannot be reversed back into the day's true
 * draw without re-introducing the rounding.
 */

/** Statuses whose units are still booked into production. */
const LIVE_STATUSES = new Set(["Scheduled", "In Production", "Ready", "Completed"])

export type StockRecord = Record<IngredientKey, number>

/** One order's contribution to a production day: some units of one variant. */
export interface ProductionLine {
  variantId: string
  units: number
  productionDate: Date
}

/** What a recipe needs to be batched: the batch recipe and its yield. */
export type BatchableVariant = Pick<ProductVariant, "requires" | "unitsPerBatch">

export interface VariantBatchDemand {
  variantId: string
  /** Units actually ordered for this variant on this day. */
  units: number
  /** Whole batches the kitchen has to run to cover them. */
  batches: number
  /** Units those batches produce — always >= units. */
  capacityUnits: number
  /** Units produced but not ordered. Spare capacity a later order can take. */
  surplusUnits: number
  /** batches x the batch recipe. */
  amounts: IngredientAmounts
}

export interface ProductionDayDemand {
  /** yyyy-mm-dd identity for the production day. */
  day: string
  date: Date
  /** Total ingredient draw across every variant batched that day. */
  amounts: IngredientAmounts
  /** How many orders are produced that day. */
  orderCount: number
  /** Per-variant batch breakdown, for showing the kitchen what to run. */
  variants: VariantBatchDemand[]
}

/** Whole batches needed to cover `units`. A yield of 0 or less is treated as 1. */
export function batchesFor(units: number, unitsPerBatch: number): number {
  if (units <= 0) return 0
  return Math.ceil(units / Math.max(1, unitsPerBatch))
}

type ProjectableOrder = Pick<Order, "collectionDate" | "productId" | "status" | "quantity">

/**
 * Turns live orders into production lines. Orders that were never scheduled
 * (On Hold) or have been cancelled put nothing into production.
 */
export function productionLinesFrom(
  orders: ProjectableOrder[],
  variantsById: Record<string, Pick<ProductVariant, "leadTimeDays">>
): ProductionLine[] {
  const lines: ProductionLine[] = []
  for (const order of orders) {
    if (!LIVE_STATUSES.has(order.status)) continue
    const productionDate = productionDateForOrder(order, variantsById)
    if (!productionDate) continue
    lines.push({ variantId: order.productId, units: order.quantity, productionDate })
  }
  return lines
}

/**
 * Ingredient demand per production day, oldest first, batched per variant.
 *
 * Grouping is by (day, variant): two different products made on the same day are
 * separate batches, and the same product ordered twice for the same day is one
 * pool of units that may or may not need a second batch.
 */
export function demandByProductionDay(
  lines: ProductionLine[],
  variantsById: Record<string, BatchableVariant>
): ProductionDayDemand[] {
  const byDay = new Map<string, { date: Date; units: Map<string, number>; orderCount: number }>()

  for (const line of lines) {
    const key = dayKey(line.productionDate)
    const day = byDay.get(key) ?? { date: line.productionDate, units: new Map(), orderCount: 0 }
    day.units.set(line.variantId, (day.units.get(line.variantId) ?? 0) + line.units)
    day.orderCount += 1
    byDay.set(key, day)
  }

  const days: ProductionDayDemand[] = []
  for (const [key, day] of byDay) {
    const variants: VariantBatchDemand[] = []
    const total: IngredientAmounts = {}

    for (const [variantId, units] of day.units) {
      const variant = variantsById[variantId]
      // A variant that has been archived away leaves no recipe to batch against;
      // skip rather than invent a draw for it.
      if (!variant) continue
      const batches = batchesFor(units, variant.unitsPerBatch)
      const capacityUnits = batches * Math.max(1, variant.unitsPerBatch)
      const amounts: IngredientAmounts = {}
      for (const ingredient of INGREDIENT_ORDER) {
        const perBatch = variant.requires[ingredient]
        if (!perBatch) continue
        const amount = perBatch * batches
        amounts[ingredient] = amount
        total[ingredient] = (total[ingredient] ?? 0) + amount
      }
      variants.push({
        variantId,
        units,
        batches,
        capacityUnits,
        surplusUnits: capacityUnits - units,
        amounts,
      })
    }

    variants.sort((a, b) => a.variantId.localeCompare(b.variantId))
    days.push({ day: key, date: day.date, amounts: total, orderCount: day.orderCount, variants })
  }

  return days.sort((a, b) => a.date.getTime() - b.date.getTime())
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

/**
 * Total still owed to live scheduled orders, across every production day. This is
 * the "committed" figure the Stock Levels screen shows; under the ledger it is
 * derived rather than being the gap between two stored columns. Note it counts
 * whole batches, so it includes ingredients going into surplus units nobody has
 * ordered yet — which is the truth: they are spoken for.
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
 * Would adding this order keep every production day solvent?
 *
 * The candidate is added as units and the whole schedule is re-batched, rather
 * than a fixed ingredient amount being subtracted. That is the only way surplus
 * can be absorbed: an extra Suprema on a day already running a half-empty batch
 * changes the unit count but not the batch count, so the answer is legitimately
 * "costs nothing".
 *
 * Checks *every* day, not just the candidate's own: demand inserted early draws
 * on the same pool a later day was counting on, so a new Tuesday order can push
 * Friday negative while Tuesday itself looks healthy.
 */
export function shortagesAfterAdding(
  onHand: StockRecord,
  existingLines: ProductionLine[],
  variantsById: Record<string, BatchableVariant>,
  candidate: ProductionLine
): ShortageReason[] {
  const projected = projectBalances(
    onHand,
    demandByProductionDay([...existingLines, candidate], variantsById)
  )

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

/**
 * What adding this order would actually cost the kitchen: the extra ingredients
 * drawn once the day is re-batched. Zero when the order slots into surplus that
 * was already going to be produced.
 */
export function marginalDraw(
  existingLines: ProductionLine[],
  variantsById: Record<string, BatchableVariant>,
  candidate: ProductionLine
): IngredientAmounts {
  const before = totalCommitted(demandByProductionDay(existingLines, variantsById))
  const after = totalCommitted(demandByProductionDay([...existingLines, candidate], variantsById))
  const draw: IngredientAmounts = {}
  for (const ingredient of INGREDIENT_ORDER) {
    const delta = (after[ingredient] ?? 0) - (before[ingredient] ?? 0)
    if (delta) draw[ingredient] = delta
  }
  return draw
}
