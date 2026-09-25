import { INGREDIENT_ORDER } from "@/lib/mock-data"
import type { IngredientAmounts, IngredientKey, ShortageReason } from "@/lib/types"

/**
 * Adds ingredient amounts into a stock record (returns a new record).
 *
 * All that is left of the original engine. deductStock and findShortages went
 * when stock became a dated ledger; calculateIngredientsNeeded went when recipes
 * became per-batch, because multiplying a batch recipe by a unit count is no
 * longer a meaningful quantity. Scheduling arithmetic now lives in
 * lib/stock-projection.ts, which reasons in whole batches per production day.
 * Only restocking calls this.
 */
export function restockIngredients(
  available: Record<IngredientKey, number>,
  amounts: IngredientAmounts
): Record<IngredientKey, number> {
  const next = { ...available }
  for (const key of INGREDIENT_ORDER) {
    const amount = amounts[key]
    if (amount) {
      next[key] = (next[key] ?? 0) + amount
    }
  }
  return next
}

export function formatShortageLabel(shortage: ShortageReason, label: string, unit: string): string {
  const amount = Number.isInteger(shortage.shortBy)
    ? shortage.shortBy
    : Math.round(shortage.shortBy * 100) / 100
  return `Short ${amount}${unit} ${label.toLowerCase()}`
}
