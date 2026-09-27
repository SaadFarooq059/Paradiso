/**
 * What each role may do, in one table.
 *
 * This is the authority. The sidebar hides what a role cannot use, but hiding is
 * a courtesy to the person, not a control — every route behind those screens is
 * still a URL anyone can POST to. So the routes ask this matrix, and the nav
 * reads the same matrix so the two can never drift apart.
 *
 * Capabilities rather than role checks at the call site. `role === "Admin"`
 * scattered through the routes is how a fifth role becomes a week of grep; a
 * named capability says what is being protected and why, and adding a role means
 * adding one row here.
 */

export type StaffRole = "Admin" | "Manager" | "Kitchen" | "ShopFloor"

export const STAFF_ROLES: StaffRole[] = ["Admin", "Manager", "Kitchen", "ShopFloor"]

/** How each role is written for a human. */
export const ROLE_LABEL: Record<StaffRole, string> = {
  Admin: "Admin",
  Manager: "Manager",
  Kitchen: "Kitchen",
  ShopFloor: "Shop-floor",
}

export const ROLE_SUMMARY: Record<StaffRole, string> = {
  Admin: "Everything, including recipes, staff, calendar rules and refunds.",
  Manager: "Orders, production, stock and reports. Not staff admin or shop settings.",
  Kitchen: "The production calendar and moving orders through the kitchen. No money, no customer details.",
  ShopFloor: "Taking orders, taking payment and handing them over. No recipes, stock admin or reports.",
}

export type Capability =
  // --- orders ---------------------------------------------------------------
  | "orders:create"
  | "orders:schedule"
  | "orders:query"
  | "orders:cancel"
  /** Start production, mark ready — the kitchen's half of the lifecycle. */
  | "orders:advance:production"
  /** Mark collected — the counter's half. */
  | "orders:advance:handover"
  // --- money ----------------------------------------------------------------
  | "payments:record"
  | "payments:refund"
  // --- reading --------------------------------------------------------------
  | "customers:view"
  | "reports:view"
  | "production:view"
  | "stock:view"
  // --- administration -------------------------------------------------------
  | "stock:restock"
  | "recipes:manage"
  | "staff:manage"
  | "settings:manage"

const ADMIN: Capability[] = [
  "orders:create",
  "orders:schedule",
  "orders:query",
  "orders:cancel",
  "orders:advance:production",
  "orders:advance:handover",
  "payments:record",
  "payments:refund",
  "customers:view",
  "reports:view",
  "production:view",
  "stock:view",
  "stock:restock",
  "recipes:manage",
  "staff:manage",
  "settings:manage",
]

/**
 * Orders, production, stock and reports — but not the shop's own configuration.
 *
 * Refunds are deliberately Admin-only: they move money out of the business and
 * are the one action here with no way back.
 */
const MANAGER: Capability[] = [
  "orders:create",
  "orders:schedule",
  "orders:query",
  "orders:cancel",
  "orders:advance:production",
  "orders:advance:handover",
  "payments:record",
  "customers:view",
  "reports:view",
  "production:view",
  "stock:view",
  "stock:restock",
]

/**
 * The kitchen sees what to bake and says when it is baked.
 *
 * No money and no customer details — not merely hidden but absent from the data
 * this role is served, because a screen that never receives a phone number
 * cannot leak one.
 */
const KITCHEN: Capability[] = ["orders:advance:production", "production:view", "stock:view"]

/** The counter: take the order, take the money, hand it over. */
const SHOP_FLOOR: Capability[] = [
  "orders:create",
  "orders:schedule",
  "orders:query",
  "orders:advance:handover",
  "payments:record",
  "customers:view",
  "stock:view",
]

const CAPABILITIES: Record<StaffRole, Capability[]> = {
  Admin: ADMIN,
  Manager: MANAGER,
  Kitchen: KITCHEN,
  ShopFloor: SHOP_FLOOR,
}

export function can(role: StaffRole, capability: Capability): boolean {
  return CAPABILITIES[role]?.includes(capability) ?? false
}

export function capabilitiesOf(role: StaffRole): Capability[] {
  return CAPABILITIES[role] ?? []
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value)
}

/**
 * Which order action needs which capability.
 *
 * Kept beside the matrix rather than in the route, so the mapping from "an
 * action the UI can ask for" to "a thing a role may do" is reviewable in one
 * place. An action missing from here is refused rather than allowed — an
 * omission should fail closed.
 */
export const ORDER_ACTION_CAPABILITY: Record<string, Capability> = {
  schedule: "orders:schedule",
  start: "orders:advance:production",
  ready: "orders:advance:production",
  complete: "orders:advance:handover",
  recheck: "orders:schedule",
  query: "orders:query",
  resolve: "orders:query",
  cancel: "orders:cancel",
  pay: "payments:record",
  refund: "payments:refund",
  "cancel-and-refund": "payments:refund",
}

/**
 * Which capability each dashboard screen needs.
 *
 * Shared by the sidebar (to hide what a role cannot use) and by the dashboard
 * itself (to decide where a role lands, and to move it off a screen it has no
 * business on). Keeping one map stops the two disagreeing — which they did:
 * Kitchen opened on New Order, a screen its own sidebar was hiding.
 */
export const VIEW_CAPABILITY: Record<string, Capability | undefined> = {
  "new-order": "orders:create",
  orders: undefined,
  calendar: "production:view",
  recipes: "recipes:manage",
  restock: "stock:restock",
  stock: "stock:view",
  reports: "reports:view",
  staff: "staff:manage",
  "calendar-rules": "settings:manage",
}

/** The order a role is offered screens in; the first it can use is where it lands. */
const VIEW_ORDER = [
  "new-order",
  "orders",
  "calendar",
  "stock",
  "reports",
  "recipes",
  "restock",
  "staff",
  "calendar-rules",
]

export function canUseView(role: StaffRole, view: string): boolean {
  const needed = VIEW_CAPABILITY[view]
  // A screen with no capability listed — the preview mockups — is open to all.
  if (!(view in VIEW_CAPABILITY)) return true
  return !needed || can(role, needed)
}

/** Where this role should start. Never a screen it cannot use. */
export function landingViewFor(role: StaffRole): string {
  return VIEW_ORDER.find((view) => canUseView(role, view)) ?? "orders"
}
