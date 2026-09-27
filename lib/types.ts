export type IngredientKey = "eggs" | "mascarpone" | "savoiardi" | "coffee" | "butter"

export interface IngredientInfo {
  key: IngredientKey
  label: string
  unit: string
}

export type IngredientAmounts = Partial<Record<IngredientKey, number>>

export interface ProductVariant {
  id: string
  name: string
  description: string
  servings: string
  /**
   * Ingredients needed for ONE BATCH, not one unit. The kitchen bakes batches:
   * one batch makes two 12-inch cakes whether one or two were ordered.
   */
  requires: IngredientAmounts
  /**
   * How many finished units one batch produces. Demand is
   * ceil(units / unitsPerBatch) x requires — never units x requires.
   * A value of 1 reproduces the old per-unit behaviour exactly.
   */
  unitsPerBatch: number
  /**
   * Days between starting production and collection. The production date is
   * derived as collectionDate - leadTimeDays rather than stored, so editing a
   * recipe's lead time re-plans orders that have not been made yet.
   */
  leadTimeDays: number
  /**
   * PLACEHOLDER price in pence. The client has not given us real prices, the
   * same way they had not given us batch yields. Integer pence, never a float —
   * money must not be approximate.
   */
  priceAmount: number
}

/** JavaScript getDay() numbering: 0 = Sunday ... 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * The shop's calendar rules. Stored in the database, not hardcoded — the client
 * has said these will change, and changing them should not need a deploy.
 */
export interface CalendarSettings {
  /** Weekdays on which no order may be collected. */
  blockedWeekdays: Weekday[]
  /** Earliest collection time of day, "HH:mm" in 24-hour form. */
  earliestCollectionTime: string
  /** Ceiling on orders sharing one production day. */
  maxOrdersPerProductionDay: number
  /** Shop identity, used by the customer email templates. */
  shopName: string
  shopAddress: string
  shopPhone: string
  /** At what stage a wedding starts holding ingredients and production capacity. */
  weddingCapacityStage: WeddingCapacityStage
  /** PLACEHOLDER deposit percentage applied to a quote total. */
  weddingDepositPercent: number
}

export type StaffName = string

/**
 * Re-exported so there is exactly one definition. The capability matrix owns it,
 * because the roles only mean anything in terms of what they may do.
 */
export type { StaffRole } from "@/lib/auth/roles"
import type { StaffRole } from "@/lib/auth/roles"
import type { WeddingCapacityStage } from "@/lib/weddings"

/**
 * Where an order is in the fulfilment lifecycle — exactly one at a time.
 *
 * Payment is deliberately not in here. An order can be paid *and* in
 * production, and a refund can follow collection without un-collecting it, so
 * money is a second independent dimension (see PaymentSummary below).
 *
 * Whether a status books ingredients is decided only in LIVE_STATUSES
 * (lib/stock-projection.ts). "Confirmed" is not live: details are agreed but no
 * oven capacity is held until Schedule runs the feasibility check.
 */
export type OrderStatus =
  | "Confirmed"
  | "Scheduled"
  | "In Production"
  | "Ready for collection"
  | "Collected or delivered"
  | "Details require clarification"
  | "On Hold"
  | "Cancelled"

/** Derived from the payment ledger; never stored as a field of its own. */
export type PaymentState =
  | "Unpaid"
  | "Payment received"
  | "Partially refunded"
  | "Refunded"

export type PaymentEventKind = "Payment" | "Refund"

export interface PaymentEvent {
  id: number
  kind: PaymentEventKind
  /** Always positive, in pence. Direction comes from `kind`. */
  amount: number
  at: number
  /** Staff id, or null for anything recorded before actors were tracked. */
  actorId: string | null
  actorName: string | null
  note?: string
}

/** The money side of an order, all amounts in integer pence. */
export interface PaymentSummary {
  total: number
  paid: number
  refunded: number
  state: PaymentState
  events: PaymentEvent[]
}

export type EmailTemplateName =
  | "Confirmation"
  | "Reminder"
  | "Ready for collection"
  | "Follow-up"

/** Nothing is sent yet; this is what would go out, and when. */
export type EmailStatus = "Ready to send" | "Pending" | "Suppressed"

export interface OrderEmail {
  id: number
  template: EmailTemplateName
  status: EmailStatus
  toName: string
  toEmail: string
  subject: string
  body: string
  renderedAt: number
  /** When it would actually go out. Null means immediately. */
  sendAfter: number | null
  suppressedReason: string | null
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
}

export interface ShortageReason {
  ingredient: IngredientKey
  shortBy: number
}

export interface OrderStatusEvent {
  status: OrderStatus
  at: number
  note?: string
  /**
   * Who made the change. Null means the change predates actor tracking — which
   * is recorded as unknown rather than attributed to anyone.
   */
  actorId: string | null
  actorName: string | null
}

export interface Order {
  id: string
  productId: string
  quantity: number
  collectionDate: Date
  status: OrderStatus
  assignedStaff: StaffName | null
  shortages: ShortageReason[]
  /**
   * Ingredient amounts actually deducted from stock when this order was scheduled,
   * frozen at creation time. Empty for orders that never scheduled (On Hold, or
   * cancelled while On Hold). Always read this for "what did this order use" —
   * never recompute from the live product recipe, which may have changed since
   * this order was placed.
   */
  consumedIngredients: IngredientAmounts
  statusHistory: OrderStatusEvent[]
  createdAt: number
  /** Null for orders taken before customers existed. */
  customer: Customer | null
  payment: PaymentSummary
  /** Customer messages rendered for this order, oldest first. */
  emails: OrderEmail[]
}

export interface StaffMember {
  id: string
  name: StaffName
  role: StaffRole
  orderCount: number
  /** Sign-in address. Absent only on the seed roster constant. */
  email?: string
  /** A suspended account keeps its history but cannot sign in. */
  active?: boolean
}

export interface RestockEntry {
  id: string
  ingredient: IngredientKey
  amount: number
  at: number
}

/* ----------------------------------------------------------- weddings */

export interface WeddingPackage {
  id: string
  name: string
  description: string
  /** PLACEHOLDER base price, in pence. */
  basePrice: number
  includes: string[]
}

export interface QuoteTier {
  variantId: string
  quantity: number
  label: string
}

export interface WeddingQuote {
  id: string
  version: number
  packageId: string | null
  basePrice: number
  adjustments: { label: string; amount: number }[]
  total: number
  guestCount: number
  note: string | null
  createdAt: number
  actorName: string | null
  supersededAt: number | null
  tiers: QuoteTier[]
}

export interface EquipmentLoan {
  id: number
  item: string
  quantity: number
  outAt: number | null
  returned: boolean
  returnedAt: number | null
}

export interface WeddingStageEvent {
  stage: string
  at: number
  note?: string
  actorName: string | null
}

export interface Wedding {
  id: string
  reference: string
  stage: string
  customer: Customer | null
  /** The event day, as a shop-time moment. */
  eventDate: Date
  venue: string
  guestCount: number
  flavourNotes: string
  dietaryRequirements: string
  notes: string
  staffRequired: number
  driversRequired: number
  /** Non-null once this wedding holds kitchen capacity. */
  capacityBookedAt: number | null
  currentQuote: WeddingQuote | null
  /** Every version, newest first — the history of what was agreed. */
  quotes: WeddingQuote[]
  payment: PaymentSummary
  loans: EquipmentLoan[]
  stageHistory: WeddingStageEvent[]
  /** Derived: deposit due under the current setting. */
  depositDue: number
  outstanding: number
}
