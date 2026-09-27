import { enGB } from "date-fns/locale"

import { SHOP_TIME_ZONE } from "@/lib/shop-time"

/**
 * UK date formatting, in one place.
 *
 * Three separate problems are solved here.
 *
 * The obvious one is that this is a London bakery and "September 23rd, 2026" is
 * not how anyone there writes a date. The subtler one is that the app once
 * relied on the *machine's* locale — `toLocaleDateString()` with no argument —
 * so the same code rendered differently depending on who ran it.
 *
 * The third is the machine's *timezone*, which is why these moved off date-fns
 * to Intl. date-fns formats in whatever zone the process happens to be in.
 * That is fine in a London browser and wrong on a server: Vercel runs UTC, and
 * these same functions render the customer emails, so a 10:30 collection was
 * being written into a message as 09:30 — or, at the edges of a day, under the
 * wrong date entirely. Every formatter below is pinned to Europe/London, so a
 * given instant reads the same whoever renders it and wherever they are.
 */
export const UK_LOCALE = enGB

function formatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, ...options })
}

const LONG = formatter({ day: "numeric", month: "long", year: "numeric" })
const SHORT = formatter({ day: "2-digit", month: "2-digit", year: "numeric" })
const TIME = formatter({ hour: "2-digit", minute: "2-digit", hour12: false })

/** "23 September 2026" — for headings and detail fields. */
export function formatDateLong(date: Date | number): string {
  return LONG.format(date)
}

/** "23/09/2026" — for dense contexts like table cells. */
export function formatDateShort(date: Date | number): string {
  return SHORT.format(date)
}

/** "23 September 2026 at 14:05" — 24-hour, as used in the UK. */
export function formatDateTime(date: Date | number): string {
  return `${LONG.format(date)} at ${TIME.format(date)}`
}

/** "14:05" — 24-hour time on its own. */
export function formatTime(date: Date | number): string {
  return TIME.format(date)
}
