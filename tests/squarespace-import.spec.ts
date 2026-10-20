import { expect, test } from "@playwright/test"

import { matchProduct } from "@/lib/squarespace/catalogue"
import { parseCollectionDate } from "@/lib/squarespace/collection-date"
import { isCancelled, toPence } from "@/lib/squarespace/import"
import { windowDays } from "@/lib/squarespace/sync"

import { resetDemoData, signInAs } from "./support"

/**
 * The parts of the Squarespace import that decide what the kitchen makes, and
 * when. Every input here is copied from a real order on the live shop.
 */

test.describe("collection dates arrive month first", () => {
  test("reads Squarespace's unpadded US dates", () => {
    expect(parseCollectionDate("10/18/2026")).toBe("2026-10-18")
    expect(parseCollectionDate("9/30/2026")).toBe("2026-09-30")
    expect(parseCollectionDate("11/7/2026")).toBe("2026-11-07")
  })

  test("the 4th of October is not the 10th of April", () => {
    expect(parseCollectionDate("10/4/2026")).toBe("2026-10-04")
  })

  test("refuses rather than guesses", () => {
    expect(parseCollectionDate("18/10/2026")).toBeNull() // UK order: month 18 does not exist
    expect(parseCollectionDate("2/30/2026")).toBeNull()
    expect(parseCollectionDate("next Saturday")).toBeNull()
    expect(parseCollectionDate("")).toBeNull()
    expect(parseCollectionDate(null)).toBeNull()
  })

  test("accepts ISO in case the field ever changes", () => {
    expect(parseCollectionDate("2026-10-18")).toBe("2026-10-18")
  })
})

test.describe("only certain matches reach the production plan", () => {
  const size = (value: string) => [{ optionName: "Tiramisù Cake Size", value }]

  test("cakes match on flavour and size, whatever the size option is called", () => {
    expect(matchProduct("Classico tiramisù cake (V)", size("Grande-misù (8”, serves ~9)"))).toEqual({
      kind: "recipe",
      variantId: "grande-classico",
      note: null,
    })
    expect(
      matchProduct("Pistacchio and Nutella tiramisù cake (V)", [
        { optionName: "Tiramisù cake size", value: "Suprema-misù (12”, serves ~20/25)" },
      ])
    ).toMatchObject({ variantId: "suprema-pistacchio-nutella" })
    expect(
      matchProduct("Oreo & White Chocolate-misù Cake (V)", [{ optionName: "Size", value: "Mini-misù (6”, serves ~4)" }])
    ).toMatchObject({ variantId: "mini-oreo-white-chocolate" })
    expect(matchProduct("Biscoff tiramisù cake (V)", size("Mini-misù (6”, serves ~4)"))).toMatchObject({
      variantId: "mini-biscoff",
    })
  })

  test("a decorated seasonal cake is the base recipe, with the decoration noted", () => {
    expect(
      matchProduct("Halloween Classico Tiramisù Cake (V)", [
        ...size("Mini-misù (6”, serves ~4)"),
        { optionName: "Your Halloween Customization", value: "Pumpkin" },
      ])
    ).toEqual({ kind: "recipe", variantId: "mini-classico", note: "Halloween decoration: Pumpkin" })
  })

  test("one-size vegan and GF cakes wait for the shop to say which size they are", () => {
    expect(matchProduct("Vegan Classico").kind).toBe("needs-mapping")
    expect(matchProduct("GF Classico").kind).toBe("needs-mapping")
  })

  test("products with no portal recipe are reported, not forced onto one", () => {
    for (const name of ["Tiramisù Pot Bundle", "Tiramisù Dish", "Number-misù", "Mini cannoli bundle", "Cake topper sign"]) {
      expect(matchProduct(name).kind).toBe("no-recipe")
    }
    expect(matchProduct("Mango & Coconut-misù Cake (V)", size("Grande-misù (8”, serves ~9)")).kind).toBe("no-recipe")
  })

  test("a known cake with no size is not guessed", () => {
    expect(matchProduct("Classico tiramisù cake (V)").kind).toBe("needs-mapping")
  })
})

test.describe("money and cancellations", () => {
  test("prices become whole pence without passing through a float", () => {
    expect(toPence({ value: "30.00" })).toBe(3000)
    expect(toPence({ value: "17.5" })).toBe(1750)
    expect(toPence({ value: "0.10" })).toBe(10)
    expect(toPence(undefined)).toBe(0)
  })

  test("a full refund is a cancellation, even though fulfilment still says pending", () => {
    expect(isCancelled({ fulfillmentStatus: "PENDING", paymentState: "REFUNDED" })).toBe(true)
    expect(isCancelled({ fulfillmentStatus: "CANCELED", paymentState: "PAID" })).toBe(true)
    expect(isCancelled({ fulfillmentStatus: "PENDING", paymentState: "PAID" })).toBe(false)
    expect(isCancelled({ fulfillmentStatus: "FULFILLED", paymentState: "PAID" })).toBe(false)
  })
})

test.describe("how far back each sync reads", () => {
  const now = new Date("2026-10-20T09:00:00Z")
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000)

  test("the first run reads sixty days, so orders placed weeks ahead are found", () => {
    expect(windowDays(null, now)).toBe(60)
  })

  test("a run soon after the last one still overlaps by three days", () => {
    expect(windowDays(hoursAgo(1), now)).toBe(3)
  })

  test("after a gap it reads back to the last good run, with a day to spare", () => {
    expect(windowDays(hoursAgo(24 * 9 + 1), now)).toBe(11)
  })

  test("a very long gap is capped at sixty days", () => {
    expect(windowDays(hoursAgo(24 * 200), now)).toBe(60)
  })
})

test.describe("who can see and run the import", () => {
  test.beforeEach(async ({ page }) => {
    await resetDemoData(page)
  })

  for (const role of ["Kitchen", "ShopFloor"] as const) {
    test(`${role} is refused`, async ({ page }) => {
      await signInAs(page, role)
      const status = await page.request.get("/api/squarespace/status")
      expect(status.status()).toBe(403)
    })
  }

  test("a manager can see it", async ({ page }) => {
    await signInAs(page, "Manager")
    const status = await page.request.get("/api/squarespace/status")
    expect(status.status()).toBe(200)
    const body = await status.json()
    expect(body).toHaveProperty("lines")
    expect(body).toHaveProperty("enabled")
  })

  test("signed out, nothing", async ({ page }) => {
    const status = await page.request.get("/api/squarespace/status")
    expect(status.status()).toBe(401)
  })
})
