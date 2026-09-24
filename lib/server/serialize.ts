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

export interface DashboardState {
  variants: ProductVariant[]
  ingredients: { key: IngredientKey; label: string; unit: string }[]
  /** Uncommitted stock on hand, keyed by ingredient. */
  stock: Record<IngredientKey, number>
  /**
   * Total stock brought into the pool. The Stock Levels screen shows
   * committed = capacity - available; on main both came from the INITIAL_STOCK
   * constant, so a restock above the seed value made committed read 0.
   */
  capacity: Record<IngredientKey, number>
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
