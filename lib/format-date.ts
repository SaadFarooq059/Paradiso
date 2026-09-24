import { format } from "date-fns"
import { enGB } from "date-fns/locale"

/**
 * UK date formatting, in one place.
 *
 * Two separate problems are solved here. The obvious one is that this is a
 * London bakery and "September 23rd, 2026" is not how anyone there writes a
 * date. The subtler one is that the app previously relied on the *machine's*
 * locale in places — `toLocaleDateString()` with no argument — so the same code
 * rendered differently depending on who ran it, and a test that hardcoded the
 * US form passed only on a US-configured machine.
 *
 * Every formatter below pins en-GB explicitly. None of them consult the system
 * locale, so output is identical on every machine.
 */
export const UK_LOCALE = enGB

/** "23 September 2026" — for headings and detail fields. */
export function formatDateLong(date: Date | number): string {
  return format(date, "d MMMM yyyy", { locale: enGB })
}

/** "23/09/2026" — for dense contexts like table cells. */
export function formatDateShort(date: Date | number): string {
  return format(date, "dd/MM/yyyy", { locale: enGB })
}

/** "23 September 2026 at 14:05" — 24-hour, as used in the UK. */
export function formatDateTime(date: Date | number): string {
  return format(date, "d MMMM yyyy 'at' HH:mm", { locale: enGB })
}

/** "14:05" — 24-hour time on its own. */
export function formatTime(date: Date | number): string {
  return format(date, "HH:mm", { locale: enGB })
}
