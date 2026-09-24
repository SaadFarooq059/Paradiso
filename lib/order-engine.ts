import { INGREDIENT_ORDER } from "@/lib/mock-data"
import type { IngredientAmounts, IngredientKey, ProductVariant, ShortageReason } from "@/lib/types"

/** Multiplies a product variant's per-unit ingredient requirements by quantity. */
export function calculateIngredientsNeeded(
  variant: ProductVariant,
  quantity: number
): IngredientAmounts {
  const needed: IngredientAmounts = {}
  for (const key of INGREDIENT_ORDER) {
    const perUnit = variant.requires[key]
    if (perUnit) {
      needed[key] = perUnit * quantity
    }
  }
  return needed
}

/**
 * Adds ingredient amounts into a stock record (returns a new record).
 *
 * Only restocking calls this now. Its former partner deductStock, and
 * findShortages beside it, went when stock became a dated ledger: scheduling no
 * longer subtracts from a running total, and "is there enough?" is answered per
 * production day by lib/stock-projection.ts instead.
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
