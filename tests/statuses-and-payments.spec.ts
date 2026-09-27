import { expect, test } from "@playwright/test"

import {
  batchFor,
  collectionDate,
  committed,
  confirmOrder,
  orderAction,
  placeOrder,
  priceVariant,
  readState,
  resetDemoData,
  signInViaApi,
} from "./support"

/**
 * The extended lifecycle, and the two stock guarantees that matter most.
 *
 * Demand is derived from an order's status, not stored — so every status change
 * is also a stock decision, and these are the ones that would be expensive to
 * get wrong: cancelling must give the ingredients back, and refunding must not,
 * because a refund is a money event and the cake may already have been eaten.
 */

const SUPREMA = "suprema-classico"

test.beforeEach(async ({ page }) => {
  await resetDemoData(page)
  await signInViaApi(page)
  // The larger sizes carry estimated prices, which the client may yet correct.
  // These specs assert exact money, so they pin the two they use rather than
  // depending on an estimate that is expected to move.
  await priceVariant(page, "suprema-classico", 4500)
  await priceVariant(page, "grande-classico", 2800)
})

async function statusOf(page: Parameters<typeof readState>[0], orderId: string) {
  const state = await readState(page)
  return state.orders.find((order) => order.id === orderId)?.status
}

test.describe("confirming does not book the kitchen", () => {
  test("a confirmed order holds no ingredients until it is scheduled", async ({ page }) => {
    const before = await readState(page)
    expect(committed(before, "eggs")).toBe(0)

    const confirmed = await confirmOrder(page, SUPREMA, 2)
    expect(confirmed.orderId).toBeTruthy()
    expect(await statusOf(page, confirmed.orderId!)).toBe("Confirmed")

    // The whole point of the Confirmed step: agreed with the customer, holding
    // nothing. Nothing is on any production day yet.
    const afterConfirm = await readState(page)
    expect(committed(afterConfirm, "eggs")).toBe(0)
    expect(afterConfirm.productionDemand).toHaveLength(0)

    await orderAction(page, confirmed.orderId!, "schedule")
    expect(await statusOf(page, confirmed.orderId!)).toBe("Scheduled")

    // Two Supremas are one batch (yield 2), so ten eggs, not twenty.
    const afterSchedule = await readState(page)
    expect(committed(afterSchedule, "eggs")).toBe(10)
    expect(batchFor(afterSchedule, SUPREMA)?.batches).toBe(1)
  })

  test("scheduling beyond stock puts the order on hold, holding nothing", async ({ page }) => {
    // Twenty eggs on hand; each Suprema batch takes ten and yields two.
    const big = await confirmOrder(page, SUPREMA, 14)
    await orderAction(page, big.orderId!, "schedule")

    expect(await statusOf(page, big.orderId!)).toBe("On Hold")
    const state = await readState(page)
    expect(committed(state, "eggs")).toBe(0)
    const order = state.orders.find((o) => o.id === big.orderId)
    expect(order?.shortages.length).toBeGreaterThan(0)
  })
})

test.describe("stock is released on cancel", () => {
  test("cancelling a scheduled order frees its ingredients", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 2)
    expect(committed(await readState(page), "eggs")).toBe(10)

    await orderAction(page, order.orderId!, "cancel")

    expect(await statusOf(page, order.orderId!)).toBe("Cancelled")
    const after = await readState(page)
    expect(committed(after, "eggs")).toBe(0)
    expect(after.productionDemand).toHaveLength(0)
  })

  test("querying an order also frees them — it is not proceeding either", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 2)
    expect(committed(await readState(page), "eggs")).toBe(10)

    await orderAction(page, order.orderId!, "query", { note: "Which day exactly?" })

    expect(await statusOf(page, order.orderId!)).toBe("Details require clarification")
    expect(committed(await readState(page), "eggs")).toBe(0)

    // Resolving returns it to Confirmed, which still holds nothing until
    // Schedule re-runs the check.
    await orderAction(page, order.orderId!, "resolve")
    expect(await statusOf(page, order.orderId!)).toBe("Confirmed")
    expect(committed(await readState(page), "eggs")).toBe(0)

    await orderAction(page, order.orderId!, "schedule")
    expect(committed(await readState(page), "eggs")).toBe(10)
  })
})

test.describe("stock is NOT moved by a refund", () => {
  test("refunding a collected order leaves its ingredients spent", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 2)
    const id = order.orderId!

    await orderAction(page, id, "start")
    await orderAction(page, id, "ready")
    await orderAction(page, id, "complete")
    expect(await statusOf(page, id)).toBe("Collected or delivered")

    // Collected is still live: those ingredients were genuinely used, and
    // handing them back would invent capacity that does not exist.
    expect(committed(await readState(page), "eggs")).toBe(10)

    await orderAction(page, id, "pay", { amount: 9000 })
    const refund = await orderAction(page, id, "refund", { amount: 9000 })
    expect(refund.tone).toBe("success")

    // The refund moved money and nothing else.
    expect(await statusOf(page, id)).toBe("Collected or delivered")
    const after = await readState(page)
    expect(committed(after, "eggs")).toBe(10)

    const refunded = after.orders.find((o) => o.id === id)
    expect(refunded?.payment.refunded).toBe(9000)
    expect(refunded?.payment.state).toBe("Refunded")
  })

  test("refunding a scheduled order does not release it either", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 2)
    const id = order.orderId!

    await orderAction(page, id, "pay", { amount: 9000 })
    await orderAction(page, id, "refund", { amount: 4500 })

    // Still Scheduled, still holding its ingredients. Only a cancel frees them.
    expect(await statusOf(page, id)).toBe("Scheduled")
    expect(committed(await readState(page), "eggs")).toBe(10)

    const state = await readState(page)
    expect(state.orders.find((o) => o.id === id)?.payment.state).toBe("Partially refunded")
  })

  test("cancel-and-refund records both, and the cancel is what frees stock", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 2)
    const id = order.orderId!

    await orderAction(page, id, "pay", { amount: 9000 })
    expect(committed(await readState(page), "eggs")).toBe(10)

    const result = await orderAction(page, id, "cancel-and-refund", { amount: 9000 })
    expect(result.tone).toBe("success")

    expect(await statusOf(page, id)).toBe("Cancelled")
    const after = await readState(page)
    expect(committed(after, "eggs")).toBe(0)

    const settled = after.orders.find((o) => o.id === id)
    expect(settled?.payment.refunded).toBe(9000)
    // Two ledger entries, not one: the payment and the refund.
    expect(settled?.payment.events).toHaveLength(2)
  })
})

test.describe("an unpriced product cannot be sold", () => {
  test("every seeded product has a price", async ({ page }) => {
    // The larger sizes are estimated rather than unpriced, so the whole range
    // can be ordered. An unpriced one would be a regression, not a placeholder.
    const state = await readState(page)
    expect(state.variants.filter((v) => v.priceAmount === 0)).toHaveLength(0)
    expect(state.variants.filter((v) => v.priceEstimated).length).toBeGreaterThan(0)
  })

  test("ordering one that has no price is refused rather than totalling nothing", async ({
    page,
  }) => {
    // Selling it would write a £0.00 order and call it agreed — the same silent
    // zero that priced a live wedding quote at £80 instead of £860. Created
    // here rather than found, because nothing in the seeded range is unpriced.
    await priceVariant(page, "mini-biscoff", 0)

    const result = await confirmOrder(page, "mini-biscoff", 1)
    expect(result.tone).toBe("error")
    expect(result.message).toContain("no published price")
    expect((await readState(page)).orders).toHaveLength(0)
  })

  test("pricing it lets the order through", async ({ page }) => {
    await priceVariant(page, "mini-biscoff", 0)
    expect((await confirmOrder(page, "mini-biscoff", 1)).tone).toBe("error")

    await priceVariant(page, "mini-biscoff", 2200)
    const result = await confirmOrder(page, "mini-biscoff", 1)

    expect(result.tone).toBe("success")
    const after = await readState(page)
    expect(after.orders.find((o) => o.id === result.orderId)?.payment.total).toBe(2200)
  })

  test("an estimated price is still an estimate after an unrelated edit", async ({ page }) => {
    // The flag must survive a save that does not touch the price, or the marker
    // quietly disappears the first time someone fixes a typo in the name.
    const before = (await readState(page)).variants.find((v) => v.id === "suprema-classico")!
    expect(before.priceEstimated).toBe(true)

    const response = await page.request.post("/api/variants", {
      data: { ...before, description: `${before.description} ` },
    })
    expect(response.ok()).toBeTruthy()

    const after = (await readState(page)).variants.find((v) => v.id === "suprema-classico")!
    expect(after.priceEstimated).toBe(true)
    expect(after.priceAmount).toBe(before.priceAmount)
  })
})

test.describe("the payment ledger", () => {
  test("totals derive from the variant price and the ledger, in pence", async ({ page }) => {
    // Suprema has no published price, so these specs set £45.00; two is £90.00.
    const order = await placeOrder(page, SUPREMA, 2)
    const id = order.orderId!

    let state = await readState(page)
    expect(state.orders.find((o) => o.id === id)?.payment.total).toBe(9000)
    expect(state.orders.find((o) => o.id === id)?.payment.state).toBe("Unpaid")

    await orderAction(page, id, "pay", { amount: 4000 })
    state = await readState(page)
    // Part-paid is not "Payment received" — that needs the full total.
    expect(state.orders.find((o) => o.id === id)?.payment.paid).toBe(4000)
    expect(state.orders.find((o) => o.id === id)?.payment.state).toBe("Unpaid")

    await orderAction(page, id, "pay", { amount: 5000 })
    state = await readState(page)
    expect(state.orders.find((o) => o.id === id)?.payment.state).toBe("Payment received")
    expect(state.orders.find((o) => o.id === id)?.payment.events).toHaveLength(2)
  })

  test("refuses more than was paid, and more than the total", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 2)
    const id = order.orderId!

    const tooMuch = await orderAction(page, id, "pay", { amount: 9001 })
    expect(tooMuch.tone).toBe("error")

    await orderAction(page, id, "pay", { amount: 9000 })
    const overRefund = await orderAction(page, id, "refund", { amount: 9001 })
    expect(overRefund.tone).toBe("error")

    const state = await readState(page)
    expect(state.orders.find((o) => o.id === id)?.payment.refunded).toBe(0)
  })
})

test.describe("status changes record who made them", () => {
  test("each event carries the signed-in staff member", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 2)
    const state = await readState(page)
    const history = state.orders.find((o) => o.id === order.orderId)?.statusHistory ?? []

    expect(history.map((event) => event.status)).toEqual(["Confirmed", "Scheduled"])
    for (const event of history) {
      expect(event.actorName).toBe("Aisha Bello")
    }
  })
})

test.describe("customer messages", () => {
  test("confirming and scheduling render the right messages", async ({ page }) => {
    const confirmed = await confirmOrder(page, SUPREMA, 1)
    let state = await readState(page)
    let emails = state.orders.find((o) => o.id === confirmed.orderId)?.emails ?? []

    expect(emails).toHaveLength(1)
    expect(emails[0].template).toBe("Confirmation")
    expect(emails[0].status).toBe("Ready to send")
    expect(emails[0].toEmail).toBe("test.customer@example.com")
    // Rendered from real order data, not a placeholder.
    expect(emails[0].body).toContain("Suprema-misu Classico")
    expect(emails[0].body).toContain("£45.00")

    await orderAction(page, confirmed.orderId!, "schedule")
    state = await readState(page)
    emails = state.orders.find((o) => o.id === confirmed.orderId)?.emails ?? []

    const reminder = emails.find((email) => email.template === "Reminder")
    expect(reminder).toBeTruthy()
    // Date-triggered, so it waits rather than going out now.
    expect(reminder?.status).toBe("Pending")
    expect(reminder?.sendAfter).toBeTruthy()

    // The day before collection, and no earlier.
    const due = new Date(reminder!.sendAfter!)
    const collection = collectionDate()
    const daysBefore = Math.round(
      (collection.setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0)) / 86_400_000
    )
    expect(daysBefore).toBe(1)
  })

  test("cancelling suppresses a reminder that has not gone yet", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 1)
    await orderAction(page, order.orderId!, "cancel")

    const state = await readState(page)
    const emails = state.orders.find((o) => o.id === order.orderId)?.emails ?? []
    const reminder = emails.find((email) => email.template === "Reminder")

    expect(reminder?.status).toBe("Suppressed")
    expect(reminder?.suppressedReason).toContain("cancelled")
  })

  test("collecting an order produces the follow-up", async ({ page }) => {
    const order = await placeOrder(page, SUPREMA, 1)
    const id = order.orderId!
    await orderAction(page, id, "start")
    await orderAction(page, id, "ready")
    await orderAction(page, id, "complete")

    const state = await readState(page)
    const emails = state.orders.find((o) => o.id === id)?.emails ?? []
    expect(emails.map((email) => email.template)).toEqual([
      "Confirmation",
      "Reminder",
      "Ready for collection",
      "Follow-up",
    ])
  })
})
