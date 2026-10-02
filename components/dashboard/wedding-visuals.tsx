import { SHOP_TIME_ZONE, shopDayOf, todayShopDay } from "@/lib/shop-time"
import { cn } from "@/lib/utils"

/**
 * The visual vocabulary shared by the wedding list and a wedding's own page, so
 * a stage or a date looks the same wherever it appears.
 */

export const STAGE_CLASS: Record<string, string> = {
  Enquiry: "border-border bg-muted text-muted-foreground",
  Quoted: "border-primary/30 bg-primary/10 text-primary",
  DepositPaid: "border-success/30 bg-success/10 text-success",
  Confirmed: "border-success/40 bg-success text-success-foreground",
  InProduction: "border-primary/30 bg-primary/10 text-primary",
  Delivered: "border-primary/40 bg-primary text-primary-foreground",
  Completed: "border-success/40 bg-success text-success-foreground",
  Cancelled: "border-destructive/40 bg-destructive text-destructive-foreground",
  Lost: "border-destructive/30 bg-destructive/10 text-destructive",
}

export const STAGE_DOT: Record<string, string> = {
  Enquiry: "bg-muted-foreground/50",
  Quoted: "bg-primary/50",
  DepositPaid: "bg-success/60",
  Confirmed: "bg-success",
  InProduction: "bg-primary",
  Delivered: "bg-primary",
  Completed: "bg-success",
}

// Pinned to the shop's zone, like every other date formatter in the app.
const DAY = new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, day: "numeric" })
const MONTH = new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, month: "short" })
const YEAR = new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, year: "numeric" })
export const WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, weekday: "long" })

/** Whole shop days from today to the event; negative once it has passed. */
export function daysUntil(eventDate: Date) {
  const event = Date.parse(`${shopDayOf(eventDate)}T12:00:00Z`)
  const today = Date.parse(`${todayShopDay()}T12:00:00Z`)
  return Math.round((event - today) / 86_400_000)
}

export function countdown(days: number) {
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days > 0) return `In ${days} days`
  return days === -1 ? "Yesterday" : `${-days} days ago`
}

/** A calendar page: the date is what a wedding is organised around. */
export function DateTile({ date, className }: { date: Date; className?: string }) {
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-center",
        className
      )}
    >
      <span className="bg-primary py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary-foreground">
        {MONTH.format(date)}
      </span>
      <span className="pt-1 font-mono text-xl font-semibold leading-none tabular-nums text-foreground">
        {DAY.format(date)}
      </span>
      <span className="pb-1 pt-0.5 text-[0.65rem] text-muted-foreground">{YEAR.format(date)}</span>
    </div>
  )
}
