import { execFileSync } from "node:child_process"

import { expect, test } from "@playwright/test"

import {
  confirmOrder,
  orderAction,
  priceVariant,
  readState,
  resetDemoData,
  signInViaApi,
} from "./support"
import { addShopDays, shopDayOf, shopMoment } from "@/lib/shop-time"

/**
 * The bug this file exists for.
 *
 * A collection date picked as 2 October was stored as 1 October in production
 * and went out in the customer's confirmation email that way. Nothing caught it
 * because the dev server, this test process and the browser all run
 * Europe/London, so client and server agreed and the disagreement only existed
 * on Vercel, which runs UTC.
 *
 * playwright.config.ts now starts the server with TZ=UTC while this process
 * stays in local time, so the two disagree here the same way they do in
 * production. Every assertion below fails against the old code.
 */

/** Far enough out to clear Suprema's four-day lead time, and never a Monday. */
function chosenDay(): string {
  const day = addShopDays(shopDayOf(new Date()), 12)
  // 1 = Monday, which the shop does not do collections on.
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  return weekday === 1 ? addShopDays(day, 1) : day
}

test.beforeEach(async ({ page }) => {
  await resetDemoData(page)
  await signInViaApi(page)
  // The larger sizes carry estimated prices, which the client may yet correct.
  // These specs assert exact money, so they pin the two they use rather than
  // depending on an estimate that is expected to move.
  await priceVariant(page, "suprema-classico", 4500)
  await priceVariant(page, "grande-classico", 2800)
})

test.describe("the shop's calendar does not depend on anyone's clock", () => {
  test("the day the client picks is the day that is stored", async ({ page }) => {
    const day = chosenDay()
    const created = await confirmOrder(page, "suprema-classico", 1, shopMoment(day, "00:00"))
    expect(created.orderId).toBeTruthy()

    const state = await readState(page)
    const order = state.orders.find((o) => o.id === created.orderId)!

    // The whole bug in one assertion: before the fix this came back as the day
    // before, because a London midnight is 23:00 the previous day in UTC.
    expect(shopDayOf(new Date(order.collectionDate))).toBe(day)
  })

  test("the production day is the collection day minus the lead time", async ({ page }) => {
    const day = chosenDay()
    const created = await confirmOrder(page, "suprema-classico", 1, shopMoment(day, "00:00"))
    await orderAction(page, created.orderId!, "schedule")

    const state = await readState(page)
    // Suprema's lead time is four days, counted in shop days.
    const expected = addShopDays(day, -4)
    const produced = state.productionDemand.map((d) => d.day)
    expect(produced).toContain(expected)
  })

  test("the reminder is dated the day before collection, and the email agrees", async ({ page }) => {
    const day = chosenDay()
    const created = await confirmOrder(page, "suprema-classico", 1, shopMoment(day, "00:00"))
    await orderAction(page, created.orderId!, "schedule")

    const state = await readState(page)
    const order = state.orders.find((o) => o.id === created.orderId)!

    const reminder = order.emails.find((e) => e.template === "Reminder")!
    expect(shopDayOf(new Date(reminder.sendAfter!))).toBe(addShopDays(day, -1))

    // The customer-facing text is rendered on the server. It must name the day
    // the customer chose, not the server's reading of it.
    const confirmation = order.emails.find((e) => e.template === "Confirmation")!
    const [year, month, dayOfMonth] = day.split("-").map(Number)
    const readable = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(new Date(Date.UTC(year, month - 1, dayOfMonth, 12)))
    expect(confirmation.body).toContain(readable)
    // And the shop's opening time on the shop's clock, not the server's. Read
    // from the settings rather than hard-coded, because it is the client's
    // trading hours and they are allowed to change them.
    const { calendarSettings } = await readState(page)
    expect(confirmation.body).toContain(`from ${calendarSettings.earliestCollectionTime}`)
  })

  test("a date the picker offers is a date the server accepts", async ({ page }) => {
    // The picker and the server run the same rules in different processes. If
    // one reasons in local days and the other in UTC days they disagree at the
    // edges, and a customer is offered a date that is then refused.
    const day = chosenDay()
    const created = await confirmOrder(page, "mini-classico", 1, shopMoment(day, "00:00"))
    expect(created.tone).not.toBe("error")

    const scheduled = await orderAction(page, created.orderId!, "schedule")
    expect(scheduled.tone).toBe("success")
  })

  test("a malformed day is refused rather than guessed at", async ({ page }) => {
    for (const bad of ["02/10/2026", "2026-13-01", "2026-02-30", "tomorrow", ""]) {
      const response = await page.request.post("/api/orders", {
        data: {
          productId: "mini-classico",
          quantity: 1,
          collectionDay: bad,
          customerName: "Test",
          customerEmail: "t@example.com",
        },
      })
      expect(response.status(), `should reject ${JSON.stringify(bad)}`).toBe(400)
    }
  })
})

test.describe("the shop-time primitives hold under any runtime zone", () => {
  // Belt and braces: the assertions above depend on the server being started
  // under UTC. These run the pure functions in child processes with the zone
  // forced, so the guarantee survives even if that arrangement is ever changed.
  const ZONES = ["UTC", "Europe/London", "America/New_York", "Pacific/Auckland"]

  for (const zone of ZONES) {
    test(`round-trips a day unchanged in ${zone}`, () => {
      const script = `
        const { shopDayOf, shopMoment, addShopDays } = require("./lib/shop-time.ts")
        const days = ["2026-10-02","2026-12-25","2026-03-29","2026-10-25","2026-01-01"]
        const bad = days.filter(d => shopDayOf(shopMoment(d, "10:30")) !== d)
        if (bad.length) { console.error("MISMATCH", bad.join(",")); process.exit(1) }
        if (addShopDays("2026-10-25", -1) !== "2026-10-24") { console.error("DST DAY MATHS"); process.exit(1) }
        if (addShopDays("2026-01-01", -1) !== "2025-12-31") { console.error("YEAR EDGE"); process.exit(1) }
        console.log("ok")
      `
      const out = execFileSync("npx", ["tsx", "-e", script], {
        env: { ...process.env, TZ: zone },
        encoding: "utf8",
      })
      expect(out.trim()).toBe("ok")
    })
  }
})
