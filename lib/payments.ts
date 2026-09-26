import type { PaymentState } from "@/lib/types"

/**
 * Money, in integer pence.
 *
 * Never floats: 0.1 + 0.2 is not 0.3, and a total that is a hundredth of a penny
 * out is a total that will not reconcile. Everything upstream — the variant's
 * price, the order total, every ledger entry — is a whole number of pence, and
 * this module is the only place it becomes a decimal, at the moment it is read.
 */

/**
 * The order's payment state, derived from the ledger totals rather than stored.
 *
 * Deriving it is what stops it drifting: a stored state and a ledger that
 * disagree is a bug you only find when someone reconciles the month.
 *
 * "Refunded" means everything that came in has gone back, which is why it is
 * measured against `paid` and not against `total` — an order that was part-paid
 * and then had that part returned is fully refunded, even though it was never
 * paid in full.
 */
export function paymentStateOf(total: number, paid: number, refunded: number): PaymentState {
  if (refunded > 0) return refunded >= paid ? "Refunded" : "Partially refunded"
  if (total > 0 && paid >= total) return "Payment received"
  return "Unpaid"
}

/** Pence to "£12.34". The only place money becomes text. */
export function formatMoney(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)
}

/** "12.34" (a form field) to 1234 pence. Returns null if it is not money. */
export function parseMoney(input: string): number | null {
  const trimmed = input.trim().replace(/^£/, "")
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  // Rounded rather than truncated, and via a string split rather than
  // multiplying by 100 — 19.99 * 100 is 1998.9999999999998 in binary floating
  // point, which truncates to the wrong penny.
  const [pounds, pence = ""] = trimmed.split(".")
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"))
}
