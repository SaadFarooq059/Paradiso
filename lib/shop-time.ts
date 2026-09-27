/**
 * The shop's calendar, pinned to one timezone.
 *
 * A collection date is a *day the shop is open*, plus an opening time — not an
 * instant the client happened to pick. Treating it as an instant is what put
 * orders a day early in production: the picker yields local midnight, which in
 * BST serialises to 23:00 the previous day in UTC, and a UTC server then stamped
 * the opening time onto that earlier day.
 *
 * So the wire format is a plain `yyyy-mm-dd` with no zone in it at all, and the
 * server turns that into a moment here, in Europe/London. The runtime's own
 * timezone never enters into it — the same request produces the same instant
 * whether it is served from London, Washington or anywhere else.
 *
 * Deliberately no offset arithmetic and no fixed "+01:00" anywhere: British
 * Summer Time exists, so the offset depends on the date and has to be asked for
 * rather than assumed. Intl knows the rules; we do not.
 */

export const SHOP_TIME_ZONE = "Europe/London"

/** A calendar day in the shop's timezone, `yyyy-mm-dd`. */
export type ShopDay = string

const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/

export function isShopDay(value: unknown): value is ShopDay {
  if (typeof value !== "string" || !DAY_SHAPE.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  // Rejects 2026-02-30: round-tripping a real date gives a different day.
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function shopParts(instant: Date | number) {
  const parts = Object.fromEntries(
    PARTS.formatToParts(instant).map((part) => [part.type, part.value])
  ) as Record<string, string>
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // en-GB renders midnight as "24" in some ICU versions; normalise it.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** The shop's offset from UTC, in milliseconds, at a given instant. */
function shopOffsetAt(instant: number): number {
  const p = shopParts(instant)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant
}

/** Which shop day an instant falls on. */
export function shopDayOf(instant: Date | number): ShopDay {
  const p = shopParts(instant)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

/**
 * The instant at which a wall-clock time occurs in the shop's timezone.
 *
 * Resolved by asking what offset applies, then re-asking once: the first guess
 * can land on the wrong side of a daylight-saving change, and a single
 * correction settles it. Times that do not exist (the hour skipped each spring)
 * resolve forward rather than throwing — the shop does not open at 01:30.
 */
export function shopMoment(day: ShopDay, time = "00:00"): Date {
  if (!isShopDay(day)) throw new Error(`Not a shop day: ${JSON.stringify(day)}`)
  const [y, m, d] = day.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  const hours = Number.isFinite(hh) ? hh : 0
  const minutes = Number.isFinite(mm) ? mm : 0

  const asIfUtc = Date.UTC(y, m - 1, d, hours, minutes, 0, 0)
  let instant = asIfUtc - shopOffsetAt(asIfUtc)
  const settled = asIfUtc - shopOffsetAt(instant)
  if (settled !== instant) instant = settled
  return new Date(instant)
}

/** Pure day arithmetic — no timezone involved, so no DST to get wrong. */
export function addShopDays(day: ShopDay, amount: number): ShopDay {
  if (!isShopDay(day)) throw new Error(`Not a shop day: ${JSON.stringify(day)}`)
  const [y, m, d] = day.split("-").map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + amount))
  return shopDayOf0(shifted)
}

/** UTC-parts formatter for days already held as a UTC-midnight probe. */
function shopDayOf0(utcProbe: Date): ShopDay {
  const y = utcProbe.getUTCFullYear()
  const m = String(utcProbe.getUTCMonth() + 1).padStart(2, "0")
  const d = String(utcProbe.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** JavaScript getDay() numbering: 0 = Sunday. */
export function shopWeekdayOf(day: ShopDay): number {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Today, as the shop reckons it. */
export function todayShopDay(now: Date = new Date()): ShopDay {
  return shopDayOf(now)
}

/** Negative if a is before b. Safe to compare lexically, but this says why. */
export function compareShopDays(a: ShopDay, b: ShopDay): number {
  return a < b ? -1 : a > b ? 1 : 0
}
