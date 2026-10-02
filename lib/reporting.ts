import { formatDateLong } from "@/lib/format-date"
import { paymentStateOf } from "@/lib/payments"
import { addShopDays, shopDayOf } from "@/lib/shop-time"
import type { Order, PaymentEvent, Wedding } from "@/lib/types"

/**
 * The figures Reports shows, derived in one place.
 *
 * Money comes from the PaymentEvent ledger, and from nothing else. Orders and
 * weddings write to the same table, so a total taken from it reconciles by
 * construction rather than by two tallies happening to agree. Summing order
 * totals and wedding totals separately would double-count a refund the day
 * someone recorded it against the wrong one.
 */

export interface MoneyTotals {
  /** Gross taken, before refunds. */
  taken: number
  refunded: number
  /** What the business actually kept. */
  net: number
}

/** Adds up a set of ledger entries. The only way money is ever totalled here. */
export function totalsFromLedger(events: PaymentEvent[]): MoneyTotals {
  let taken = 0
  let refunded = 0
  for (const event of events) {
    if (event.kind === "Refund") refunded += event.amount
    else taken += event.amount
  }
  return { taken, refunded, net: taken - refunded }
}

/** Every ledger entry in the business, orders and weddings together. */
export function allLedgerEvents(orders: Order[], weddings: Wedding[]): PaymentEvent[] {
  return [...orders.flatMap((o) => o.payment.events), ...weddings.flatMap((w) => w.payment.events)]
}

/* ------------------------------------------------------------- weddings */

export interface WeddingMoney {
  /** Total of every quote in force. What the order book is worth. */
  quoted: number
  /** Paid in, from the ledger. */
  taken: number
  refunded: number
  /** Still owed on weddings that are not cancelled or lost. */
  outstanding: number
  /** Deposits taken: what has been paid on weddings yet to be paid in full. */
  depositsHeld: number
}

export function weddingMoney(weddings: Wedding[], deadStages: string[]): WeddingMoney {
  const live = weddings.filter((w) => !deadStages.includes(w.stage))
  const ledger = totalsFromLedger(weddings.flatMap((w) => w.payment.events))

  return {
    quoted: live.reduce((sum, w) => sum + (w.currentQuote?.total ?? 0), 0),
    taken: ledger.taken,
    refunded: ledger.refunded,
    outstanding: live.reduce((sum, w) => sum + w.outstanding, 0),
    // A deposit is money held against work not yet finished, so a wedding paid
    // in full is no longer holding one.
    depositsHeld: live
      .filter((w) => w.payment.paid > 0 && w.payment.paid < (w.currentQuote?.total ?? 0))
      .reduce((sum, w) => sum + (w.payment.paid - w.payment.refunded), 0),
  }
}

/** Weddings grouped by the month they happen in, oldest first. */
export interface MonthBucket {
  /** yyyy-mm, for identity. */
  month: string
  label: string
  count: number
  /** Quoted value of the weddings in that month. */
  value: number
}

export function weddingsByMonth(weddings: Wedding[], deadStages: string[]): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>()
  for (const wedding of weddings) {
    if (deadStages.includes(wedding.stage)) continue
    const day = shopDayOf(wedding.eventDate)
    const month = day.slice(0, 7)
    const existing = buckets.get(month) ?? {
      month,
      label: monthLabel(month),
      count: 0,
      value: 0,
    }
    existing.count += 1
    existing.value += wedding.currentQuote?.total ?? 0
    buckets.set(month, existing)
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/** "December 2026", in the shop's timezone and the shop's locale. */
function monthLabel(month: string): string {
  // Midday on the first, so no timezone can push it into the previous month.
  return formatDateLong(new Date(`${month}-01T12:00:00Z`)).replace(/^\d+\s/, "")
}

/* --------------------------------------------------------------- orders */

/**
 * Average order value, over orders that have a value.
 *
 * Deliberately excludes cancelled orders and anything quoted at zero. Including
 * them would drag the average toward nothing and answer a different question:
 * "what does an order we actually fulfil come to" is the useful one, and it is
 * what the client's document asks for.
 */
export function averageOrderValue(orders: Order[]): { average: number; counted: number } {
  const counted = orders.filter((o) => o.status !== "Cancelled" && o.payment.total > 0)
  if (counted.length === 0) return { average: 0, counted: 0 }
  const total = counted.reduce((sum, o) => sum + o.payment.total, 0)
  return { average: Math.round(total / counted.length), counted: counted.length }
}

/**
 * What counter customers still owe: each live order's total less what has been
 * paid against it. Cancelled orders owe nothing. Refunds do not add to the
 * debt — money handed back on a complaint is not money the customer now owes.
 */
export function ordersOutstanding(orders: Order[]): number {
  return orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((sum, o) => sum + Math.max(o.payment.total - o.payment.paid, 0), 0)
}

/* ------------------------------------------------------------ customers */

export interface CustomerSplit {
  /** Customers whose first order or wedding is inside the window. */
  newCustomers: number
  /** Customers who had already bought before the window. */
  returning: number
  /** How many have ever ordered more than once. */
  repeatCustomers: number
}

/**
 * New versus returning, by first-seen date.
 *
 * "Returning" means this customer had already bought something before the
 * window opened — not that they bought twice inside it. A customer of five
 * years who ordered once this month is returning, and counting them as new
 * would flatter the figure.
 */
export function customerSplit(
  orders: Order[],
  weddings: Wedding[],
  windowStartDay: string
): CustomerSplit {
  const firstSeen = new Map<string, string>()
  const timesSeen = new Map<string, number>()

  const note = (email: string | undefined, at: number) => {
    if (!email) return
    const day = shopDayOf(at)
    const existing = firstSeen.get(email)
    if (!existing || day < existing) firstSeen.set(email, day)
    timesSeen.set(email, (timesSeen.get(email) ?? 0) + 1)
  }

  for (const order of orders) note(order.customer?.email, order.createdAt)
  for (const wedding of weddings) note(wedding.customer?.email, wedding.eventDate.getTime())

  let newCustomers = 0
  let returning = 0
  for (const [, day] of firstSeen) {
    if (day >= windowStartDay) newCustomers += 1
    else returning += 1
  }

  return {
    newCustomers,
    returning,
    repeatCustomers: [...timesSeen.values()].filter((n) => n > 1).length,
  }
}

/** A sensible default window: the last 90 shop days. */
export function defaultWindowStart(now: Date = new Date()): string {
  return addShopDays(shopDayOf(now), -90)
}

export { paymentStateOf }
