import { isShopDay, type ShopDay } from "@/lib/shop-time"

/**
 * Reads the collection date a customer typed into Squarespace's checkout.
 *
 * Squarespace's date field answers in **US order, month first, unpadded** —
 * "10/4/2026" is the 4th of October, not the 10th of April. Read the UK way,
 * that is a cake planned six months out and a customer turning up to nothing,
 * so month-first is not a guess here: it is what every one of the live orders
 * shows, including the unambiguous ones ("10/18/2026", "9/30/2026").
 *
 * ISO "2026-10-04" is accepted too, in case Squarespace ever changes the field.
 * Anything else is refused rather than guessed at — the order is then recorded
 * as unreadable for a person to look at, which is the safe direction.
 */
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseCollectionDate(raw: string | null | undefined): ShopDay | null {
  const value = raw?.trim() ?? ""

  const us = US_DATE.exec(value)
  if (us) {
    const [, month, day, year] = us
    const candidate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    return isShopDay(candidate) ? candidate : null
  }

  if (ISO_DATE.test(value) && isShopDay(value)) return value
  return null
}

/** The checkout question that carries the date — its label names the notice period. */
export function isCollectionDateLabel(label: string | null | undefined): boolean {
  return /collection date/i.test(label ?? "")
}
