import { test, expect, type Page } from "@playwright/test"

import { collectionDate, dayAttribute, resetDemoData } from "./support"

function eggsCard(page: Page) {
  return page.locator("div", { hasText: "Eggs" }).filter({ has: page.getByText("available") }).last()
}

async function signIn(page: Page) {
  await page.goto("/sign-in")
  // The staff picker defaults to the first roster entry (Aisha) — round-robin
  // assignment doesn't depend on who's signed in, so the default is fine here.
  // The password is now checked server-side against DEMO_PASSWORD.
  const password = process.env.DEMO_PASSWORD
  expect(password, "DEMO_PASSWORD must be set for the suite to sign in").toBeTruthy()
  await page.locator("#password").fill(password!)
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

async function submitOrder(page: Page, productName: string, quantity: number) {
  await page.getByRole("radio", { name: new RegExp(`^${productName}`) }).click()

  await page.locator('input[type="number"]').fill(String(quantity))

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
    page.getByRole("button", { name: "Schedule Order" }).click(),
  ])
  await expect(page.getByRole("heading", { name: "Order Detail" })).toBeVisible()
}

test("order sequence: stock deduction, round-robin staff, and on-hold shortage", async ({ page }) => {
  await resetDemoData(page)
  await signIn(page)

  // --- Order 1: Suprema Classico x2 ---
  // Batching changes this sum. Two Supremas are ONE batch (yield 2), so the draw
  // is 6 eggs, not 2 x 6. Before batching this order took 12.
  await submitOrder(page, "Suprema Classico", 2)

  await page.getByRole("button", { name: "Orders" }).click()
  let firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("Scheduled")
  await expect(firstRow).toContainText("Aisha")

  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/14\s*available/)
  await expect(eggsCard(page)).toContainText(/6\s*committed/)

  // --- Order 2: Grande Classico x2 ---
  // One batch again (yield 4), so 4 eggs rather than 2 x 4. Running total 10.
  await page.getByRole("button", { name: "New Order" }).click()
  await submitOrder(page, "Grande Classico", 2)

  await page.getByRole("button", { name: "Orders" }).click()
  firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("Scheduled")
  await expect(firstRow).toContainText("Tom")

  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/^Eggs/)
  await expect(eggsCard(page)).toContainText(/10\s*available/)
  await expect(eggsCard(page)).toContainText(/10\s*committed/)

  // --- Order 3: Suprema Classico x4 -> short ---
  // A Mini x1 used to exhaust the last eggs and go On Hold. Under batching it
  // costs one 2-egg batch out of 10 remaining, so it no longer does. Four more
  // Supremas take that production day from 2 units to 6, i.e. 1 batch to 3, and
  // the extra 12 eggs are what the pool cannot cover.
  await page.getByRole("button", { name: "New Order" }).click()
  await submitOrder(page, "Suprema Classico", 4)

  await page.getByRole("button", { name: "Orders" }).click()
  firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("On Hold")
  await expect(firstRow).toContainText("—") // no staff assigned
  await expect(firstRow).toContainText("Short 2 eggs")

  // An On Hold order books no production, so the day's batches are untouched.
  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/10\s*available/)
  await expect(eggsCard(page)).toContainText(/10\s*committed/)
})
