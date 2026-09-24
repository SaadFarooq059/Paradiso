import { test, expect, type Page } from "@playwright/test"

function eggsCard(page: Page) {
  return page.locator("div", { hasText: "Eggs" }).filter({ has: page.getByText("available") }).last()
}

/**
 * Data now persists in SQLite, so this test can no longer rely on a fresh
 * in-memory store per run — it has to reset the database to the seed state
 * itself, or a second run would start with the previous run's orders.
 */
async function resetDemoData(page: Page) {
  const response = await page.request.post("/api/reset")
  expect(response.ok()).toBeTruthy()
}

async function signIn(page: Page) {
  await page.goto("/sign-in")
  // The staff picker defaults to the first roster entry (Aisha) — round-robin
  // assignment doesn't depend on who's signed in, so the default is fine here.
  await page.locator("#password").fill("dummy-password")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
}

/**
 * A collection date every seeded product can actually be made for.
 *
 * Lead times mean "today" is no longer selectable: Suprema needs 4 days, so a
 * date inside that window is refused by the picker and by the server. One week
 * out clears the longest seeded lead time; Mondays are skipped because the shop
 * does not do Monday collections. All three orders share this date so the stock
 * sequence below is unchanged — they still draw on one pool.
 */
function collectionDate(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 7)
  if (date.getDay() === 1) date.setDate(date.getDate() + 1)
  return date
}

/** Matches calendar.tsx's data-day, which is pinned to en-GB (dd/mm/yyyy). */
function dayAttribute(date: Date): string {
  return date.toLocaleDateString("en-GB")
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

  // --- Order 1: Suprema Classico x2 -> needs 12 eggs, stock starts at 20 ---
  await submitOrder(page, "Suprema Classico", 2)

  await page.getByRole("button", { name: "Orders" }).click()
  let firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("Scheduled")
  await expect(firstRow).toContainText("Aisha")

  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/8\s*available/)
  await expect(eggsCard(page)).toContainText(/12\s*committed/)

  // --- Order 2: Grande Classico x2 -> needs 8 eggs ---
  await page.getByRole("button", { name: "New Order" }).click()
  await submitOrder(page, "Grande Classico", 2)

  await page.getByRole("button", { name: "Orders" }).click()
  firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("Scheduled")
  await expect(firstRow).toContainText("Tom")

  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/^Eggs/)
  await expect(eggsCard(page)).toContainText(/0\s*available/)
  await expect(eggsCard(page)).toContainText(/20\s*committed/)

  // --- Order 3: Mini Classico x1 -> needs 2 eggs, 0 remaining ---
  await page.getByRole("button", { name: "New Order" }).click()
  await submitOrder(page, "Mini Classico", 1)

  await page.getByRole("button", { name: "Orders" }).click()
  firstRow = page.locator("table tbody tr").first()
  await expect(firstRow).toContainText("On Hold")
  await expect(firstRow).toContainText("—") // no staff assigned
  await expect(firstRow).toContainText("Short 2 eggs")

  // Stock must NOT have been deducted for the on-hold order
  await page.getByRole("button", { name: "Stock Levels" }).click()
  await expect(eggsCard(page)).toContainText(/0\s*available/)
})
