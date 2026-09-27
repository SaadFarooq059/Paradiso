import { test, expect } from "@playwright/test"

import { DEV_ACCOUNTS } from "@/lib/auth/dev-accounts"
import { readState, resetDemoData, signInAs } from "./support"

/**
 * Changing your own password.
 *
 * Every role can, because the live accounts were handed out with generated
 * passwords and the Staff screen is Admin-only — a Kitchen user who cannot
 * change theirs keeps using the one that was sent to them.
 */

const KITCHEN = DEV_ACCOUNTS.find((a) => a.role === "Kitchen")!

async function change(page: import("@playwright/test").Page, current: string, next: string) {
  const response = await page.request.post("/api/account/password", {
    data: { currentPassword: current, newPassword: next },
  })
  return { status: response.status(), body: await response.json().catch(() => ({})) }
}

test.beforeEach(async ({ page }) => {
  await resetDemoData(page)
})

test("a signed-out request is refused", async ({ page }) => {
  await page.context().clearCookies()
  const result = await change(page, "anything", "a-long-enough-password")
  expect(result.status).toBe(401)
})

test("the current password is required, not just the session", async ({ page }) => {
  await signInAs(page, "Kitchen")
  const result = await change(page, "not-the-password", "a-long-enough-password")

  expect(result.status).toBe(403)
  // And the old one still works, so nothing was half-applied.
  const stillWorks = await page.request.post("/api/auth", {
    data: { email: KITCHEN.email, password: KITCHEN.password },
  })
  expect(stillWorks.ok()).toBeTruthy()
})

test("a short password is refused", async ({ page }) => {
  await signInAs(page, "Kitchen")
  const result = await change(page, KITCHEN.password, "short")
  expect(result.status).toBe(400)
})

test("Kitchen can change their own, and the new one is what works", async ({ page }) => {
  await signInAs(page, "Kitchen")
  const next = "a-properly-long-password"

  const result = await change(page, KITCHEN.password, next)
  expect(result.status).toBe(200)

  // The session survives the change rather than dumping them at the sign-in
  // screen — a fresh cookie is issued.
  expect((await readState(page)).variants.length).toBeGreaterThan(0)

  await page.request.delete("/api/auth")
  const withOld = await page.request.post("/api/auth", {
    data: { email: KITCHEN.email, password: KITCHEN.password },
  })
  expect(withOld.status()).toBe(401)

  const withNew = await page.request.post("/api/auth", {
    data: { email: KITCHEN.email, password: next },
  })
  expect(withNew.ok()).toBeTruthy()
})

test("changing a password does not change the role", async ({ page }) => {
  await signInAs(page, "Kitchen")
  await change(page, KITCHEN.password, "a-properly-long-password")

  // Still Kitchen: no money, no customer data.
  const settings = await page.request.post("/api/settings", {
    data: { blockedWeekdays: [], earliestCollectionTime: "09:00", maxOrdersPerProductionDay: 99 },
  })
  expect(settings.status()).toBe(403)
})
