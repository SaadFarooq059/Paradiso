import type { VariantBatchDemand } from "@/lib/stock-projection"
import type { Prisma, $Enums } from "@prisma/client"

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
type DbOrderStatus = $Enums.OrderStatus

export interface SerializedOrder extends Omit<Order, "collectionDate"> {
  collectionDate: string
}

export interface SerializedProductionDayDemand {
  /** yyyy-mm-dd identity for the production day. */
  day: string
  date: string
  amounts: IngredientAmounts
  orderCount: number
  /** Per-variant batch breakdown: units ordered, batches run, units spare. */
  variants: VariantBatchDemand[]
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

/**
 * The database and the application spell two statuses differently, and the gap is
 * unavoidable: Postgres enum *labels* keep the human spelling ("In Production"),
 * but a Prisma enum *member* has to be a valid identifier, so the generated
 * client calls it `InProduction`.
 *
 * Rather than rename the app's OrderStatus union — which is what every badge,
 * table cell and status filter in the UI displays verbatim — the two are mapped
 * here, at the one boundary where rows cross into the application.
 */
const STATUS_FROM_DB: Record<DbOrderStatus, OrderStatus> = {
  Scheduled: "Scheduled",
  InProduction: "In Production",
  Ready: "Ready",
  Completed: "Completed",
  OnHold: "On Hold",
  Cancelled: "Cancelled",
}

const STATUS_TO_DB: Record<OrderStatus, DbOrderStatus> = {
  Scheduled: "Scheduled",
  "In Production": "InProduction",
  Ready: "Ready",
  Completed: "Completed",
  "On Hold": "OnHold",
  Cancelled: "Cancelled",
}

export function toAppStatus(status: DbOrderStatus): OrderStatus {
  return STATUS_FROM_DB[status]
}

export function toDbStatus(status: OrderStatus): DbOrderStatus {
  return STATUS_TO_DB[status]
}

/**
 * Reads the ingredient snapshot off an order. On SQLite this was a JSON string
 * that had to be parsed (and could throw); on Postgres it is real jsonb, so this
 * only has to narrow the type. The guard stays because Json is legitimately
 * nullable at the type level.
 */
export function parseConsumed(raw: Prisma.JsonValue | null | undefined): IngredientAmounts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as IngredientAmounts
}

/**
 * Widens a typed value for a jsonb column. Prisma's InputJsonValue only accepts
 * types with a string index signature, which an array of interfaces (like
 * ShortageReason[]) does not have even though it is perfectly valid JSON. One
 * helper here beats a cast at every call site.
 */
export function asJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue
}

export function parseShortages(raw: Prisma.JsonValue | null | undefined): ShortageReason[] {
  if (!Array.isArray(raw)) return []
  return raw as unknown as ShortageReason[]
}
