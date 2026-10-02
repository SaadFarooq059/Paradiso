"use client"

import { useMemo, useState } from "react"
import { addDays, format, startOfDay, startOfWeek } from "date-fns"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { BarChart3 } from "lucide-react"

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDateShort, UK_LOCALE } from "@/lib/format-date"
import { ORDER_STATUS_ORDER, STATUS_SHORT_LABEL } from "@/lib/mock-data"
import { dayKey } from "@/lib/production-schedule"
import type { Order, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Orders by status, across the collection dates they are booked for.
 *
 * The time axis is collection date, not when a status was set. Every order in
 * this app is created in a burst — the whole statusHistory of a session lands
 * within seconds — so plotting against those timestamps would draw one vertical
 * cliff and call it a trend. Collection date is the axis the shop actually
 * works to, and the one the Production Calendar is already organised around, so
 * this reads as the order book over time: how much is booked, when, and how
 * much of it is still unresolved.
 *
 * Series are stacked because the statuses partition the orders — every order is
 * in exactly one — so the outline of the stack is the total order book and each
 * band is its share. Nothing is double counted.
 */

/**
 * Series keys. A status name cannot be one: `--color-In Production` is not a
 * valid custom property, and recharts needs a key it can use as a dataKey.
 */
const STATUS_KEY: Record<OrderStatus, string> = {
  Confirmed: "confirmed",
  Scheduled: "scheduled",
  "In Production": "inProduction",
  "Ready for collection": "ready",
  "Collected or delivered": "collected",
  "Details require clarification": "awaitingDetails",
  "On Hold": "onHold",
  Cancelled: "cancelled",
}

/**
 * Six fills that stay distinct when stacked.
 *
 * The values live in globals.css as --status-* tokens, not here, for two
 * reasons: the stat tiles render outside the chart's own variable scope, so a
 * chart-scoped colour resolves to nothing on them, and dark mode needs its own
 * step rather than the light one reused — the tokens carry both.
 */
const STATUS_COLOR: Record<OrderStatus, string> = {
  Confirmed: "var(--status-confirmed)",
  Scheduled: "var(--status-scheduled)",
  "In Production": "var(--status-in-production)",
  "Ready for collection": "var(--status-ready)",
  "Collected or delivered": "var(--status-completed)",
  "Details require clarification": "var(--status-awaiting-details)",
  "On Hold": "var(--status-on-hold)",
  Cancelled: "var(--status-cancelled)",
}

const chartConfig = Object.fromEntries(
  ORDER_STATUS_ORDER.map((status) => [
    STATUS_KEY[status],
    { label: status, color: STATUS_COLOR[status] },
  ])
) satisfies ChartConfig

function seriesColor(status: OrderStatus): string {
  return STATUS_COLOR[status]
}

const HORIZONS = {
  "30d": { label: "Next 30 days", days: 30 },
  "90d": { label: "Next 90 days", days: 90 },
  all: { label: "All orders", days: null },
} as const

type HorizonKey = keyof typeof HORIZONS

/** Past this many daily buckets the axis is unreadable, so days roll up into weeks. */
const MAX_DAILY_BUCKETS = 21

interface Bucket {
  /** Full date, for the tooltip. */
  label: string
  /**
   * Short form for the axis. "w/c 28/09/2026" is wide enough that recharts
   * clips the first tick off the left edge — which is exactly where the busiest
   * week sits — so the axis gets "28 Sep" and the tooltip keeps the full date.
   */
  axisLabel: string
  start: Date
  counts: Record<string, number>
  total: number
}

function buildBuckets(orders: Order[], horizon: HorizonKey): Bucket[] {
  if (orders.length === 0) return []

  const today = startOfDay(new Date())
  const days = HORIZONS[horizon].days

  const inWindow =
    days === null
      ? orders
      : orders.filter((order) => {
          const date = startOfDay(order.collectionDate)
          return date >= today && date <= addDays(today, days)
        })

  if (inWindow.length === 0) return []

  const dates = inWindow.map((order) => startOfDay(order.collectionDate).getTime())
  const first = new Date(Math.min(...dates))
  const last = new Date(Math.max(...dates))
  const dailyBuckets = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1
  const weekly = dailyBuckets > MAX_DAILY_BUCKETS

  const buckets = new Map<string, Bucket>()
  const bucketStart = (date: Date) =>
    weekly ? startOfWeek(date, { weekStartsOn: 1 }) : startOfDay(date)

  // Seed every bucket across the span, so a quiet day reads as a gap in the
  // order book rather than being skipped and closing up the axis.
  for (
    let cursor = bucketStart(first);
    cursor <= last;
    cursor = addDays(cursor, weekly ? 7 : 1)
  ) {
    const key = dayKey(cursor)
    buckets.set(key, {
      label: weekly ? `Week of ${formatDateShort(cursor)}` : formatDateShort(cursor),
      axisLabel: format(cursor, "d MMM", { locale: UK_LOCALE }),
      start: cursor,
      counts: Object.fromEntries(ORDER_STATUS_ORDER.map((s) => [STATUS_KEY[s], 0])),
      total: 0,
    })
  }

  for (const order of inWindow) {
    const bucket = buckets.get(dayKey(bucketStart(order.collectionDate)))
    if (!bucket) continue
    const key = STATUS_KEY[order.status]
    bucket.counts[key] = (bucket.counts[key] ?? 0) + 1
    bucket.total += 1
  }

  return [...buckets.values()].sort((a, b) => a.start.getTime() - b.start.getTime())
}

interface TooltipPayloadItem {
  dataKey?: string | number
  value?: number
  payload?: { full?: string }
}

function StatusTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, item) => sum + (item.value ?? 0), 0)
  // Zero-count statuses are dropped: a tooltip listing four "0" rows buries the
  // one number the reader came for.
  const present = ORDER_STATUS_ORDER.map((status) => ({
    status,
    value: payload.find((item) => item.dataKey === STATUS_KEY[status])?.value ?? 0,
  })).filter((entry) => entry.value > 0)

  return (
    <div className="min-w-[11rem] rounded-lg bg-popover/95 p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm">
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
        <span className="text-sm font-semibold">{payload[0]?.payload?.full ?? label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {total} order{total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {present.map(({ status, value }) => (
          <div key={status} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: seriesColor(status) }}
              />
              <span className="text-xs text-muted-foreground">{status}</span>
            </span>
            <span className="font-mono text-sm font-medium tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrdersByStatusChart({ orders, className }: { orders: Order[]; className?: string }) {
  const [horizon, setHorizon] = useState<HorizonKey>("all")
  const buckets = useMemo(() => buildBuckets(orders, horizon), [orders, horizon])

  const windowTotal = buckets.reduce((sum, bucket) => sum + bucket.total, 0)
  const totals = ORDER_STATUS_ORDER.map((status) => ({
    status,
    // Counted from the buckets, not from `orders`, so the tiles and the chart
    // can never disagree about what the selected horizon contains.
    count: buckets.reduce((sum, bucket) => sum + (bucket.counts[STATUS_KEY[status]] ?? 0), 0),
  }))

  // A status with nothing in it still draws its stroke along the top of the
  // stack, so the last empty series paints the outline — a red "Cancelled" edge
  // over a chart with no cancellations. Only series that carry orders are drawn;
  // the tiles above still account for all six.
  const activeStatuses = totals.filter(({ count }) => count > 0).map(({ status }) => status)

  const data = buckets.map((bucket) => ({
    period: bucket.axisLabel,
    full: bucket.label,
    ...bucket.counts,
  }))

  return (
    <Card className={cn("@container", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">Orders by status</CardTitle>
            <CardDescription>
              The order book by collection date — how much is booked, when, and what state it is in.
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Select value={horizon} onValueChange={(value) => setHorizon(value as HorizonKey)}>
            <SelectTrigger className="w-40" aria-label="Time range">
              <SelectValue>
                {(value: string | null) => HORIZONS[(value ?? "all") as HorizonKey].label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(HORIZONS).map(([key, option]) => (
                <SelectItem key={key} value={key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {buckets.length === 0 ? (
          <Empty>
            <EmptyTitle>Nothing booked in this window</EmptyTitle>
            <EmptyDescription>
              {orders.length === 0
                ? "No orders yet — the pipeline will fill in here."
                : "No orders fall in the selected range. Try a longer one."}
            </EmptyDescription>
          </Empty>
        ) : (
          <>
            <div className="grid gap-4 @md:grid-cols-4 @3xl:grid-cols-8">
              {totals.map(({ status, count }) => (
                <div key={status} className="flex items-stretch gap-2.5">
                  <span
                    aria-hidden="true"
                    className="w-0.5 shrink-0 rounded-full"
                    style={{ backgroundColor: count > 0 ? seriesColor(status) : "var(--color-border)" }}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="truncate text-xs font-medium text-muted-foreground" title={status}>
                      {STATUS_SHORT_LABEL[status]}
                    </span>
                    <span className="font-mono text-2xl leading-none font-semibold tabular-nums text-foreground">
                      {count}
                    </span>
                    {/* Share of the window, not a change over time. There is no
                        earlier period to compare against, and inventing one
                        would be worse than showing nothing. */}
                    <span className="text-xs text-muted-foreground">
                      {windowTotal > 0 ? Math.round((count / windowTotal) * 100) : 0}% of {windowTotal}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <ChartContainer config={chartConfig} className="h-[280px] w-full @3xl:h-[340px]">
              {/* Columns, not areas: each bucket is a separate count of orders, and
                  an area drawn between them invents a slope across days nobody
                  ordered on. Stacked, because the statuses partition the orders. */}
              <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} />
                {/* Counts are whole orders, so the axis must not invent halves. */}
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                  tickMargin={4}
                />

                <ChartTooltip cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} content={<StatusTooltip />} offset={16} />

                {activeStatuses.map((status, i) => (
                  <Bar
                    key={status}
                    dataKey={STATUS_KEY[status]}
                    stackId="orders"
                    fill={seriesColor(status)}
                    // A 2px surface-coloured edge is the gap between stacked
                    // segments, so neighbours read apart without a drawn border.
                    stroke="var(--color-card)"
                    strokeWidth={2}
                    maxBarSize={24}
                    radius={i === activeStatuses.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}

                <ChartLegend content={<ChartLegendContent order={activeStatuses.map((s) => STATUS_KEY[s])} />} />
              </BarChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}
