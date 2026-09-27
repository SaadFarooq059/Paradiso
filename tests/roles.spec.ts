import { expect, test, type APIResponse } from "@playwright/test"

import {
  can,
  canUseView,
  landingViewFor,
  ROLE_LABEL,
  STAFF_ROLES,
  type Capability,
} from "@/lib/auth/roles"
import {
  collectionDate,
  confirmOrder,
  orderAction,
  readState,
  resetDemoData,
  signInAs,
  signOut,
} from "./support"
import { shopDayOf } from "@/lib/shop-time"

/**
 * Role enforcement, asked of the API rather than of the interface.
 *
 * A hidden nav item is not a control: the route behind it is a URL, and these
 * tests POST to it directly with no browser involved. The old suite proved a
 * button was missing, which proves nothing about what happens when someone
 * types the path.
 *
 * Every case is derived from the capability matrix rather than written out by
 * hand, so adding a role or moving a capability updates the expectations
 * automatically instead of leaving a stale assertion passing for the wrong
 * reason.
 */

/** Every guarded endpoint, and what it should demand. */
const ENDPOINTS: {
  name: string
  capability: Capability
  call: (page: Parameters<typeof readState>[0]) => Promise<APIResponse>
}[] = [
  {
    name: "POST /api/settings (calendar rules)",
    capability: "settings:manage",
    call: (page) =>
      page.request.post("/api/settings", {
        data: {
          blockedWeekdays: [1],
          earliestCollectionTime: "10:30",
          maxOrdersPerProductionDay: 20,
          shopName: "Paradiso",
        },
      }),
  },
  {
    name: "POST /api/variants (recipes)",
    capability: "recipes:manage",
    call: (page) =>
      page.request.post("/api/variants", {
        data: {
          id: "role-probe",
          name: "Role Probe",
          description: "d",
          servings: "1",
          requires: { eggs: 1 },
          leadTimeDays: 1,
          unitsPerBatch: 1,
          priceAmount: 100,
        },
      }),
  },
  {
    name: "DELETE /api/variants/:id (recipes)",
    capability: "recipes:manage",
    call: (page) => page.request.delete("/api/variants/role-probe"),
  },
  {
    name: "POST /api/staff (staff admin)",
    capability: "staff:manage",
    call: (page) =>
      page.request.post("/api/staff", {
        data: {
          id: "role-probe",
          name: "Role Probe",
          role: "ShopFloor",
          orderCount: 0,
          email: "role.probe@paradiso.test",
          password: "probe-password",
        },
      }),
  },
  {
    name: "DELETE /api/staff/:id (staff admin)",
    capability: "staff:manage",
    call: (page) => page.request.delete("/api/staff/role-probe"),
  },
  {
    name: "POST /api/restock (stock admin)",
    capability: "stock:restock",
    call: (page) => page.request.post("/api/restock", { data: { ingredient: "eggs", amount: 1 } }),
  },
  {
    name: "POST /api/reset (demo reset)",
    capability: "settings:manage",
    call: (page) => page.request.post("/api/reset"),
  },
]

test.describe("every guarded endpoint checks the role, not the nav", () => {
  for (const endpoint of ENDPOINTS) {
    for (const role of STAFF_ROLES) {
      const allowed = can(role, endpoint.capability)
      test(`${ROLE_LABEL[role]} ${allowed ? "may" : "may NOT"} ${endpoint.name}`, async ({ page }) => {
        await resetDemoData(page)
        await signInAs(page, role)
        const response = await endpoint.call(page)
        if (allowed) {
          expect(response.status(), "should not be refused").not.toBe(403)
          // Also not a crash: `not 403` alone would let a 500 through and call
          // the permission proven. It let exactly that happen the first time.
          expect(response.status(), "should not be a server error").toBeLessThan(500)
        } else {
          // The specific point of this suite: refused by the API itself.
          expect(response.status()).toBe(403)
        }
      })
    }
  }

  test("and refuses anyone who is not signed in at all", async ({ page }) => {
    await resetDemoData(page)
    await signOut(page)
    for (const endpoint of ENDPOINTS) {
      const response = await endpoint.call(page)
      expect(response.status(), `${endpoint.name} unauthenticated`).toBe(401)
    }
  })
})

test.describe("order actions are gated one by one", () => {
  /** Which role may drive which step of an order's life. */
  const ACTIONS: { action: string; capability: Capability }[] = [
    { action: "schedule", capability: "orders:schedule" },
    { action: "start", capability: "orders:advance:production" },
    { action: "ready", capability: "orders:advance:production" },
    { action: "complete", capability: "orders:advance:handover" },
    { action: "cancel", capability: "orders:cancel" },
    { action: "query", capability: "orders:query" },
    { action: "pay", capability: "payments:record" },
    { action: "refund", capability: "payments:refund" },
    { action: "cancel-and-refund", capability: "payments:refund" },
  ]

  for (const role of STAFF_ROLES) {
    test(`${ROLE_LABEL[role]} is refused exactly the actions it lacks`, async ({ page }) => {
      await resetDemoData(page)
      // An order to act on, created by someone who is allowed to create one.
      await signInAs(page, "Admin")
      const created = await confirmOrder(page, "mini-classico", 1, collectionDate())
      const orderId = created.orderId!

      await signInAs(page, role)
      for (const { action, capability } of ACTIONS) {
        const response = await page.request.post(`/api/orders/${orderId}`, {
          data: { action, amount: 100 },
        })
        if (can(role, capability)) {
          expect(response.status(), `${role} ${action} should not be 403`).not.toBe(403)
          expect(response.status(), `${role} ${action} should not 500`).toBeLessThan(500)
        } else {
          expect(response.status(), `${role} ${action} should be 403`).toBe(403)
        }
      }
    })
  }

  test("an unknown action is refused rather than allowed through", async ({ page }) => {
    await resetDemoData(page)
    await signInAs(page, "Admin")
    const created = await confirmOrder(page, "mini-classico", 1, collectionDate())
    const response = await page.request.post(`/api/orders/${created.orderId}`, {
      data: { action: "definitely-not-an-action" },
    })
    expect(response.status()).toBe(400)
  })

  test("creating an order needs orders:create", async ({ page }) => {
    await resetDemoData(page)
    for (const role of STAFF_ROLES) {
      await signInAs(page, role)
      const response = await page.request.post("/api/orders", {
        data: {
          productId: "mini-classico",
          quantity: 1,
          collectionDay: shopDayOf(collectionDate()),
          customerName: "Role Probe",
          customerEmail: "role.probe@example.com",
        },
      })
      if (can(role, "orders:create")) {
        expect(response.status(), `${role} should be able to create`).not.toBe(403)
      } else {
        expect(response.status(), `${role} should not be able to create`).toBe(403)
      }
    }
  })
})

test.describe("roles are not merely served a hidden screen", () => {
  test("the kitchen is never sent customer details or money", async ({ page }) => {
    await resetDemoData(page)
    await signInAs(page, "Admin")
    const created = await confirmOrder(page, "mini-classico", 1, collectionDate())
    await orderAction(page, created.orderId!, "schedule")
    await orderAction(page, created.orderId!, "pay", { amount: 650 })

    // What an Admin sees.
    const full = await readState(page)
    const asAdmin = full.orders.find((o) => o.id === created.orderId)!
    expect(asAdmin.customer).not.toBeNull()
    expect(asAdmin.payment.paid).toBe(650)

    // What the Kitchen is actually served — not hidden, absent.
    await signInAs(page, "Kitchen")
    const kitchen = await readState(page)
    const asKitchen = kitchen.orders.find((o) => o.id === created.orderId)!
    expect(asKitchen.customer).toBeNull()
    expect(asKitchen.payment.paid).toBe(0)
    expect(asKitchen.payment.total).toBe(0)
    expect(asKitchen.emails).toHaveLength(0)
    // The order itself is still there — the kitchen needs to know what to bake.
    expect(asKitchen.productId).toBe("mini-classico")

    // The raw response carries no trace either, in case a field is added later
    // and forgotten here.
    const raw = await (await page.request.get("/api/state")).text()
    expect(raw).not.toContain("role.probe@example.com")
    expect(raw).not.toContain("Test Customer")
  })

  test("shop-floor sees customers but not reports-only data", async ({ page }) => {
    await resetDemoData(page)
    await signInAs(page, "ShopFloor")
    const state = await readState(page)
    // It can take orders, so it must be able to see who they are for.
    expect(Array.isArray(state.orders)).toBe(true)
    expect(can("ShopFloor", "customers:view")).toBe(true)
    expect(can("ShopFloor", "reports:view")).toBe(false)
    expect(can("ShopFloor", "recipes:manage")).toBe(false)
  })
})

test.describe("a role lands somewhere it can actually use", () => {
  // Kitchen opened on New Order — hidden in its own sidebar and refused by the
  // API, so not a hole, but a role should not start on a dead end.
  for (const role of STAFF_ROLES) {
    test(`${ROLE_LABEL[role]} starts on a screen it holds the capability for`, ({}) => {
      const landing = landingViewFor(role)
      expect(canUseView(role, landing), `${role} landed on ${landing}`).toBe(true)
    })
  }

  test("Kitchen specifically does not land on New Order", () => {
    expect(canUseView("Kitchen", "new-order")).toBe(false)
    expect(landingViewFor("Kitchen")).not.toBe("new-order")
  })
})

test.describe("who did what", () => {
  test("the actor on a status change is the signed-in user, not a default", async ({ page }) => {
    await resetDemoData(page)
    await signInAs(page, "Admin")
    const created = await confirmOrder(page, "suprema-classico", 1, collectionDate())
    await orderAction(page, created.orderId!, "schedule")

    // A different real person moves it on.
    await signInAs(page, "Kitchen")
    await orderAction(page, created.orderId!, "start")

    await signInAs(page, "Admin")
    const state = await readState(page)
    const history = state.orders.find((o) => o.id === created.orderId)!.statusHistory

    expect(history.find((e) => e.status === "Confirmed")?.actorName).toBe("Aisha Bello")
    expect(history.find((e) => e.status === "In Production")?.actorName).toBe("Marco Ferrari")
  })

  test("a payment records who took it", async ({ page }) => {
    await resetDemoData(page)
    await signInAs(page, "Admin")
    const created = await confirmOrder(page, "mini-classico", 1, collectionDate())
    await orderAction(page, created.orderId!, "schedule")

    await signInAs(page, "ShopFloor")
    await orderAction(page, created.orderId!, "pay", { amount: 650 })

    await signInAs(page, "Admin")
    const state = await readState(page)
    const payment = state.orders.find((o) => o.id === created.orderId)!.payment
    expect(payment.events).toHaveLength(1)
    expect(payment.events[0].actorName).toBe("Nadia Haddad")
  })
})

test.describe("credentials", () => {
  test("a wrong password is refused, and says nothing about which half was wrong", async ({ page }) => {
    const wrongPassword = await page.request.post("/api/auth", {
      data: { email: "aisha@paradiso.test", password: "not-the-password" },
    })
    const unknownEmail = await page.request.post("/api/auth", {
      data: { email: "nobody@paradiso.test", password: "admin-demo" },
    })
    expect(wrongPassword.status()).toBe(401)
    expect(unknownEmail.status()).toBe(401)
    // Identical message, so the form cannot be used to discover real addresses.
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json())
  })

  test("the shared demo password is gone", async ({ page }) => {
    // The old scheme: any staff id plus one shared secret. It must not work in
    // any form, because it would bypass every role boundary above.
    for (const body of [
      { staffId: "aisha", password: "paradiso" },
      { email: "aisha@paradiso.test", password: "paradiso" },
    ]) {
      const response = await page.request.post("/api/auth", { data: body })
      expect(response.status()).toBe(401)
    }
  })

  test("passwords are never returned by the API", async ({ page }) => {
    await resetDemoData(page)
    await signInAs(page, "Admin")
    const raw = await (await page.request.get("/api/state")).text()
    expect(raw).not.toContain("passwordHash")
    expect(raw).not.toContain("$2b$")
    const auth = await (await page.request.get("/api/auth")).text()
    expect(auth).not.toContain("passwordHash")
    expect(auth).not.toContain("$2b$")
  })
})

test.describe("a session cannot be forged", () => {
  test("a hand-made cookie does not authenticate", async ({ page, context }) => {
    await resetDemoData(page)
    await signOut(page)
    // Exactly the shape the real cookie has, with a made-up signature.
    await context.addCookies([
      {
        name: "paradiso_session",
        value: `aisha.${Date.now()}.${"0".repeat(64)}`,
        url: "http://localhost:3100",
      },
    ])
    const response = await page.request.get("/api/state")
    expect(response.status()).toBe(401)
  })
})
