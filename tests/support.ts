import { expect, type Page } from "@playwright/test"

/**
 * A collection date every seeded product can be made for.
 *
 * Lead times mean "today" is never selectable: Suprema needs 4 days. One week
 * out clears the longest seeded lead time, and Mondays are skipped because the
 * shop does not do Monday collections.
 */
export function collectionDate(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 7)
  if (date.getDay() === 1) date.setDate(date.getDate() + 1)
  return date
}

/** Matches calendar.tsx's data-day, which is pinned to en-GB (dd/mm/yyyy). */
export function dayAttribute(date: Date): string {
  return date.toLocaleDateString("en-GB")
}

/**
 * The database persists, so every spec resets it to the seed state first —
 * otherwise a second run starts with the previous run's orders.
 */
export async function resetDemoData(page: Page) {
  const response = await page.request.post("/api/reset")
  expect(response.ok()).toBeTruthy()
}

export interface DashboardState {
  stock: Record<string, number>
  capacity: Record<string, number>
  orders: {
    id: string
    productId: string
    quantity: number
    status: string
    assignedStaff: string | null
    shortages: { ingredient: string; shortBy: number }[]
    consumedIngredients: Record<string, number>
  }[]
  productionDemand: {
    day: string
    amounts: Record<string, number>
    orderCount: number
    variants: {
      variantId: string
      units: number
      batches: number
      capacityUnits: number
      surplusUnits: number
      amounts: Record<string, number>
    }[]
  }[]
}

export async function readState(page: Page): Promise<DashboardState> {
  const response = await page.request.get("/api/state")
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as DashboardState
}

/** Places an order straight through the API, bypassing the date picker. */
export async function placeOrder(
  page: Page,
  productId: string,
  quantity: number,
  date: Date = collectionDate()
) {
  const response = await page.request.post("/api/orders", {
    data: { productId, quantity, collectionDate: date.toISOString() },
  })
  return (await response.json()) as { message: string; tone: string; orderId?: string }
}

/** Total committed to live orders: what is on hand minus what is still free. */
export function committed(state: DashboardState, ingredient: string): number {
  return (state.capacity[ingredient] ?? 0) - (state.stock[ingredient] ?? 0)
}

/** The batch breakdown for one variant on the day it is produced. */
export function batchFor(state: DashboardState, variantId: string) {
  for (const day of state.productionDemand) {
    const match = day.variants.find((variant) => variant.variantId === variantId)
    if (match) return match
  }
  return undefined
}
