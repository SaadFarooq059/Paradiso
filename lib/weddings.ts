/**
 * Wedding pipeline rules, as pure functions.
 *
 * Nothing here reads the database or knows what a request is, so the two things
 * most worth getting right — when a wedding starts holding kitchen capacity, and
 * what a quote comes to — are testable without a server.
 */

export type WeddingStage =
  | "Enquiry"
  | "Quoted"
  | "DepositPaid"
  | "Confirmed"
  | "InProduction"
  | "Delivered"
  | "Completed"
  | "Cancelled"
  | "Lost"

export type WeddingCapacityStage = "AtQuote" | "AtDeposit" | "AtConfirmation"

/** The straight-line progression. Cancelled and Lost sit outside it. */
export const WEDDING_PROGRESSION: WeddingStage[] = [
  "Enquiry",
  "Quoted",
  "DepositPaid",
  "Confirmed",
  "InProduction",
  "Delivered",
  "Completed",
]

export const WEDDING_STAGE_ORDER: WeddingStage[] = [...WEDDING_PROGRESSION, "Cancelled", "Lost"]

/** Terminal and not happening: contributes nothing to the kitchen, ever. */
export const DEAD_STAGES: WeddingStage[] = ["Cancelled", "Lost"]

export const WEDDING_STAGE_LABEL: Record<WeddingStage, string> = {
  Enquiry: "Enquiry",
  Quoted: "Quoted",
  DepositPaid: "Deposit paid",
  Confirmed: "Confirmed",
  InProduction: "In production",
  Delivered: "Delivered or collected",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Lost: "Lost",
}

export const CAPACITY_STAGE_LABEL: Record<WeddingCapacityStage, string> = {
  AtQuote: "When a quote is sent",
  AtDeposit: "When the deposit is paid",
  AtConfirmation: "At final confirmation",
}

export const CAPACITY_STAGE_SUMMARY: Record<WeddingCapacityStage, string> = {
  AtQuote:
    "Earliest. Holds ingredients for work that may never be confirmed, so the kitchen is never caught short — at the cost of stock reserved against quotes that fall through.",
  AtDeposit:
    "The default. Money has changed hands, so the booking is real enough to plan around.",
  AtConfirmation:
    "Latest. Nothing is reserved until the order is final, which risks confirming a wedding the kitchen cannot actually supply.",
}

/** The stage at which a wedding starts holding capacity, for a given setting. */
export const CAPACITY_THRESHOLD: Record<WeddingCapacityStage, WeddingStage> = {
  AtQuote: "Quoted",
  AtDeposit: "DepositPaid",
  AtConfirmation: "Confirmed",
}

/** Position in the progression, or -1 for the terminal stages. */
function progressionIndex(stage: WeddingStage): number {
  return WEDDING_PROGRESSION.indexOf(stage)
}

/** Has this wedding reached `threshold` in the straight-line progression? */
export function stageHasReached(stage: WeddingStage, threshold: WeddingStage): boolean {
  const here = progressionIndex(stage)
  const target = progressionIndex(threshold)
  if (here < 0 || target < 0) return false
  return here >= target
}

/** Would this wedding qualify to hold capacity under `setting`? */
export function qualifiesForCapacity(
  stage: WeddingStage,
  setting: WeddingCapacityStage
): boolean {
  if (DEAD_STAGES.includes(stage)) return false
  return stageHasReached(stage, CAPACITY_THRESHOLD[setting])
}

/**
 * Whether a wedding's units are booked into the kitchen right now.
 *
 * Reads the STORED capacityBookedAt, not (stage, setting). This is the rule that
 * stops a settings change stranding demand: once a wedding has committed, it
 * stays committed until it is cancelled, whatever the setting later becomes.
 * Deriving it instead would silently free ingredients the kitchen had already
 * promised, and the shortage would only appear on the day.
 */
export function holdsCapacity(wedding: {
  stage: WeddingStage
  capacityBookedAt: Date | null
}): boolean {
  if (DEAD_STAGES.includes(wedding.stage)) return false
  return wedding.capacityBookedAt !== null
}

/* --------------------------------------------------------------- quoting */

export interface QuoteAdjustment {
  label: string
  /** Pence. Negative is a discount. */
  amount: number
}

/** A quote's total: the package base plus every named adjustment. */
export function quoteTotal(basePrice: number, adjustments: QuoteAdjustment[]): number {
  return adjustments.reduce((total, adjustment) => total + adjustment.amount, basePrice)
}

/** The deposit due on a total, rounded to whole pence. */
export function depositAmount(total: number, percent: number): number {
  return Math.round((total * percent) / 100)
}

/** What a customer still owes: the agreed total less what has been paid net of refunds. */
export function outstandingAmount(total: number, paid: number, refunded: number): number {
  return Math.max(total - (paid - refunded), 0)
}

/**
 * The difference an amendment makes, for showing rather than silently applying.
 * Positive means the customer owes more.
 */
export function amendmentDelta(previousTotal: number, newTotal: number): number {
  return newTotal - previousTotal
}

/**
 * What to call a wedding's payment state.
 *
 * The order-side paymentStateOf only knows "paid in full" or not, which is right
 * for a counter transaction settled in one go and wrong here: a wedding with its
 * deposit paid and a balance to come is not "Unpaid", and saying so on the
 * screen is simply untrue.
 */
export function weddingPaymentLabel(
  total: number,
  paid: number,
  refunded: number,
  depositDue: number
): string {
  if (refunded > 0) return refunded >= paid ? "Refunded" : "Partially refunded"
  if (total > 0 && paid >= total) return "Paid in full"
  if (depositDue > 0 && paid >= depositDue) return "Deposit paid"
  if (paid > 0) return "Part paid"
  return "Nothing paid yet"
}
