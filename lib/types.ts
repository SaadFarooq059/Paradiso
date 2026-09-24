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
  requires: IngredientAmounts
  /**
   * Days between starting production and collection. The production date is
   * derived as collectionDate - leadTimeDays rather than stored, so editing a
   * recipe's lead time re-plans orders that have not been made yet.
   */
  leadTimeDays: number
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
}

export type StaffName = string

export type StaffRole = "admin" | "staff"

export type OrderStatus =
  | "Scheduled"
  | "In Production"
  | "Ready"
  | "Completed"
  | "On Hold"
  | "Cancelled"

export interface ShortageReason {
  ingredient: IngredientKey
  shortBy: number
}

export interface OrderStatusEvent {
  status: OrderStatus
  at: number
  note?: string
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
}

export interface StaffMember {
  id: string
  name: StaffName
  role: StaffRole
  orderCount: number
}

export interface RestockEntry {
  id: string
  ingredient: IngredientKey
  amount: number
  at: number
}
