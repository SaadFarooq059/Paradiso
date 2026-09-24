import type {
  CalendarSettings,
  IngredientAmounts,
  IngredientKey,
  Order,
  OrderStatus,
  ProductVariant,
  ShortageReason,
  StaffMember,
} from "@/lib/types"

/**
 * The wire shape of the dashboard's state. Deliberately identical to the objects
 * CrmDashboard already held in React state, with Dates as ISO strings, so the
 * presentational panels need no changes when their data starts coming from the
 * database instead of useState.
 */
export interface SerializedOrder extends Omit<Order, "collectionDate"> {
  collectionDate: string
}

export interface SerializedProductionDayDemand {
  /** yyyy-mm-dd identity for the production day. */
  day: string
  date: string
  amounts: IngredientAmounts
  orderCount: number
}

export interface DashboardState {
  variants: ProductVariant[]
  ingredients: { key: IngredientKey; label: string; unit: string }[]
  /** Uncommitted stock on hand, keyed by ingredient. */
  stock: Record<IngredientKey, number>
  /**
   * What is physically in the building. The Stock Levels screen shows
   * committed = capacity - stock; both sides are now derived from the ledger
   * rather than stored, so a restock above the seed value can no longer make
   * committed read 0.
   */
  capacity: Record<IngredientKey, number>
  /**
   * Ingredient demand per production day, oldest first — the forward projection.
   * Answers "what is needed on the 23rd" rather than only "is there enough now".
   */
  productionDemand: SerializedProductionDayDemand[]
  staff: StaffMember[]
  orders: SerializedOrder[]
  restockLog: { id: string; ingredient: IngredientKey; amount: number; at: number }[]
  /**
   * The shop's calendar rules. Shipped with the rest of the state so the New
   * Order picker can apply exactly the rules the server enforces, without a
   * second round trip every time the selected product changes.
   */
  calendarSettings: CalendarSettings
}

/** Reads back the JSON-encoded ingredient snapshot stored on an order. */
export function parseConsumed(raw: string): IngredientAmounts {
  try {
    return JSON.parse(raw) as IngredientAmounts
  } catch {
    return {}
  }
}

export function parseShortages(raw: string): ShortageReason[] {
  try {
    return JSON.parse(raw) as ShortageReason[]
  } catch {
    return []
  }
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (
    value === "Scheduled" ||
    value === "In Production" ||
    value === "Ready" ||
    value === "Completed" ||
    value === "On Hold" ||
    value === "Cancelled"
  )
}
