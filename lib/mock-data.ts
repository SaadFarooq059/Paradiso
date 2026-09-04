import type {
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

export const PRODUCT_VARIANTS: ProductVariant[] = [
  {
    id: "mini-classico",
    name: "Mini Classico",
    description: "A single elegant portion, dusted with cocoa.",
    servings: "Serves 1",
    requires: { eggs: 2, mascarpone: 150, savoiardi: 100, coffee: 50 },
  },
  {
    id: "grande-classico",
    name: "Grande Classico",
    description: "Layered for sharing — our most popular size.",
    servings: "Serves 4–6",
    requires: { eggs: 4, mascarpone: 300, savoiardi: 200, coffee: 100 },
  },
  {
    id: "suprema-classico",
    name: "Suprema Classico",
    description: "Our signature showstopper, finished with coffee beans and mint.",
    servings: "Serves 8–10",
    requires: { eggs: 6, mascarpone: 500, savoiardi: 350, coffee: 150, butter: 100 },
  },
]

export const INITIAL_STOCK: Record<IngredientKey, number> = {
  eggs: 20,
  mascarpone: 2000,
  savoiardi: 1500,
  coffee: 800,
  butter: 500,
}

export const INITIAL_STAFF: StaffMember[] = [
  { id: "aisha", name: "Aisha", role: "admin", orderCount: 0 },
  { id: "tom", name: "Tom", role: "staff", orderCount: 0 },
]

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

// Three hue families (success / primary / destructive), each covering an "in-progress"
// status (soft tint) and the status it terminates into (solid fill):
//   success:     Scheduled (soft)      -> Completed (solid)
//   primary:     In Production (soft)  -> Ready (solid)
//   destructive: On Hold (soft)        -> Cancelled (solid)
export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  Scheduled: "border-success/30 bg-success/10 text-success",
  Completed: "border-success/40 bg-success text-success-foreground",
  "In Production": "border-primary/30 bg-primary/10 text-primary",
  Ready: "border-primary/40 bg-primary text-primary-foreground",
  "On Hold": "border-destructive/30 bg-destructive/10 text-destructive",
  Cancelled: "border-destructive/40 bg-destructive text-destructive-foreground",
}

export const STATUS_BAR_COLOR: Record<OrderStatus, string> = {
  Scheduled: "bg-success",
  Completed: "bg-success",
  "In Production": "bg-primary",
  Ready: "bg-primary",
  "On Hold": "bg-destructive",
  Cancelled: "bg-destructive",
}

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "Scheduled",
  "In Production",
  "Ready",
  "Completed",
  "On Hold",
  "Cancelled",
]
