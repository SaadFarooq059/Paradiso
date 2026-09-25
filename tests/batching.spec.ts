import { test, expect } from "@playwright/test"

import { batchFor, committed, placeOrder, readState, resetDemoData } from "./support"

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
