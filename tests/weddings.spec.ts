import { expect, test, type Page } from "@playwright/test"

import {
  committed,
  priceVariant,
  readState,
  resetDemoData,
  signInAs,
} from "./support"
import { addShopDays, shopDayOf } from "@/lib/shop-time"
import { weddingPaymentLabel } from "@/lib/weddings"

/**
 * The wedding pipeline, and the two decisions that are easy to get wrong.
 *
 * A wedding is not an Order. It books kitchen capacity directly through the same
 * ProductionLine seam, so these tests assert on the shared stock projection —
 * if a wedding's demand did not reach it, "feeds the existing calendar rather
 * than a parallel system" would be a claim rather than a fact.
 */

/** Far enough out that no lead time makes it impossible. */
function eventDay(): string {
  return addShopDays(shopDayOf(new Date()), 60)
}

async function logEnquiry(page: Page, guestCount = 100, email = "wedding@example.com") {
  const response = await page.request.post("/api/weddings", {
    data: {
      customerName: "Ada Fairweather",
      customerEmail: email,
      customerPhone: "07700 900123",
      eventDay: eventDay(),
      venue: "The Orangery",
      guestCount,
      flavourNotes: "Classic tiramisu",
      dietaryRequirements: "One nut allergy",
    },
  })
  return (await response.json()) as { weddingId?: string; message: string; tone: string }
}

async function weddingAction(
  page: Page,
  id: string,
  action: string,
  payload: Record<string, unknown> = {}
) {
  const response = await page.request.post(`/api/weddings/${id}`, { data: { action, ...payload } })
  return {
    status: response.status(),
    body: (await response.json()) as {
      message: string
      tone: string
      shortages?: { ingredient: string; shortBy: number }[]
    },
  }
}

async function quoteIt(page: Page, id: string, tiers: { variantId: string; quantity: number }[], guestCount = 100) {
  return weddingAction(page, id, "quote", {
    packageId: "classico-tray",
    guestCount,
    adjustments: [],
    tiers,
  })
}

async function findWedding(page: Page, id: string) {
  const state = await readState(page)
  return state.weddings.find((w) => w.id === id)!
}

test.beforeEach(async ({ page }) => {
  await resetDemoData(page)
  await signInAs(page, "Admin")
  // These specs assert exact money, so they pin the two prices they use rather
  // than depending on reference data the client may yet change.
  await priceVariant(page, "suprema-classico", 4500)
  await priceVariant(page, "grande-classico", 2800)
})

test.describe("a wedding is not an order", () => {
  test("an enquiry holds no capacity and creates no order", async ({ page }) => {
    const before = await readState(page)
    const created = await logEnquiry(page)
    expect(created.weddingId).toBeTruthy()

    const after = await readState(page)
    expect(after.orders).toHaveLength(before.orders.length)
    expect(committed(after, "eggs")).toBe(0)

    const wedding = await findWedding(page, created.weddingId!)
    expect(wedding.stage).toBe("Enquiry")
    expect(wedding.capacityBookedAt).toBeNull()
    // The customer is the same Customer an order uses.
    expect(wedding.customer?.email).toBe("wedding@example.com")
  })

  test("quoting moves it to Quoted and records a version", async ({ page }) => {
    const created = await logEnquiry(page)
    await quoteIt(page, created.weddingId!, [{ variantId: "suprema-classico", quantity: 2 }])

    const wedding = await findWedding(page, created.weddingId!)
    expect(wedding.stage).toBe("Quoted")
    expect(wedding.currentQuote?.version).toBe(1)
    // The Classico tray is the client's published £155.
    expect(wedding.currentQuote?.total).toBe(15500)
    expect(wedding.depositDue).toBe(7750) // the client's 50% deposit
  })
})

test.describe("capacity is booked at the configured stage", () => {
  test("nothing is held until the deposit, and then it is", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "suprema-classico", quantity: 2 }])

    // Seeded setting is AtDeposit, so a quote alone holds nothing.
    expect(committed(await readState(page), "eggs")).toBe(0)
    expect((await findWedding(page, id)).capacityBookedAt).toBeNull()

    await weddingAction(page, id, "stage", { stage: "DepositPaid" })

    const wedding = await findWedding(page, id)
    expect(wedding.capacityBookedAt).not.toBeNull()
    // Two Supremas are one batch: six eggs, through the SAME projection orders use.
    expect(committed(await readState(page), "eggs")).toBe(10)
  })

  test("the wedding's tiers reach the shared production calendar", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "suprema-classico", quantity: 2 }])
    await weddingAction(page, id, "stage", { stage: "DepositPaid" })

    const state = await readState(page)
    // Suprema's lead time is 2 days, counted in shop days from the event.
    const expected = addShopDays(eventDay(), -2)
    expect(state.productionDemand.map((d) => d.day)).toContain(expected)
  })

  test("cancelling hands the ingredients back", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "suprema-classico", quantity: 2 }])
    await weddingAction(page, id, "stage", { stage: "DepositPaid" })
    expect(committed(await readState(page), "eggs")).toBe(10)

    await weddingAction(page, id, "stage", { stage: "Cancelled" })

    expect(committed(await readState(page), "eggs")).toBe(0)
    expect((await findWedding(page, id)).capacityBookedAt).toBeNull()
  })
})

test.describe("changing the capacity setting cannot strand demand", () => {
  test("tightening leaves an already-booked wedding holding its capacity", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "suprema-classico", quantity: 2 }])
    await weddingAction(page, id, "stage", { stage: "DepositPaid" })
    const bookedAt = (await findWedding(page, id)).capacityBookedAt
    expect(bookedAt).not.toBeNull()
    expect(committed(await readState(page), "eggs")).toBe(10)

    // Tighten: deposit -> final confirmation. This wedding is only at
    // DepositPaid, so under the new rule it would NOT qualify.
    const settings = await page.request.post("/api/settings", {
      data: {
        blockedWeekdays: [1],
        earliestCollectionTime: "10:30",
        maxOrdersPerProductionDay: 20,
        shopName: "Paradiso",
        shopAddress: "",
        shopPhone: "",
        weddingCapacityStage: "AtConfirmation",
        weddingDepositPercent: 25,
      },
    })
    expect(settings.ok()).toBeTruthy()

    // The whole point: it keeps what it had. Freeing these ingredients would
    // strand the demand and the shortage would only appear on the day.
    const after = await findWedding(page, id)
    expect(after.capacityBookedAt).toBe(bookedAt)
    expect(committed(await readState(page), "eggs")).toBe(10)
  })

  test("loosening books a wedding that now qualifies", async ({ page }) => {
    // Start at confirmation, so a quoted wedding holds nothing.
    await page.request.post("/api/settings", {
      data: {
        blockedWeekdays: [1],
        earliestCollectionTime: "10:30",
        maxOrdersPerProductionDay: 20,
        shopName: "Paradiso",
        shopAddress: "",
        shopPhone: "",
        weddingCapacityStage: "AtConfirmation",
        weddingDepositPercent: 25,
      },
    })

    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "suprema-classico", quantity: 2 }])
    expect((await findWedding(page, id)).capacityBookedAt).toBeNull()
    expect(committed(await readState(page), "eggs")).toBe(0)

    // Loosen to "at quote" — this wedding is Quoted, so it now qualifies.
    await page.request.post("/api/settings", {
      data: {
        blockedWeekdays: [1],
        earliestCollectionTime: "10:30",
        maxOrdersPerProductionDay: 20,
        shopName: "Paradiso",
        shopAddress: "",
        shopPhone: "",
        weddingCapacityStage: "AtQuote",
        weddingDepositPercent: 25,
      },
    })

    expect((await findWedding(page, id)).capacityBookedAt).not.toBeNull()
    expect(committed(await readState(page), "eggs")).toBe(10)
  })
})

test.describe("amendments", () => {
  test("a new version is created and the old one is superseded", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "mini-classico", quantity: 2 }], 100)

    const first = await findWedding(page, id)
    expect(first.currentQuote?.version).toBe(1)

    await weddingAction(page, id, "quote", {
      packageId: "classico-tray",
      guestCount: 150,
      adjustments: [{ label: "Extra tier", amount: 12000 }],
      tiers: [{ variantId: "mini-classico", quantity: 3 }],
    })

    const after = await findWedding(page, id)
    expect(after.currentQuote?.version).toBe(2)
    expect(after.currentQuote?.guestCount).toBe(150)
    // The agreed figure is not rewritten — v1 survives with its own total.
    expect(after.quotes).toHaveLength(2)
    const v1 = after.quotes.find((q) => q.version === 1)!
    expect(v1.supersededAt).not.toBeNull()
    expect(v1.total).toBe(15500)
    expect(after.currentQuote?.total).toBe(27500)
  })

  test("an amendment that will not fit the kitchen is refused with the shortage", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "suprema-classico", quantity: 2 }])
    await weddingAction(page, id, "stage", { stage: "DepositPaid" })
    expect(committed(await readState(page), "eggs")).toBe(10)

    // Twenty eggs on hand; each Suprema batch takes ten and yields two.
    const result = await weddingAction(page, id, "quote", {
      packageId: "classico-tray",
      guestCount: 400,
      adjustments: [],
      tiers: [{ variantId: "suprema-classico", quantity: 20 }],
    })

    expect(result.body.tone).toBe("error")
    expect(result.body.shortages?.length).toBeGreaterThan(0)

    // Refused, not partially applied: still on v1, still holding the old demand.
    const after = await findWedding(page, id)
    expect(after.currentQuote?.version).toBe(1)
    expect(after.currentQuote?.tiers[0].quantity).toBe(2)
    expect(committed(await readState(page), "eggs")).toBe(10)
  })
})

test.describe("money reuses the order ledger", () => {
  test("a deposit is recorded and moves the stage", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "mini-classico", quantity: 2 }])

    const wedding = await findWedding(page, id)
    expect(wedding.depositDue).toBe(7750)

    await weddingAction(page, id, "pay", { amount: 7750 })

    const paid = await findWedding(page, id)
    expect(paid.payment.paid).toBe(7750)
    expect(paid.outstanding).toBe(15500 - 7750)
    expect(paid.payment.events[0].actorName).toBe("Mattia Paradiso")
    // Paying the deposit is a pipeline event, and books capacity under the
    // seeded setting.
    expect(paid.stage).toBe("DepositPaid")
    expect(paid.capacityBookedAt).not.toBeNull()
  })

  test("overpaying a wedding is refused", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!
    await quoteIt(page, id, [{ variantId: "mini-classico", quantity: 2 }])
    const result = await weddingAction(page, id, "pay", { amount: 78001 })
    expect(result.body.tone).toBe("error")
  })
})

test.describe("a missing package is refused, not priced at zero", () => {
  test("quoting against an unknown package errors rather than costing nothing", async ({ page }) => {
    const created = await logEnquiry(page)
    const result = await weddingAction(page, created.weddingId!, "quote", {
      packageId: "no-such-package",
      guestCount: 100,
      adjustments: [{ label: "Extra cutting cake", amount: 8000 }],
      tiers: [{ variantId: "mini-classico", quantity: 1 }],
    })
    // Silently using a zero base is how a live quote came out at £80 instead of
    // £860 — the sum of its adjustments, with nothing to say the base was gone.
    expect(result.body.tone).toBe("error")
    const wedding = await findWedding(page, created.weddingId!)
    expect(wedding.currentQuote).toBeNull()
  })

  test("the seeded packages are present", async ({ page }) => {
    const state = await readState(page)
    // The client's real range, priced from their published figures.
    expect(state.weddingPackages.map((p) => p.id)).toEqual([
      "four-tier-cake",
      "classico-tray",
      "classico-glass-dish",
    ])
  })
})

test.describe("extras are priced by the shop, not the browser", () => {
  test("the price list decides, and bulk breaks apply", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!

    // Thirty maxi cannoli at £4.00 is £120.00, less the client's 10% bulk break
    // from thirty, so £108.00 on top of the £155.00 tray.
    await weddingAction(page, id, "quote", {
      packageId: "classico-tray",
      guestCount: 100,
      adjustments: [],
      tiers: [{ variantId: "mini-classico", quantity: 2 }],
      extras: [{ extraId: "cannoli-maxi", quantity: 30 }],
    })

    const wedding = await findWedding(page, id)
    expect(wedding.currentQuote?.total).toBe(15500 + 10800)
  })

  test("one short of the break pays full price", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!

    await weddingAction(page, id, "quote", {
      packageId: "classico-tray",
      guestCount: 100,
      adjustments: [],
      tiers: [{ variantId: "mini-classico", quantity: 2 }],
      extras: [{ extraId: "cannoli-maxi", quantity: 29 }],
    })

    expect((await findWedding(page, id)).currentQuote?.total).toBe(15500 + 11600)
  })

  test("a price sent by the client is ignored", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!

    // The browser asks for eight pots at a penny each, and separately tries to
    // pass the priced line straight through. Neither sets the price.
    await weddingAction(page, id, "quote", {
      packageId: "classico-tray",
      guestCount: 100,
      adjustments: [{ label: "8oz pot × 8", amount: 8, kind: "extra", extraId: "pot-8oz" }],
      tiers: [{ variantId: "mini-classico", quantity: 2 }],
      extras: [{ extraId: "pot-8oz", quantity: 8, unitPrice: 1 }],
    })

    // Eight pots at the shop's £6.00, and the smuggled line dropped entirely.
    expect((await findWedding(page, id)).currentQuote?.total).toBe(15500 + 4800)
  })

  test("delivery under the minimum order is refused", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!

    // The glass dish is £50, well under the £200 delivery minimum.
    const result = await weddingAction(page, id, "quote", {
      packageId: "classico-glass-dish",
      guestCount: 20,
      adjustments: [],
      tiers: [{ variantId: "mini-classico", quantity: 1 }],
      extras: [],
      deliveryMiles: 5,
    })

    expect(result.body.tone).toBe("error")
    expect(result.body.message).toContain("minimum order")
    expect((await findWedding(page, id)).currentQuote).toBeNull()
  })

  test("delivery beyond the range is refused", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!

    const result = await weddingAction(page, id, "quote", {
      packageId: "four-tier-cake",
      guestCount: 80,
      adjustments: [],
      tiers: [{ variantId: "mini-classico", quantity: 4 }],
      extras: [],
      deliveryMiles: 60,
    })

    expect(result.body.tone).toBe("error")
    expect(result.body.message).toContain("50 miles")
  })

  test("delivery within the terms is charged by the mile", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!

    // £390 four-tier cake, twelve miles at £3.00.
    await weddingAction(page, id, "quote", {
      packageId: "four-tier-cake",
      guestCount: 80,
      adjustments: [],
      tiers: [{ variantId: "mini-classico", quantity: 4 }],
      extras: [],
      deliveryMiles: 12,
    })

    expect((await findWedding(page, id)).currentQuote?.total).toBe(39000 + 3600)
  })
})

test.describe("payment wording", () => {
  test("a wedding with its deposit paid is not called Unpaid", async ({ page }) => {
    // The order-side label only knows "paid in full", which is wrong for a
    // wedding paid in stages — and it said so on screen.
    expect(weddingPaymentLabel(78000, 0, 0, 19500)).toBe("Nothing paid yet")
    expect(weddingPaymentLabel(78000, 19500, 0, 19500)).toBe("Deposit paid")
    expect(weddingPaymentLabel(78000, 5000, 0, 19500)).toBe("Part paid")
    expect(weddingPaymentLabel(78000, 78000, 0, 19500)).toBe("Paid in full")
    expect(weddingPaymentLabel(78000, 78000, 78000, 19500)).toBe("Refunded")
  })
})

test.describe("logistics", () => {
  test("staff, drivers and loans are recorded and returnable", async ({ page }) => {
    const created = await logEnquiry(page)
    const id = created.weddingId!

    await weddingAction(page, id, "logistics", { staffRequired: 2, driversRequired: 1 })
    await weddingAction(page, id, "loan-out", { item: "Cake stand, 14-inch", quantity: 2 })

    let wedding = await findWedding(page, id)
    expect(wedding.staffRequired).toBe(2)
    expect(wedding.driversRequired).toBe(1)
    expect(wedding.loans).toHaveLength(1)
    expect(wedding.loans[0].returned).toBe(false)

    await weddingAction(page, id, "loan-return", { loanId: wedding.loans[0].id })

    wedding = await findWedding(page, id)
    expect(wedding.loans[0].returned).toBe(true)
    expect(wedding.loans[0].returnedAt).not.toBeNull()
  })
})

test.describe("roles", () => {
  test("the kitchen can see weddings but not change them", async ({ page }) => {
    const created = await logEnquiry(page)
    await signInAs(page, "Kitchen")

    const state = await readState(page)
    expect(state.weddings.length).toBeGreaterThan(0)

    const refused = await page.request.post(`/api/weddings/${created.weddingId}`, {
      data: { action: "stage", stage: "Quoted" },
    })
    expect(refused.status()).toBe(403)

    const cannotLog = await page.request.post("/api/weddings", {
      data: {
        customerName: "X",
        customerEmail: "x@example.com",
        eventDay: eventDay(),
        venue: "Y",
        guestCount: 10,
      },
    })
    expect(cannotLog.status()).toBe(403)
  })
})
