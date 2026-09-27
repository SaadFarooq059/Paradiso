
import { holdsCapacity, type WeddingStage } from "@/lib/weddings"
import type { ProjectableWedding } from "@/lib/stock-projection"
import {
  addShopDays,
  compareShopDays,
  shopDayOf,
  shopMoment,
  shopWeekdayOf,
  type ShopDay,
} from "@/lib/shop-time"

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

/**
 * Orders occupying a production day. Deliberately the same set as LIVE_STATUSES
 * in lib/stock-projection.ts: a day's order ceiling and its ingredient draw must
 * agree about which orders are real, or one of them will let through work the
 * other has already refused. Confirmed and both blocked states hold no slot;
 * Cancelled gave its slot back.
 */
export const OCCUPIES_PRODUCTION_DAY: OrderStatus[] = [
  "Scheduled",
  "In Production",
  "Ready for collection",
  "Collected or delivered",
]

/**
 * Stable per-day grouping key. Deliberately ISO (yyyy-mm-dd) rather than a
 * localised string: this is an internal identity, never shown to anyone, and it
 * must not change with the machine's locale.
 */
export function dayKey(date: Date): string {
  // Which shop day the instant falls on, never which day the *runtime* thinks
  // it is. The two differ on any server that is not in Europe/London, and Vercel
  // runs UTC — a collection stored at 23:30 London would otherwise key to the
  // following day on the server and the correct one in the browser.
  return shopDayOf(date)
}

/**
 * The day production must start for an order to be ready on its collection date.
 * Derived, never stored — see ProductVariant.leadTimeDays for why.
 */
export function productionDateFor(collectionDate: Date, leadTimeDays: number): Date {
  // Counted in whole shop days, then turned back into a moment at the start of
  // that day in the shop's timezone. Subtracting 24h-multiples from an instant
  // is not the same thing: the clocks change twice a year, and on those two days
  // it lands an hour out — enough to cross midnight and move the production day.
  return shopMoment(addShopDays(shopDayOf(collectionDate), -leadTimeDays))
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
  return blockedWeekdays.includes(shopWeekdayOf(shopDayOf(date)) as Weekday)
}

/**
 * Stamps the shop's opening time onto a chosen collection day. The picker deals
 * in days; the order stores an actual moment, and "10:30" is the earliest that
 * moment may be.
 */
export function applyEarliestCollectionTime(date: Date, earliestCollectionTime: string): Date {
  return shopMoment(shopDayOf(date), earliestCollectionTime)
}

/**
 * The same thing from a plain `yyyy-mm-dd`, which is what the client now sends.
 *
 * This is the one that matters: taking a day rather than an instant means the
 * client's timezone never reaches the server at all. The old path turned a
 * London midnight into 23:00Z the previous day, and a UTC server stamped the
 * opening time onto that earlier day.
 */
export function collectionMomentFor(day: ShopDay, earliestCollectionTime: string): Date {
  return shopMoment(day, earliestCollectionTime)
}

/**
 * How many orders already occupy each production day, keyed by dayKey.
 * Orders whose variant has been archived away are skipped rather than guessed
 * at — their production day is unknowable without a lead time.
 */
export function productionDayLoad(
  orders: Pick<Order, "collectionDate" | "productId" | "status">[],
  variantsById: Record<string, Pick<ProductVariant, "leadTimeDays">>,
  weddings: ProjectableWedding[] = []
): Map<string, number> {
  const load = new Map<string, number>()
  for (const order of orders) {
    if (!OCCUPIES_PRODUCTION_DAY.includes(order.status)) continue
    const productionDate = productionDateForOrder(order, variantsById)
    if (!productionDate) continue
    const key = dayKey(productionDate)
    load.set(key, (load.get(key) ?? 0) + 1)
  }
  // A wedding is one job against the ceiling on each day it touches, not one
  // per tier — the kitchen is setting up for one event. Its tiers still draw
  // their full ingredient demand through the projection, which is why the
  // ceiling alone understates the day; see weddingDayTierCount, which exists so
  // the calendar can say so rather than letting "3 of 20" read as the whole
  // picture.
  for (const wedding of weddings) {
    if (!holdsCapacity({ stage: wedding.stage as WeddingStage, capacityBookedAt: wedding.capacityBookedAt })) {
      continue
    }
    const days = new Set<string>()
    for (const tier of wedding.tiers) {
      const variant = variantsById[tier.variantId]
      if (!variant) continue
      days.add(dayKey(productionDateFor(wedding.eventDate, variant.leadTimeDays)))
    }
    for (const day of days) load.set(day, (load.get(day) ?? 0) + 1)
  }
  return load
}

/**
 * How many wedding tiers land on each production day.
 *
 * The day ceiling counts a wedding as one job, which is right for setup but
 * understates the baking: a five-tier wedding shows as "1" and is five cakes.
 * The calendar shows this alongside so nobody reads the ceiling as the load.
 */
export function weddingDayTierCount(
  weddings: ProjectableWedding[],
  variantsById: Record<string, Pick<ProductVariant, "leadTimeDays">>
): Map<string, number> {
  const tiers = new Map<string, number>()
  for (const wedding of weddings) {
    if (!holdsCapacity({ stage: wedding.stage as WeddingStage, capacityBookedAt: wedding.capacityBookedAt })) {
      continue
    }
    for (const tier of wedding.tiers) {
      const variant = variantsById[tier.variantId]
      if (!variant) continue
      const key = dayKey(productionDateFor(wedding.eventDate, variant.leadTimeDays))
      tiers.set(key, (tiers.get(key) ?? 0) + tier.quantity)
    }
  }
  return tiers
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
  // Everything below reasons in shop days. Comparing instants would make the
  // answer depend on the runtime's clock: "is production already past?" must
  // mean the same thing in a London browser and on a UTC server, or the picker
  // greys out a date the server would accept, or worse, offers one it refuses.
  const collectionDay = shopDayOf(date)

  if (isBlockedWeekday(date, settings.blockedWeekdays)) return "blocked-weekday"

  const productionDay = addShopDays(collectionDay, -variant.leadTimeDays)
  if (compareShopDays(productionDay, shopDayOf(today)) < 0) return "inside-lead-time"

  const load = productionDayLoad(orders, variantsById)
  if ((load.get(productionDay) ?? 0) >= settings.maxOrdersPerProductionDay) {
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
  const today = shopDayOf(context.today ?? new Date())
  const dates: Date[] = []
  for (let offset = 0; offset <= horizonDays; offset++) {
    // Walked as shop days, so the two days a year the clocks change do not
    // duplicate or skip a candidate the way adding 24h repeatedly would.
    const candidate = shopMoment(addShopDays(today, offset))
    if (isCollectionDateSelectable(candidate, context)) dates.push(candidate)
  }
  return dates
}
