import { test, expect, type Page } from "@playwright/test"

function eggsCard(page: Page) {
  return page.locator("div", { hasText: "Eggs" }).filter({ has: page.getByText("available") }).last()
}

async function signIn(page: Page) {
  await page.goto("/sign-in")
  // The staff picker defaults to the first roster entry (Aisha) — round-robin
  // assignment doesn't depend on who's signed in, so the default is fine here.
  await page.locator("#password").fill("dummy-password")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL("/")
}

async function submitOrder(page: Page, productName: string, quantity: number) {
  await page.getByRole("radio", { name: new RegExp(`^${productName}`) }).click()

  await page.locator('input[type="number"]').fill(String(quantity))

  await page.getByRole("button", { name: "Collection date" }).click()
  const today = new Date()
  const dataDay = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`
  await page.locator(`[data-day="${dataDay}"]`).click()

  await page.getByRole("button", { name: "Schedule Order" }).click()
}

test("order sequence: stock deduction, round-robin staff, and on-hold shortage", async ({ page }) => {
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
