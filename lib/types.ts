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
