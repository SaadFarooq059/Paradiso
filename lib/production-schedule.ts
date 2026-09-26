import { addDays, startOfDay } from "date-fns"

import type {
  CalendarSettings,
  Order,
  OrderStatus,
  ProductVariant,
  Weekday,
} from "@/lib/types"

/**
 * The date dimension the engine previously had none of.
 *
 * Everything here is a pure function over plain values so the same rules run in
 * two places without drifting: the server enforces them when an order is
 * created, and the New Order date picker uses them to grey out days the server
 * would refuse. A rule that only existed on one side would eventually disagree
 * with the other.
 *
 * All reasoning is in whole local calendar days. Times of day are a separate
 * concern (see applyEarliestCollectionTime) — mixing the two is what makes date
 * arithmetic go wrong across daylight-saving boundaries.
 */

/** Orders occupying a production day. On Hold was never scheduled; Cancelled gave its slot back. */
const OCCUPIES_PRODUCTION_DAY: OrderStatus[] = [
  "Scheduled",
  "In Production",
  "Ready",
  "Completed",
]

/**
 * Stable per-day grouping key. Deliberately ISO (yyyy-mm-dd) rather than a
 * localised string: this is an internal identity, never shown to anyone, and it
 * must not change with the machine's locale.
 */
export function dayKey(date: Date): string {
  const d = startOfDay(date)
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * The day production must start for an order to be ready on its collection date.
 * Derived, never stored — see ProductVariant.leadTimeDays for why.
 */
export function productionDateFor(collectionDate: Date, leadTimeDays: number): Date {
  return addDays(startOfDay(collectionDate), -leadTimeDays)
}

/** The production day for an order, given the variant it was placed against. */
export function productionDateForOrder(
  order: Pick<Order, "collectionDate" | "productId">,
  variantsById: Record<string, Pick<ProductVariant, "leadTimeDays">>
): Date | null {
  const variant = variantsById[order.productId]
  if (!variant) return null
  return productionDateFor(order.collectionDate, variant.leadTimeDays)
}

export function isBlockedWeekday(date: Date, blockedWeekdays: Weekday[]): boolean {
  return blockedWeekdays.includes(startOfDay(date).getDay() as Weekday)
}

/**
 * Stamps the shop's opening time onto a chosen collection day. The picker deals
 * in days; the order stores an actual moment, and "10:30" is the earliest that
 * moment may be.
 */
export function applyEarliestCollectionTime(date: Date, earliestCollectionTime: string): Date {
  const [hours, minutes] = earliestCollectionTime.split(":").map(Number)
  const stamped = startOfDay(date)
  stamped.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  return stamped
}

/**
 * How many orders already occupy each production day, keyed by dayKey.
 * Orders whose variant has been archived away are skipped rather than guessed
 * at — their production day is unknowable without a lead time.
 */
export function productionDayLoad(
  orders: Pick<Order, "collectionDate" | "productId" | "status">[],
  variantsById: Record<string, Pick<ProductVariant, "leadTimeDays">>
): Map<string, number> {
  const load = new Map<string, number>()
  for (const order of orders) {
    if (!OCCUPIES_PRODUCTION_DAY.includes(order.status)) continue
    const productionDate = productionDateForOrder(order, variantsById)
    if (!productionDate) continue
    const key = dayKey(productionDate)
    load.set(key, (load.get(key) ?? 0) + 1)
  }
  return load
}

/** Why a collection date cannot be chosen. `null` means it can. */
export type UnavailableReason = "blocked-weekday" | "inside-lead-time" | "production-day-full"

export interface AvailabilityContext {
  variant: Pick<ProductVariant, "leadTimeDays">
  settings: CalendarSettings
  /** Existing orders, used to work out which production days are full. */
  orders: Pick<Order, "collectionDate" | "productId" | "status">[]
  variantsById: Record<string, Pick<ProductVariant, "leadTimeDays">>
  /** Treated as "today". Injectable so this stays testable and deterministic. */
  today?: Date
}

/**
 * The single rule set. Returns the reason a collection date is unavailable, or
 * null if it can be chosen.
 *
 * Order matters only for which message wins; all three are independent:
 *  - the shop is shut that weekday
 *  - production would have to have started already
 *  - the production day it lands on is already full
 */
export function collectionDateUnavailableReason(
  date: Date,
  { variant, settings, orders, variantsById, today = new Date() }: AvailabilityContext
): UnavailableReason | null {
  const day = startOfDay(date)

  if (isBlockedWeekday(day, settings.blockedWeekdays)) return "blocked-weekday"

  const productionDate = productionDateFor(day, variant.leadTimeDays)
  if (productionDate < startOfDay(today)) return "inside-lead-time"

  const load = productionDayLoad(orders, variantsById)
  if ((load.get(dayKey(productionDate)) ?? 0) >= settings.maxOrdersPerProductionDay) {
    return "production-day-full"
  }

  return null
}

export function isCollectionDateSelectable(date: Date, context: AvailabilityContext): boolean {
  return collectionDateUnavailableReason(date, context) === null
}

/**
 * Every selectable collection date within `horizonDays` of today. The picker
 * uses a predicate rather than this list, but an explicit list is what makes the
 * rules answerable as a question ("which dates can I have?") by the API and by
 * tests.
 */
export function selectableCollectionDates(
  context: AvailabilityContext,
  horizonDays = 90
): Date[] {
  const today = startOfDay(context.today ?? new Date())
  const dates: Date[] = []
  for (let offset = 0; offset <= horizonDays; offset++) {
    const candidate = addDays(today, offset)
    if (isCollectionDateSelectable(candidate, context)) dates.push(candidate)
  }
  return dates
}
