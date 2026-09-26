import { test, expect } from "@playwright/test"

import { resetDemoData, signInViaApi } from "./support"

/**
 * The demo gate.
 *
 * These assert the things that were previously untrue: that the data routes are
 * closed to a stranger, that the admin routes are closed to non-admins, and that
 * reset cannot be triggered by anyone who wanders onto the URL. They matter more
 * than most of the suite, because everything they cover is reachable from the
 * public internet the moment this is deployed.
 */

test.describe("without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("the dashboard data is not readable", async ({ page }) => {
    const response = await page.request.get("/api/state")
    expect(response.status()).toBe(401)
  })

  test("orders cannot be created", async ({ page }) => {
    const response = await page.request.post("/api/orders", {
      data: {
        productId: "suprema-classico",
        quantity: 1,
        collectionDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      },
    })
    expect(response.status()).toBe(401)
  })

  test("admin routes are closed", async ({ page }) => {
    const settings = await page.request.post("/api/settings", {
      data: { blockedWeekdays: [], earliestCollectionTime: "09:00", maxOrdersPerProductionDay: 99 },
    })
    expect(settings.status()).toBe(401)

    const restock = await page.request.post("/api/restock", {
      data: { ingredient: "eggs", amount: 100 },
    })
    expect(restock.status()).toBe(401)
  })

  test("reset is refused outright", async ({ page }) => {
    const response = await page.request.post("/api/reset")
    expect(response.status()).toBe(401)
  })

  test("reset is refused with the wrong token", async ({ page }) => {
    const response = await page.request.post("/api/reset", {
      headers: { authorization: "Bearer not-the-token" },
    })
    expect(response.status()).toBe(401)
  })

  test("the wrong password does not sign anyone in", async ({ page }) => {
    const response = await page.request.post("/api/auth", {
      data: { staffId: "aisha", password: "obviously-wrong" },
    })
    expect(response.status()).toBe(401)

    // And the session it did not create cannot read anything.
    const state = await page.request.get("/api/state")
    expect(state.status()).toBe(401)
  })
})

test.describe("with a session", () => {
  test("a non-admin is refused the admin routes but can still read", async ({ page }) => {
    await resetDemoData(page)
    // Tom is the seeded "staff" role, not an admin.
    await signInViaApi(page, "tom")

    const state = await page.request.get("/api/state")
    expect(state.ok()).toBeTruthy()

    const settings = await page.request.post("/api/settings", {
      data: { blockedWeekdays: [], earliestCollectionTime: "09:00", maxOrdersPerProductionDay: 99 },
    })
    expect(settings.status()).toBe(403)

    // Reset by session is admin-only too.
    const reset = await page.request.post("/api/reset")
    expect(reset.status()).toBe(403)
  })

  test("an admin can reset from the sidebar without any token", async ({ page }) => {
    await resetDemoData(page)
    await signInViaApi(page, "aisha")

    // No Authorization header: this is exactly what the sidebar button sends.
    const response = await page.request.post("/api/reset")
    expect(response.ok()).toBeTruthy()
  })
})
