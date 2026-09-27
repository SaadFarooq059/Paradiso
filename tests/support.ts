import { expect, type Page } from "@playwright/test"

import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts"
import type { StaffRole } from "@/lib/auth/roles"
import { shopDayOf } from "@/lib/shop-time"

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
 *
 * Reset is no longer open: it takes either an admin session or RESET_TOKEN. The
 * suite uses the token so it can reset before signing in.
 */
export async function resetDemoData(page: Page) {
  const token = process.env.RESET_TOKEN
  expect(token, "RESET_TOKEN must be set for the suite to reset the database").toBeTruthy()
  const response = await page.request.post("/api/reset", {
    headers: { authorization: `Bearer ${token}` },
  })
  expect(response.ok()).toBeTruthy()
}

/**
 * Signs in over the API. page.request shares the page's cookie jar, so the
 * session cookie this sets authenticates both later API calls and the UI.
 */
/**
 * Signs in as one of the demo accounts. page.request shares the page's cookie
 * jar, so the session authenticates both later API calls and the UI.
 *
 * Takes a role rather than a staff id: what a test cares about is which
 * permissions it is acting with, and naming the role says that outright.
 */
export async function signInAs(page: Page, role: StaffRole = "Admin") {
  const account = DEMO_ACCOUNTS.find((a) => a.role === role)
  expect(account, `no demo account seeded for ${role}`).toBeTruthy()
  const response = await page.request.post("/api/auth", {
    data: { email: account!.email, password: account!.password },
  })
  expect(
    response.ok(),
    `sign-in should succeed for ${role} (${account!.email}) — is the database seeded?`
  ).toBeTruthy()
  return account!
}

/** Most specs only need to be signed in as someone who can do everything. */
export async function signInViaApi(page: Page) {
  return signInAs(page, "Admin")
}

/** Drops the session, for testing what an unauthenticated caller gets. */
export async function signOut(page: Page) {
  await page.request.delete("/api/auth")
}

export interface DashboardState {
  variants: {
    id: string
    name: string
    priceAmount: number
    priceEstimated?: boolean
    description: string
    leadTimeDays: number
    unitsPerBatch: number
    requires: Record<string, number>
  }[]
  stock: Record<string, number>
  capacity: Record<string, number>
  orders: {
    id: string
    productId: string
    quantity: number
    collectionDate: string
    status: string
    assignedStaff: string | null
    shortages: { ingredient: string; shortBy: number }[]
    consumedIngredients: Record<string, number>
    statusHistory: { status: string; at: number; note?: string; actorName: string | null }[]
    customer: { id: string; name: string; email: string; phone: string | null } | null
    payment: {
      total: number
      paid: number
      refunded: number
      state: string
      events: { id: number; kind: string; amount: number; actorName: string | null }[]
    }
    emails: {
      id: number
      template: string
      status: string
      toEmail: string
      subject: string
      body: string
      sendAfter: number | null
      suppressedReason: string | null
    }[]
  }[]
  weddings: {
    id: string
    reference: string
    stage: string
    customer: { name: string; email: string } | null
    guestCount: number
    staffRequired: number
    driversRequired: number
    capacityBookedAt: number | null
    currentQuote: {
      version: number
      total: number
      guestCount: number
      tiers: { variantId: string; quantity: number }[]
    } | null
    quotes: { version: number; total: number; supersededAt: number | null }[]
    payment: { total: number; paid: number; events: { actorName: string | null }[] }
    loans: { id: number; item: string; returned: boolean; returnedAt: number | null }[]
    depositDue: number
    outstanding: number
  }[]
  weddingPackages: { id: string; name: string; basePrice: number }[]
  calendarSettings: { earliestCollectionTime: string; weddingDepositPercent: number }
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

export interface MutationReply {
  message: string
  tone: string
  orderId?: string
}

/** A customer to attach orders to. Every order needs one. */
export const TEST_CUSTOMER = {
  customerName: "Test Customer",
  customerEmail: "test.customer@example.com",
  customerPhone: "020 7946 0000",
}

/**
 * Confirms an order through the API, bypassing the date picker.
 *
 * Confirming no longer books the kitchen — see scheduleOrder. Most tests want
 * an order that holds ingredients, so they use placeAndSchedule.
 */
export async function confirmOrder(
  page: Page,
  productId: string,
  quantity: number,
  date: Date = collectionDate()
): Promise<MutationReply> {
  const response = await page.request.post("/api/orders", {
    // A plain shop day, exactly as the browser sends it. Passing an instant here
    // would hide the bug this suite exists to catch.
    data: { productId, quantity, collectionDay: shopDayOf(date), ...TEST_CUSTOMER },
  })
  return (await response.json()) as MutationReply
}

/** Runs any order action: schedule, start, ready, complete, cancel, pay, refund. */
export async function orderAction(
  page: Page,
  orderId: string,
  action: string,
  payload: Record<string, unknown> = {}
): Promise<MutationReply> {
  const response = await page.request.post(`/api/orders/${orderId}`, {
    data: { action, ...payload },
  })
  return (await response.json()) as MutationReply
}

/**
 * Confirm then schedule — the state most tests mean by "an order exists".
 * Scheduling is what runs the feasibility check, so this is where an order
 * either books its ingredients or goes On Hold.
 */
export async function placeOrder(
  page: Page,
  productId: string,
  quantity: number,
  date: Date = collectionDate()
): Promise<MutationReply> {
  const confirmed = await confirmOrder(page, productId, quantity, date)
  if (!confirmed.orderId) return confirmed
  const scheduled = await orderAction(page, confirmed.orderId, "schedule")
  return { ...scheduled, orderId: confirmed.orderId }
}

/**
 * Publishes a price for a variant that has none.
 *
 * Part of the range has no published price, and an order for an unpriced product
 * is refused rather than sold for nothing. Specs that exercise the kitchen still
 * need those products, so they set a price the way a manager would — through the
 * recipes endpoint — rather than the suite quietly assuming one.
 */
export async function priceVariant(page: Page, variantId: string, pence: number) {
  const state = await readState(page)
  const variant = state.variants.find((v) => v.id === variantId)
  if (!variant) throw new Error(`No such variant: ${variantId}`)
  const response = await page.request.post("/api/variants", {
    data: { ...variant, priceAmount: pence },
  })
  if (!response.ok()) throw new Error(`Could not price ${variantId}: ${response.status()}`)
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
