import { can, type StaffRole } from "@/lib/auth/roles"
import type { DashboardState } from "@/lib/server/serialize"

/**
 * Serves each role only the data it is allowed to see.
 *
 * The dashboard reads one endpoint for everything, so without this the Kitchen
 * screen would be *sent* every customer's name, email and phone number and the
 * full payment ledger, and then asked politely not to render them. A screen that
 * never receives a phone number cannot leak one — through a React devtools
 * panel, a stray console.log, or the next component someone writes.
 *
 * Deliberately removes rather than blanks. A key that is absent is obviously
 * absent; a key holding "" looks like a customer with no name.
 */
export function redactStateFor(role: StaffRole, state: DashboardState): DashboardState {
  const seesCustomers = can(role, "customers:view")
  const seesMoney = can(role, "payments:record") || can(role, "reports:view")

  if (seesCustomers && seesMoney) return state

  return {
    ...state,
    orders: state.orders.map((order) => ({
      ...order,
      customer: seesCustomers ? order.customer : null,
      // The messages are addressed to a customer and quote the order total, so
      // they belong to both permissions at once.
      emails: seesCustomers && seesMoney ? order.emails : [],
      payment: seesMoney
        ? order.payment
        : // Zeroed and emptied rather than dropped: the shape stays valid for
          // the UI, and there is no figure in it to read.
          { total: 0, paid: 0, refunded: 0, state: "Unpaid" as const, events: [] },
    })),
    // Weddings carry the same two things as an order — a named customer and a
    // ledger — and were being sent whole. The Kitchen screen lists them so the
    // bakes appear on the calendar; it does not need to know who is marrying or
    // what they still owe.
    weddings: state.weddings.map((wedding) => ({
      ...wedding,
      customer: seesCustomers ? wedding.customer : null,
      payment: seesMoney
        ? wedding.payment
        : { total: 0, paid: 0, refunded: 0, state: "Unpaid" as const, events: [] },
      // Derived from the quote, so they restate the total that was just removed.
      depositDue: seesMoney ? wedding.depositDue : 0,
      outstanding: seesMoney ? wedding.outstanding : 0,
      currentQuote: seesMoney ? wedding.currentQuote : null,
      quotes: seesMoney ? wedding.quotes : [],
    })),
  }
}
