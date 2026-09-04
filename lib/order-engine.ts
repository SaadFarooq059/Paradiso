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
 * Compares required ingredient amounts against currently available stock
 * (which already reflects deductions from every previously scheduled order).
 * Returns the list of ingredients that are short, and by how much.
 */
export function findShortages(
  needed: IngredientAmounts,
  available: Record<IngredientKey, number>
): ShortageReason[] {
  const shortages: ShortageReason[] = []
  for (const key of INGREDIENT_ORDER) {
    const amount = needed[key]
    if (!amount) continue
    const remaining = available[key] ?? 0
    if (amount > remaining) {
      shortages.push({ ingredient: key, shortBy: amount - remaining })
    }
  }
  return shortages
}

/** Deducts the given ingredient amounts from the available stock record (returns a new record). */
export function deductStock(
  available: Record<IngredientKey, number>,
  needed: IngredientAmounts
): Record<IngredientKey, number> {
  const next = { ...available }
  for (const key of INGREDIENT_ORDER) {
    const amount = needed[key]
    if (amount) {
      next[key] = (next[key] ?? 0) - amount
    }
  }
  return next
}

/**
 * Adds the given ingredient amounts back to the available stock record (returns a new record).
 * The inverse of deductStock — used for manual restocks and for refunding a cancelled order's
 * frozen consumedIngredients snapshot.
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
