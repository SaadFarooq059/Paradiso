import { test, expect } from "@playwright/test"

import { batchFor, committed, placeOrder, readState, resetDemoData, signInViaApi } from "./support"

/**
 * Batching and yield.
 *
 * The kitchen bakes batches, not units. A Suprema batch draws 6 eggs and yields
 * two cakes, so one Suprema costs a whole batch and leaves a spare, a second is
 * free, and a third starts a new batch. These go through the API rather than the
 * date picker: they are assertions about the engine's arithmetic, and driving the
 * calendar four times over would test the picker instead.
 *
 * Seeded Suprema: 6 eggs per batch, yield 2, lead time 4 days.
 */

test.beforeEach(async ({ page }) => {
  await resetDemoData(page)
  // The data routes require a session now, so the API-level specs need one too.
  await signInViaApi(page)
})

test("one Suprema runs a whole batch and leaves a spare unit", async ({ page }) => {
  const result = await placeOrder(page, "suprema-classico", 1)
  expect(result.tone).toBe("success")

  const state = await readState(page)
  const batch = batchFor(state, "suprema-classico")

  expect(batch).toBeDefined()
  expect(batch!.units).toBe(1)
  expect(batch!.batches).toBe(1)
  expect(batch!.capacityUnits).toBe(2)
  expect(batch!.surplusUnits).toBe(1)

  // A whole batch is drawn even though only half of it was ordered.
  expect(batch!.amounts.eggs).toBe(6)
  expect(committed(state, "eggs")).toBe(6)
})

test("two Supremas share one batch and draw nothing extra", async ({ page }) => {
  await placeOrder(page, "suprema-classico", 2)

  const state = await readState(page)
  const batch = batchFor(state, "suprema-classico")

  expect(batch!.units).toBe(2)
  expect(batch!.batches).toBe(1)
  expect(batch!.surplusUnits).toBe(0)

  // Identical draw to a single Suprema — the second cake was already being made.
  expect(batch!.amounts.eggs).toBe(6)
  expect(committed(state, "eggs")).toBe(6)
})

test("three Supremas need two batches", async ({ page }) => {
  await placeOrder(page, "suprema-classico", 3)

  const state = await readState(page)
  const batch = batchFor(state, "suprema-classico")

  expect(batch!.units).toBe(3)
  expect(batch!.batches).toBe(2)
  expect(batch!.capacityUnits).toBe(4)
  expect(batch!.surplusUnits).toBe(1)

  expect(batch!.amounts.eggs).toBe(12)
  expect(committed(state, "eggs")).toBe(12)
})

test("an order added later slots into an existing partial batch without a new draw", async ({
  page,
}) => {
  // First order leaves a half-empty batch: 1 of 2 units used.
  await placeOrder(page, "suprema-classico", 1)
  const before = await readState(page)
  expect(batchFor(before, "suprema-classico")!.surplusUnits).toBe(1)
  expect(committed(before, "eggs")).toBe(6)

  // A separate order, placed afterwards, for the same production day.
  const second = await placeOrder(page, "suprema-classico", 1)
  expect(second.tone).toBe("success")

  const after = await readState(page)
  const batch = batchFor(after, "suprema-classico")

  // Two orders, two units, still one batch — the surplus absorbed it.
  expect(after.productionDemand[0].orderCount).toBe(2)
  expect(batch!.units).toBe(2)
  expect(batch!.batches).toBe(1)
  expect(batch!.surplusUnits).toBe(0)

  // The whole point: no fresh ingredients were drawn for the second order.
  expect(committed(after, "eggs")).toBe(committed(before, "eggs"))
  expect(after.stock.eggs).toBe(before.stock.eggs)
})

test("a fourth Suprema does start a second batch", async ({ page }) => {
  // Guards the boundary from the other side: absorbing surplus must not become
  // "extra units are always free".
  await placeOrder(page, "suprema-classico", 2)
  const before = await readState(page)
  expect(committed(before, "eggs")).toBe(6)

  await placeOrder(page, "suprema-classico", 1)
  const after = await readState(page)

  expect(batchFor(after, "suprema-classico")!.batches).toBe(2)
  expect(committed(after, "eggs")).toBe(12)
})

test("different variants on one production day are batched separately", async ({ page }) => {
  // Grande and Mini share a 2-day lead time, so one collection date puts them on
  // the same production day — but they are different recipes and cannot pool.
  await placeOrder(page, "grande-classico", 1)
  await placeOrder(page, "mini-classico", 1)

  const state = await readState(page)
  const day = state.productionDemand.find((d) => d.variants.length === 2)

  expect(day).toBeDefined()
  expect(day!.variants.map((v) => v.variantId).sort()).toEqual([
    "grande-classico",
    "mini-classico",
  ])
  // Grande 4 eggs/batch + Mini 2 eggs/batch, one batch each.
  expect(day!.amounts.eggs).toBe(6)
})

/**
 * Attribution: what one order records as its own ingredients when it shares a
 * batch with others. The rule is the batch recipe over the batch's yield, times
 * the units ordered — so it depends only on the recipe and the order itself.
 */

test("an order records its per-unit share of the batch, not the whole batch", async ({ page }) => {
  const result = await placeOrder(page, "suprema-classico", 1)
  expect(result.tone).toBe("success")

  const state = await readState(page)
  const order = state.orders[0]

  // Suprema: 6 eggs per batch, yield 2. One cake is half a batch.
  expect(order.consumedIngredients.eggs).toBe(3)
  expect(order.consumedIngredients.mascarpone).toBe(250)

  // The kitchen still drew the whole batch; the other half is surplus.
  expect(batchFor(state, "suprema-classico")!.amounts.eggs).toBe(6)
})

test("a later order joining the same batch does not rewrite the first order's share", async ({
  page,
}) => {
  const first = await placeOrder(page, "suprema-classico", 1)
  const before = await readState(page)
  const firstBefore = before.orders.find((o) => o.id === first.orderId)!
  expect(firstBefore.consumedIngredients.eggs).toBe(3)

  await placeOrder(page, "suprema-classico", 1)

  const after = await readState(page)
  const firstAfter = after.orders.find((o) => o.id === first.orderId)!
  const second = after.orders.find((o) => o.id !== first.orderId)!

  // Frozen at creation: the first order's record is untouched.
  expect(firstAfter.consumedIngredients).toEqual(firstBefore.consumedIngredients)
  expect(second.consumedIngredients.eggs).toBe(3)

  // Both halves attributed, and together they equal the batch that was drawn.
  expect(batchFor(after, "suprema-classico")!.amounts.eggs).toBe(6)
})

test("shares are fractional when a batch yields many units", async ({ page }) => {
  // Mini: 2 eggs per batch, yield 8. One Mini is an eighth of a batch.
  await placeOrder(page, "mini-classico", 1)

  const state = await readState(page)
  expect(state.orders[0].consumedIngredients.eggs).toBe(0.25)
  expect(state.orders[0].consumedIngredients.mascarpone).toBe(18.75)

  // A whole batch is still drawn for the one cake.
  expect(batchFor(state, "mini-classico")!.amounts.eggs).toBe(2)
})

test("a cancelled order keeps its share on record but frees the batch", async ({ page }) => {
  const placed = await placeOrder(page, "suprema-classico", 1)
  const before = await readState(page)
  expect(before.capacity.eggs).toBe(20)

  const response = await page.request.post(`/api/orders/${placed.orderId}`, {
    data: { action: "cancel" },
  })
  expect(response.ok()).toBeTruthy()

  const after = await readState(page)
  const cancelled = after.orders.find((o) => o.id === placed.orderId)!

  expect(cancelled.status).toBe("Cancelled")
  // The snapshot survives as the record of what the order was for...
  expect(cancelled.consumedIngredients.eggs).toBe(3)
  // ...while the batch it booked disappears, and on-hand never moved.
  expect(after.productionDemand).toHaveLength(0)
  expect(after.capacity.eggs).toBe(20)
  expect(after.stock.eggs).toBe(20)
})
