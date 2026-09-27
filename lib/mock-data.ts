import type {
  CalendarSettings,
  IngredientInfo,
  IngredientKey,
  OrderStatus,
  ProductVariant,
  StaffMember,
} from "@/lib/types"

export const INGREDIENT_INFO: Record<IngredientKey, IngredientInfo> = {
  eggs: { key: "eggs", label: "Eggs", unit: "" },
  mascarpone: { key: "mascarpone", label: "Mascarpone", unit: "g" },
  savoiardi: { key: "savoiardi", label: "Savoiardi", unit: "g" },
  coffee: { key: "coffee", label: "Coffee", unit: "ml" },
  butter: { key: "butter", label: "Butter", unit: "g" },
}

export const INGREDIENT_ORDER: IngredientKey[] = [
  "eggs",
  "mascarpone",
  "savoiardi",
  "coffee",
  "butter",
]

/**
 * Recipes here are per BATCH. The amounts are unchanged from the per-unit era —
 * only their meaning moved — and unitsPerBatch says how many finished cakes that
 * batch yields.
 *
 * PLACEHOLDER PRICES. `priceAmount` is in pence and is a plausible invention,
 * not a figure from the client — exactly like the batch yields. The Recipes
 * screen labels them as placeholder so nobody quotes them to a customer.
 */
export const PRODUCT_VARIANTS: ProductVariant[] = [
  {
    id: "mini-classico",
    name: "Mini Classico",
    description: "A single elegant portion, dusted with cocoa.",
    servings: "Serves 1",
    requires: { eggs: 2, mascarpone: 150, savoiardi: 100, coffee: 50 },
    leadTimeDays: 2,
    unitsPerBatch: 8,
    priceAmount: 650,
  },
  {
    id: "grande-classico",
    name: "Grande Classico",
    description: "Layered for sharing — our most popular size.",
    servings: "Serves 4–6",
    requires: { eggs: 4, mascarpone: 300, savoiardi: 200, coffee: 100 },
    leadTimeDays: 2,
    unitsPerBatch: 4,
    priceAmount: 2800,
  },
  {
    id: "suprema-classico",
    name: "Suprema Classico",
    description: "Our signature showstopper, finished with coffee beans and mint.",
    servings: "Serves 8–10",
    requires: { eggs: 6, mascarpone: 500, savoiardi: 350, coffee: 150, butter: 100 },
    leadTimeDays: 4,
    unitsPerBatch: 2,
    priceAmount: 4500,
  },
]

export const INITIAL_STOCK: Record<IngredientKey, number> = {
  eggs: 20,
  mascarpone: 2000,
  savoiardi: 1500,
  coffee: 800,
  butter: 500,
}

/**
 * PLACEHOLDER wedding packages.
 *
 * Plausible names, inclusions and prices, invented — the client has not sent
 * theirs. Same standing as the batch yields and the product prices, and the
 * Weddings screen labels them as placeholder so nobody quotes one.
 */
export const WEDDING_PACKAGES: {
  id: string
  name: string
  description: string
  basePrice: number
  includes: string[]
}[] = [
  {
    id: "classico-tier",
    name: "Classico Tier",
    description: "Two tiers of the Classico recipe, finished simply.",
    basePrice: 45000,
    includes: [
      "Two tiers, serving up to 60",
      "Cocoa-dusted finish",
      "Delivery within Greater London",
      "Cake stand on loan",
    ],
  },
  {
    id: "celebration",
    name: "Celebration",
    description: "Three tiers with a cutting cake and a tasting session.",
    basePrice: 78000,
    includes: [
      "Three tiers, serving up to 120",
      "Matching cutting cake",
      "Tasting session for two",
      "Delivery and on-site setup",
      "Stands and trays on loan",
    ],
  },
  {
    id: "grand-affair",
    name: "Grand Affair",
    description: "Five tiers, bespoke finish, staffed setup on the day.",
    basePrice: 145000,
    includes: [
      "Five tiers, serving up to 250",
      "Bespoke decoration to your brief",
      "Tasting session for four",
      "Delivery, setup and a member of staff on site",
      "Full stand and tray hire",
    ],
  },
]

export const INITIAL_STAFF: StaffMember[] = [
  { id: "aisha", name: "Aisha Bello", role: "Admin", orderCount: 0 },
  { id: "tom", name: "Tom Whitfield", role: "Manager", orderCount: 0 },
  { id: "marco", name: "Marco Ferrari", role: "Kitchen", orderCount: 0 },
  { id: "nadia", name: "Nadia Haddad", role: "ShopFloor", orderCount: 0 },
]

/**
 * Seed calendar rules. These live in the database as editable settings — this
 * constant only supplies the starting values, exactly as INITIAL_STOCK does for
 * stock, so a fresh database and a demo reset agree.
 */
export const INITIAL_CALENDAR_SETTINGS: CalendarSettings = {
  // 1 = Monday. The shop does not do Monday collections.
  blockedWeekdays: [1],
  earliestCollectionTime: "10:30",
  // Deliberately generous: a ceiling the shop is nowhere near today, present so
  // the rule exists and can be tightened without a schema change.
  maxOrdersPerProductionDay: 20,
  // Placeholder shop details, same status as the prices. Editable in Calendar
  // Rules so the email templates never hardcode them.
  shopName: "Paradiso",
  shopAddress: "42 Bermondsey Street, London SE1 3XF",
  shopPhone: "020 7946 0112",
  // Seeded at deposit — money has changed hands, so the booking is real enough
  // to plan around. The client will have a view; this is where they change it.
  weddingCapacityStage: "AtDeposit",
  // PLACEHOLDER, same standing as the prices and batch yields.
  weddingDepositPercent: 25,
}

// Staff are now managed at runtime (added/removed/renamed via Staff Management), so
// colors can't be a fixed lookup keyed by name anymore — derive a stable color from
// the name instead, cycling through a small on-brand palette.
const STAFF_COLOR_PALETTE = [
  "bg-primary",
  "bg-chart-2",
  "bg-chart-4",
  "bg-chart-3",
  "bg-chart-5",
]

export function getStaffColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return STAFF_COLOR_PALETTE[hash % STAFF_COLOR_PALETTE.length]
}

// Hue carries the family, lightness carries the stage within it — soft for an
// in-progress state, solid for the one it terminates into:
//   neutral:     Confirmed (not yet holding oven capacity)
//   success:     Scheduled (soft)      -> Collected or delivered (solid)
//   primary:     In Production (soft)  -> Ready for collection (solid)
//   destructive: blocked (soft)        -> Cancelled (solid)
// The two blocked states share the soft destructive tint because they mean the
// same thing to the kitchen — not proceeding — and the label distinguishes why.
export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  Confirmed: "border-border bg-muted text-muted-foreground",
  Scheduled: "border-success/30 bg-success/10 text-success",
  "In Production": "border-primary/30 bg-primary/10 text-primary",
  "Ready for collection": "border-primary/40 bg-primary text-primary-foreground",
  "Collected or delivered": "border-success/40 bg-success text-success-foreground",
  "Details require clarification": "border-destructive/30 bg-destructive/10 text-destructive",
  "On Hold": "border-destructive/30 bg-destructive/10 text-destructive",
  Cancelled: "border-destructive/40 bg-destructive text-destructive-foreground",
}

export const STATUS_BAR_COLOR: Record<OrderStatus, string> = {
  Confirmed: "bg-muted-foreground",
  Scheduled: "bg-success",
  "In Production": "bg-primary",
  "Ready for collection": "bg-primary",
  "Collected or delivered": "bg-success",
  "Details require clarification": "bg-destructive",
  "On Hold": "bg-destructive",
  Cancelled: "bg-destructive",
}

/** Lifecycle order: how an order actually progresses, blocked states last. */
export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "Confirmed",
  "Scheduled",
  "In Production",
  "Ready for collection",
  "Collected or delivered",
  "Details require clarification",
  "On Hold",
  "Cancelled",
]

/**
 * Compact labels for places with no room for "Details require clarification" —
 * table cells, calendar chips, axis ticks. The full wording is the client's and
 * stays the canonical value; this is only ever a display shortening.
 */
export const STATUS_SHORT_LABEL: Record<OrderStatus, string> = {
  Confirmed: "Confirmed",
  Scheduled: "Scheduled",
  "In Production": "In production",
  "Ready for collection": "Ready",
  "Collected or delivered": "Collected",
  "Details require clarification": "Needs details",
  "On Hold": "On hold",
  Cancelled: "Cancelled",
}

