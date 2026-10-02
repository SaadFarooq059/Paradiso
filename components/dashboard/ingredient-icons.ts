import { Coffee, Cookie, Cuboid, Egg, Milk, type LucideIcon } from "lucide-react"

import type { IngredientKey } from "@/lib/types"

/** One icon per ingredient, shared so Restock and Stock Levels read as one system. */
export const INGREDIENT_ICONS: Record<IngredientKey, LucideIcon> = {
  eggs: Egg,
  mascarpone: Milk,
  savoiardi: Cookie,
  coffee: Coffee,
  butter: Cuboid,
}
