import { test, expect, type Page } from "@playwright/test"

import { DEV_ACCOUNTS } from "@/lib/auth/dev-accounts"
import { collectionDate, dayAttribute, priceVariant, resetDemoData } from "./support"

function eggsCard(page: Page) {
  return page.getByRole("listitem").filter({ hasText: /^Eggs/ })
}

/** Signs in through the form itself, as an Admin, who can do every step below. */
async function signIn(page: Page) {
  const account = DEV_ACCOUNTS.find((a) => a.role === "Admin")!
  await page.goto("/sign-in")
  await page.locator("#email").fill(account.email)
  await page.locator("#password").fill(account.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
}

async function pickCollectionDate(page: Page, date: Date) {
  await page.getByRole("button", { name: "Collection date" }).click()
  // The picker opens on the current month; step forward if the target is not in it.
  const today = new Date()
  const monthsAhead =
    (date.getFullYear() - today.getFullYear()) * 12 + (date.getMonth() - today.getMonth())
  for (let step = 0; step < monthsAhead; step++) {
    await page.getByRole("button", { name: /next month/i }).click()
  }
  await page.locator(`[data-day="${dayAttribute(date)}"]`).click()
}

/**
 * Confirms an order through the form, then schedules it from Order Detail.
 *
 * Two steps now, not one: confirming agrees the order with the customer and
 * holds no oven capacity, and Schedule is what runs the feasibility check. The
 * stock assertions below are about what scheduling books, so both have to run.
 */
async function submitOrder(page: Page, productName: string, quantity: number) {
  await page.getByRole("radio", { name: new RegExp(`^${productName}`) }).click()

  await page.locator('input[type="number"]').fill(String(quantity))

  // The customer is required — without it the submit button stays disabled.
  await page.getByLabel("Customer name").fill("Test Customer")
  await page.getByLabel("Customer email").fill("test.customer@example.com")

  await pickCollectionDate(page, collectionDate())

  // Scheduling is a server round-trip now, and on success the dashboard jumps to
  // the new order's detail view. Both have to be awaited: if the next click in the
  // test lands before the mutation resolves, the late state update drags the app
  // into Order Detail and whatever screen the test asked for isn't on screen.
  // This passed warm and failed cold, which is exactly the shape of that race.
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/orders") && response.request().method() === "POST"
    ),
    page.getByRole("button", { name: "Confirm order" }).click(),
  ])
  await expect(page.getByRole("heading", { name: "Order Detail" })).toBeVisible()

  // Confirmed holds nothing; Schedule is what books the kitchen.
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/orders/") && response.request().method() === "POST"
    ),
    page.getByRole("button", { name: "Schedule", exact: true }).click(),
  ])
}

test("order sequence: stock deduction, round-robin staff, and on-hold shortage", async ({ page }) => {
  await resetDemoData(page)
  await signIn(page)
  // This spec asserts exact stock arithmetic, so it pins both prices rather
  // than depending on reference data the client may yet change.
  await priceVariant(page, "suprema-classico", 4500)
  await priceVariant(page, "grande-classico", 2800)

  // --- Order 1: Suprema-misu Classico x2 ---
  // Batching changes this sum. Two Supremas are ONE batch (yield 2), so the draw
  // is 10 eggs, not 2 x 10.
  await submitOrder(page, "Suprema-misu Classico", 2)

  await page.getByRole("button", { name: "Orders" }).click()
  let firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("Scheduled")
  await expect(firstRow).toContainText("Mattia")

  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/10\s*available/)
  await expect(eggsCard(page)).toContainText(/10\s*committed/)

  // --- Order 2: Grande-misu Classico x2 ---
  // One batch again (yield 4), so 4 eggs rather than 2 x 4. Running total 14.
  await page.getByRole("button", { name: "New Order" }).click()
  await submitOrder(page, "Grande-misu Classico", 2)

  await page.getByRole("button", { name: "Orders" }).click()
  firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("Scheduled")
  await expect(firstRow).toContainText("Marco")

  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/^Eggs/)
  await expect(eggsCard(page)).toContainText(/6\s*available/)
  await expect(eggsCard(page)).toContainText(/14\s*committed/)

  // --- Order 3: Suprema-misu Classico x4 -> short ---
  // Four more Supremas take that production day from 2 units to 6, i.e. 1 batch
  // to 3. That is 20 more eggs against the 6 still free.
  await page.getByRole("button", { name: "New Order" }).click()
  await submitOrder(page, "Suprema-misu Classico", 4)

  await page.getByRole("button", { name: "Orders" }).click()
  firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("On Hold")
  await expect(firstRow).toContainText("—") // no staff assigned
  await expect(firstRow).toContainText("Short 14 eggs")

  // An On Hold order books no production, so the day's batches are untouched.
  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/6\s*available/)
  await expect(eggsCard(page)).toContainText(/14\s*committed/)
})
