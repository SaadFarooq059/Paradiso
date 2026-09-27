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
 */
/**
 * The client's real range: three sizes across six flavours.
 *
 * Only the Mini-misu prices are published. The two larger sizes are ESTIMATED
 * from them and carry `priceEstimated`, which every screen showing a price turns
 * into a visible "estimated, pending confirmation" — the same standing as the
 * batch yields. They are real enough to order against, and marked clearly enough
 * that the client corrects them rather than trusting them.
 *
 * One rule produces all eighteen, and it reproduces every published figure
 * exactly rather than inventing a curve:
 *
 *   price = servings x PER_SERVING + flavour premium
 *
 * At Mini that is 4 x £3.75 = £15.00 Classico, +£3.00 for the flavoured three
 * (£18.00), +£15.00 for vegan and gluten-free (£30.00) — the client's own three
 * numbers. The premiums stay flat across sizes because they are substitution
 * costs, not size costs; scaling them would put a vegan Suprema above the
 * 40-serving wedding tray.
 *
 * Coffee appears in Classico and nothing else, which is the shop's own rule.
 * Vegan and GF Classico are Classico, so they keep it.
 *
 * Still placeholder, and labelled as such in the UI: unitsPerBatch (the client
 * has not told us what a batch yields) and Suprema's four-day lead time — the
 * site says two days for everything, so which products genuinely need four is
 * an open question.
 */
/** Pence per serving, derived from the published £15.00 Mini-misu Classico. */
const PER_SERVING = 375
/** Flat premiums, as published at Mini size. */
const FLAVOUR_PREMIUM = 300
const FREE_FROM_PREMIUM = 1500
/** Servings each size is sold as; Suprema is the midpoint of "~20-25". */
const SERVINGS = { mini: 4, grande: 9, suprema: 22 } as const

function priceFor(size: keyof typeof SERVINGS, premium = 0) {
  return SERVINGS[size] * PER_SERVING + premium
}

export const PRODUCT_VARIANTS: ProductVariant[] = [
  {
    id: "mini-classico",
    name: "Mini-misu Classico",
    description: "6″. Coffee-soaked savoiardi, mascarpone cream, dusted with cocoa.",
    servings: "Serves ~4",
    requires: { eggs: 2, mascarpone: 150, savoiardi: 100, coffee: 50 },
    leadTimeDays: 2,
    unitsPerBatch: 8,
    priceAmount: priceFor("mini"),
  },
  {
    id: "mini-biscoff",
    name: "Mini-misu Biscoff",
    description: "6″. Biscoff biscuit and caramelised spread, no coffee.",
    servings: "Serves ~4",
    requires: { eggs: 2, mascarpone: 150, savoiardi: 100 },
    leadTimeDays: 2,
    unitsPerBatch: 8,
    priceAmount: priceFor("mini", FLAVOUR_PREMIUM),
  },
  {
    id: "mini-pistacchio-nutella",
    name: "Mini-misu Pistacchio & Nutella",
    description: "6″. Pistachio cream layered with Nutella, no coffee.",
    servings: "Serves ~4",
    requires: { eggs: 2, mascarpone: 150, savoiardi: 100 },
    leadTimeDays: 2,
    unitsPerBatch: 8,
    priceAmount: priceFor("mini", FLAVOUR_PREMIUM),
  },
  {
    id: "mini-oreo-white-chocolate",
    name: "Mini-misu Oreo & White Chocolate",
    description: "6″. Crushed Oreo and white chocolate, no coffee.",
    servings: "Serves ~4",
    requires: { eggs: 2, mascarpone: 150, savoiardi: 100 },
    leadTimeDays: 2,
    unitsPerBatch: 8,
    priceAmount: priceFor("mini", FLAVOUR_PREMIUM),
  },
  {
    id: "mini-vegan-classico",
    name: "Mini-misu Vegan Classico",
    description: "6″. The Classico, made without dairy or egg.",
    servings: "Serves ~4",
    requires: { eggs: 2, mascarpone: 150, savoiardi: 100, coffee: 50 },
    leadTimeDays: 2,
    unitsPerBatch: 8,
    priceAmount: priceFor("mini", FREE_FROM_PREMIUM),
  },
  {
    id: "mini-gf-classico",
    name: "Mini-misu GF Classico",
    description: "6″. The Classico, made with gluten-free savoiardi.",
    servings: "Serves ~4",
    requires: { eggs: 2, mascarpone: 150, savoiardi: 100, coffee: 50 },
    leadTimeDays: 2,
    unitsPerBatch: 8,
    priceAmount: priceFor("mini", FREE_FROM_PREMIUM),
  },
  {
    id: "grande-classico",
    name: "Grande-misu Classico",
    description: "8″. Coffee-soaked savoiardi, mascarpone cream, dusted with cocoa.",
    servings: "Serves ~9",
    requires: { eggs: 4, mascarpone: 300, savoiardi: 200, coffee: 100 },
    leadTimeDays: 2,
    unitsPerBatch: 4,
    priceAmount: priceFor("grande"),
    priceEstimated: true,
  },
  {
    id: "grande-biscoff",
    name: "Grande-misu Biscoff",
    description: "8″. Biscoff biscuit and caramelised spread, no coffee.",
    servings: "Serves ~9",
    requires: { eggs: 4, mascarpone: 300, savoiardi: 200 },
    leadTimeDays: 2,
    unitsPerBatch: 4,
    priceAmount: priceFor("grande", FLAVOUR_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "grande-pistacchio-nutella",
    name: "Grande-misu Pistacchio & Nutella",
    description: "8″. Pistachio cream layered with Nutella, no coffee.",
    servings: "Serves ~9",
    requires: { eggs: 4, mascarpone: 300, savoiardi: 200 },
    leadTimeDays: 2,
    unitsPerBatch: 4,
    priceAmount: priceFor("grande", FLAVOUR_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "grande-oreo-white-chocolate",
    name: "Grande-misu Oreo & White Chocolate",
    description: "8″. Crushed Oreo and white chocolate, no coffee.",
    servings: "Serves ~9",
    requires: { eggs: 4, mascarpone: 300, savoiardi: 200 },
    leadTimeDays: 2,
    unitsPerBatch: 4,
    priceAmount: priceFor("grande", FLAVOUR_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "grande-vegan-classico",
    name: "Grande-misu Vegan Classico",
    description: "8″. The Classico, made without dairy or egg.",
    servings: "Serves ~9",
    requires: { eggs: 4, mascarpone: 300, savoiardi: 200, coffee: 100 },
    leadTimeDays: 2,
    unitsPerBatch: 4,
    priceAmount: priceFor("grande", FREE_FROM_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "grande-gf-classico",
    name: "Grande-misu GF Classico",
    description: "8″. The Classico, made with gluten-free savoiardi.",
    servings: "Serves ~9",
    requires: { eggs: 4, mascarpone: 300, savoiardi: 200, coffee: 100 },
    leadTimeDays: 2,
    unitsPerBatch: 4,
    priceAmount: priceFor("grande", FREE_FROM_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "suprema-classico",
    name: "Suprema-misu Classico",
    description: "12″. Coffee-soaked savoiardi, mascarpone cream, dusted with cocoa.",
    servings: "Serves ~20–25",
    requires: { eggs: 10, mascarpone: 750, savoiardi: 500, coffee: 250, butter: 100 },
    leadTimeDays: 4,
    unitsPerBatch: 2,
    priceAmount: priceFor("suprema"),
    priceEstimated: true,
  },
  {
    id: "suprema-biscoff",
    name: "Suprema-misu Biscoff",
    description: "12″. Biscoff biscuit and caramelised spread, no coffee.",
    servings: "Serves ~20–25",
    requires: { eggs: 10, mascarpone: 750, savoiardi: 500, butter: 100 },
    leadTimeDays: 4,
    unitsPerBatch: 2,
    priceAmount: priceFor("suprema", FLAVOUR_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "suprema-pistacchio-nutella",
    name: "Suprema-misu Pistacchio & Nutella",
    description: "12″. Pistachio cream layered with Nutella, no coffee.",
    servings: "Serves ~20–25",
    requires: { eggs: 10, mascarpone: 750, savoiardi: 500, butter: 100 },
    leadTimeDays: 4,
    unitsPerBatch: 2,
    priceAmount: priceFor("suprema", FLAVOUR_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "suprema-oreo-white-chocolate",
    name: "Suprema-misu Oreo & White Chocolate",
    description: "12″. Crushed Oreo and white chocolate, no coffee.",
    servings: "Serves ~20–25",
    requires: { eggs: 10, mascarpone: 750, savoiardi: 500, butter: 100 },
    leadTimeDays: 4,
    unitsPerBatch: 2,
    priceAmount: priceFor("suprema", FLAVOUR_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "suprema-vegan-classico",
    name: "Suprema-misu Vegan Classico",
    description: "12″. The Classico, made without dairy or egg.",
    servings: "Serves ~20–25",
    requires: { eggs: 10, mascarpone: 750, savoiardi: 500, coffee: 250, butter: 100 },
    leadTimeDays: 4,
    unitsPerBatch: 2,
    priceAmount: priceFor("suprema", FREE_FROM_PREMIUM),
    priceEstimated: true,
  },
  {
    id: "suprema-gf-classico",
    name: "Suprema-misu GF Classico",
    description: "12″. The Classico, made with gluten-free savoiardi.",
    servings: "Serves ~20–25",
    requires: { eggs: 10, mascarpone: 750, savoiardi: 500, coffee: 250, butter: 100 },
    leadTimeDays: 4,
    unitsPerBatch: 2,
    priceAmount: priceFor("suprema", FREE_FROM_PREMIUM),
    priceEstimated: true,
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
/** What a stencilled message can say. */
export const STENCIL_OPTIONS = ["Just married", "Happy birthday", "Just graduated"]

/** The client's published wedding range. Real prices, real sizes. */
export const WEDDING_PACKAGES: {
  id: string
  name: string
  description: string
  basePrice: number
  serves: string
  dimensions: string
  stencilOptions: string[]
  includes: string[]
}[] = [
  {
    id: "four-tier-cake",
    name: "Four-tier cake",
    description: "The full tiered centrepiece.",
    basePrice: 39000,
    serves: "Up to 83",
    dimensions: "",
    stencilOptions: [],
    includes: ["Four tiers", "Serves up to 83", "Cake stand on loan (deposit refundable)"],
  },
  {
    id: "classico-tray",
    name: "Classico tray with stencil",
    description: "A single large tray, finished with a stencilled message.",
    basePrice: 15500,
    serves: "Approx. 40",
    dimensions: "32 x 52cm",
    stencilOptions: STENCIL_OPTIONS,
    includes: ["32 x 52cm tray", "Serves approx. 40", "Stencilled message", "Tray on loan (deposit refundable)"],
  },
  {
    id: "classico-glass-dish",
    name: "Classico glass dish with stencil",
    description: "A glass dish, stencilled — the smaller of the two trays.",
    basePrice: 5000,
    serves: "Approx. 20",
    dimensions: "39 x 27cm",
    stencilOptions: STENCIL_OPTIONS,
    includes: ["39 x 27cm glass dish", "Serves approx. 20", "Stencilled message", "Dish on loan (deposit refundable)"],
  },
]

/**
 * The client's priced extras.
 *
 * A catalogue rather than free-typed adjustments, so a quote is built from the
 * published figures and can be checked against them afterwards.
 */
export const WEDDING_EXTRAS: {
  id: string
  name: string
  description: string
  unitPrice: number
  unit: string
  bulkFrom?: number
  bulkDiscountPercent?: number
}[] = [
  { id: "pot-8oz", name: "8oz pot", description: "Individual portion.", unitPrice: 600, unit: "each" },
  {
    id: "cannoli-maxi",
    name: "Maxi cannoli",
    description: "10% off from 30 cannoli.",
    unitPrice: 400,
    unit: "each",
    bulkFrom: 30,
    bulkDiscountPercent: 10,
  },
  {
    id: "cannoli-mini",
    name: "Mini cannoli",
    description: "10% off from 30 cannoli.",
    unitPrice: 250,
    unit: "each",
    bulkFrom: 30,
    bulkDiscountPercent: 10,
  },
  {
    id: "delivery",
    name: "Delivery",
    description: "Up to 50 miles, minimum order £200. Collection is free.",
    unitPrice: 300,
    unit: "per mile",
  },
]

export const INITIAL_STAFF: StaffMember[] = [
  { id: "mattia", name: "Mattia Paradiso", role: "Admin", orderCount: 0 },
  { id: "marco-paradiso", name: "Marco Paradiso", role: "Manager", orderCount: 0 },
  { id: "kitchen", name: "Kitchen", role: "Kitchen", orderCount: 0 },
  { id: "shopfloor", name: "Shop floor", role: "ShopFloor", orderCount: 0 },
]

/**
 * Seed calendar rules. These live in the database as editable settings — this
 * constant only supplies the starting values, exactly as INITIAL_STOCK does for
 * stock, so a fresh database and a demo reset agree.
 */
export const INITIAL_CALENDAR_SETTINGS: CalendarSettings = {
  // 1 = Monday. The shop does not do Monday collections.
  blockedWeekdays: [1],
  earliestCollectionTime: "10:00",
  // Deliberately generous: a ceiling the shop is nowhere near today, present so
  // the rule exists and can be tightened without a schema change.
  maxOrdersPerProductionDay: 20,
  // Placeholder shop details, same status as the prices. Editable in Calendar
  // Rules so the email templates never hardcode them.
  shopName: "Paradiso Authentic Italian",
  shopAddress: "345 Sharrow Vale Road, Sheffield, S11 8ZG",
  shopPhone: "01143215027",
  shopEmail: "info@paradisoauthenticitalian.com",
  shopOpeningHours: "Monday closed · Tuesday to Saturday 10:00–17:00 · Sunday 10:00–16:00",
  // Seeded at deposit — money has changed hands, so the booking is real enough
  // to plan around. The client will have a view; this is where they change it.
  weddingCapacityStage: "AtDeposit",
  // The client's real terms.
  weddingDepositPercent: 50,
  weddingBalanceDueDaysBefore: 14,
  weddingQuoteTurnaround: "2-3 days",
  deliveryPerMile: 300,
  deliveryMaxMiles: 50,
  deliveryMinimumOrder: 20000,
  loanReturnDays: 7,
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

