import { expect, test } from "@playwright/test"

import {
  allLedgerEvents,
  averageOrderValue,
  customerSplit,
  totalsFromLedger,
  weddingMoney,
  weddingsByMonth,
} from "@/lib/reporting"
import { DEAD_STAGES } from "@/lib/weddings"
import { addShopDays, shopDayOf, shopMoment } from "@/lib/shop-time"
import {
  collectionDate,
  confirmOrder,
  orderAction,
  readState,
  resetDemoData,
  signInAs,
} from "./support"

/**
 * Reporting figures, and the one property that matters most: order money and
 * wedding money come from the same ledger, so they reconcile rather than being
 * two tallies that happen to agree.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const order = (over: Record<string, unknown> = {}): any => ({
  status: "Scheduled",
  createdAt: Date.now(),
  customer: { email: "a@example.com" },
  payment: { total: 1000, paid: 0, refunded: 0, state: "Unpaid", events: [] },
  ...over,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const weddingOf = (over: Record<string, unknown> = {}): any => ({
  stage: "DepositPaid",
  eventDate: shopMoment("2026-12-11", "10:30"),
  customer: { email: "w@example.com" },
  currentQuote: { total: 100000 },
  outstanding: 75000,
  payment: { total: 100000, paid: 25000, refunded: 0, state: "Unpaid", events: [] },
  ...over,
})

test.describe("money comes from one ledger", () => {
  test("totals net refunds off rather than hiding them", () => {
    const events = [
      { id: 1, kind: "Payment", amount: 5000 },
      { id: 2, kind: "Payment", amount: 2500 },
      { id: 3, kind: "Refund", amount: 1500 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any
    expect(totalsFromLedger(events)).toEqual({ taken: 7500, refunded: 1500, net: 6000 })
  })

  test("order and wedding money reconcile because they are the same rows", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderEvents = [{ id: 1, kind: "Payment", amount: 4500 }] as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weddingEvents = [
      { id: 2, kind: "Payment", amount: 25000 },
      { id: 3, kind: "Refund", amount: 5000 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any

    const orders = [order({ payment: { total: 4500, paid: 4500, refunded: 0, state: "x", events: orderEvents } })]
    const weddings = [weddingOf({ payment: { total: 100000, paid: 25000, refunded: 5000, state: "x", events: weddingEvents } })]

    const combined = totalsFromLedger(allLedgerEvents(orders, weddings))
    const separately =
      totalsFromLedger(orderEvents).net + totalsFromLedger(weddingEvents).net

    // The point: one figure, not two that must be kept in step.
    expect(combined.net).toBe(separately)
    expect(combined).toEqual({ taken: 29500, refunded: 5000, net: 24500 })
  })
})

test.describe("wedding figures", () => {
  test("deposits held excludes weddings paid in full", () => {
    const weddings = [
      weddingOf({ payment: { total: 100000, paid: 25000, refunded: 0, state: "x", events: [] } }),
      // Paid in full: no longer holding a deposit against unfinished work.
      weddingOf({ payment: { total: 80000, paid: 80000, refunded: 0, state: "x", events: [] }, currentQuote: { total: 80000 }, outstanding: 0 }),
    ]
    const money = weddingMoney(weddings, DEAD_STAGES)
    expect(money.depositsHeld).toBe(25000)
    expect(money.quoted).toBe(180000)
    expect(money.outstanding).toBe(75000)
  })

  test("cancelled and lost weddings are left out of the order book", () => {
    const weddings = [
      weddingOf(),
      weddingOf({ stage: "Cancelled" }),
      weddingOf({ stage: "Lost" }),
    ]
    expect(weddingMoney(weddings, DEAD_STAGES).quoted).toBe(100000)
    expect(weddingsByMonth(weddings, DEAD_STAGES).reduce((n, m) => n + m.count, 0)).toBe(1)
  })

  test("weddings group by the month they happen in, in shop time", () => {
    const weddings = [
      weddingOf({ eventDate: shopMoment("2026-12-11", "10:30") }),
      weddingOf({ eventDate: shopMoment("2026-12-28", "10:30") }),
      weddingOf({ eventDate: shopMoment("2027-01-04", "10:30") }),
      // Midnight on the 1st: a timezone slip would file this under December.
      weddingOf({ eventDate: shopMoment("2027-02-01", "00:00") }),
    ]
    const months = weddingsByMonth(weddings, DEAD_STAGES)
    expect(months.map((m) => m.month)).toEqual(["2026-12", "2027-01", "2027-02"])
    expect(months[0].count).toBe(2)
    expect(months[0].label).toBe("December 2026")
    expect(months[2].label).toBe("February 2027")
  })
})

test.describe("average order value", () => {
  test("ignores cancelled orders and zero-priced ones", () => {
    const orders = [
      order({ payment: { total: 1000, paid: 0, refunded: 0, state: "x", events: [] } }),
      order({ payment: { total: 3000, paid: 0, refunded: 0, state: "x", events: [] } }),
      // Would drag the average to 1333 if counted.
      order({ status: "Cancelled", payment: { total: 9000, paid: 0, refunded: 0, state: "x", events: [] } }),
      order({ payment: { total: 0, paid: 0, refunded: 0, state: "x", events: [] } }),
    ]
    expect(averageOrderValue(orders)).toEqual({ average: 2000, counted: 2 })
  })

  test("is zero rather than NaN when there is nothing to average", () => {
    expect(averageOrderValue([])).toEqual({ average: 0, counted: 0 })
  })
})

test.describe("new versus returning", () => {
  test("returning means they bought before the window, not twice inside it", () => {
    const windowStart = addShopDays(shopDayOf(new Date()), -90)
    const longAgo = shopMoment(addShopDays(windowStart, -200), "10:30").getTime()
    const recently = shopMoment(addShopDays(windowStart, 10), "10:30").getTime()

    const orders = [
      // First seen long before the window: returning, even though they have
      // ordered only once inside it.
      order({ customer: { email: "old@example.com" }, createdAt: longAgo }),
      order({ customer: { email: "old@example.com" }, createdAt: recently }),
      order({ customer: { email: "new@example.com" }, createdAt: recently }),
    ]

    const split = customerSplit(orders, [], windowStart)
    expect(split.newCustomers).toBe(1)
    expect(split.returning).toBe(1)
    expect(split.repeatCustomers).toBe(1)
  })

  test("a wedding customer counts the same as an order customer", () => {
    const windowStart = addShopDays(shopDayOf(new Date()), -90)
    const split = customerSplit([], [weddingOf({ customer: { email: "bride@example.com" } })], windowStart)
    expect(split.newCustomers + split.returning).toBe(1)
  })
})

test.describe("against the live API", () => {
  test("a real payment shows up in the combined ledger total", async ({ page }) => {
    await resetDemoData(page)
    await signInAs(page, "Admin")

    const created = await confirmOrder(page, "mini-classico", 1, collectionDate())
    await orderAction(page, created.orderId!, "schedule")
    await orderAction(page, created.orderId!, "pay", { amount: 650 })

    const state = await readState(page)
    const events = allLedgerEvents(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.orders as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (state.weddings ?? []).map((w: any) => ({ ...w, eventDate: new Date(w.eventDate) })) as any
    )
    expect(totalsFromLedger(events).taken).toBe(650)
  })
})
