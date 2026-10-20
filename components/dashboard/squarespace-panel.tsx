"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronRight, CircleAlert, CircleCheck, CirclePause, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateLong, formatDateTime } from "@/lib/format-date"
import { compareShopDays, shopMoment, todayShopDay } from "@/lib/shop-time"
import type { SquarespaceLineView, SquarespaceStatus } from "@/lib/squarespace/sync"
import { STATUS_BADGE_CLASS } from "@/lib/mock-data"
import type { OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * What came in from Squarespace, and what did not and why.
 *
 * The orders that were imported already sit in Orders and on the Calendar like
 * any other; this screen exists for the rest. Every line the shop sold for an
 * upcoming collection is here, sorted by what the shop needs to do about it, so
 * nothing the kitchen has to make can quietly fall between the two systems.
 */

const GROUPS: {
  key: string
  title: string
  description: string
  outcomes: string[]
}[] = [
  {
    key: "attention",
    title: "Needs an answer",
    description:
      "Cakes the portal could not place in the plan without guessing. Until they are mapped, plan these from Squarespace.",
    outcomes: ["needs-mapping", "date-unreadable", "no-date", "missing-variant"],
  },
  {
    key: "imported",
    title: "In the production plan",
    description:
      "Copied into Orders as Confirmed. Open one and press Schedule to book it into the kitchen, as with a counter order.",
    outcomes: ["imported"],
  },
  {
    key: "no-recipe",
    title: "Not in the portal yet",
    description:
      "Products the portal has no recipe for — pots, dishes, Number-misù, cannoli, toppers. Still made from Squarespace as today.",
    outcomes: ["no-recipe"],
  },
  {
    key: "other",
    title: "Cancelled, and nothing to bake",
    description:
      "Refunded or cancelled on Squarespace before they were imported, gift cards, and shop items like coffee.",
    outcomes: ["cancelled", "not-a-product"],
  },
]

const OUTCOME_LABEL: Record<string, string> = {
  imported: "In the plan",
  "no-recipe": "No portal recipe",
  "needs-mapping": "Size unknown",
  "not-a-product": "Nothing to bake",
  "no-date": "No collection date",
  "date-unreadable": "Date unreadable",
  past: "Collected",
  cancelled: "Cancelled",
  "missing-variant": "Recipe missing",
}

function ago(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  return formatDateTime(new Date(iso))
}

/**
 * "Size=Mini-misù (6”, serves ~4), Flavour=Classico" → "Mini-misù (6”, serves ~4) · Classico".
 * Values contain commas of their own, so a comma only separates options when
 * the next part is a new "Name=".
 */
function optionValues(options: string): string {
  return options
    .split(/, (?=[^,=]+=)/)
    .map((option) => option.slice(option.indexOf("=") + 1))
    .join(" · ")
}

/** Shop items with no recipe and no collection date (coffee, merch) — nothing for the kitchen. */
function isShopItem(line: SquarespaceLineView): boolean {
  return line.outcome === "no-recipe" && !line.collectionRaw
}

function byCollection(a: SquarespaceLineView, b: SquarespaceLineView): number {
  if (a.collectionDay && b.collectionDay) {
    const byDay = compareShopDays(a.collectionDay, b.collectionDay)
    if (byDay !== 0) return byDay
  } else if (a.collectionDay || b.collectionDay) {
    return a.collectionDay ? 1 : -1
  }
  return Number(a.orderNumber) - Number(b.orderNumber)
}

export function SquarespacePanel({
  syncVersion,
  onCheckNow,
  onSelectOrder,
}: {
  /** Bumped by the dashboard whenever a sync ran, so this screen re-reads. */
  syncVersion: number
  onCheckNow: () => Promise<void>
  onSelectOrder: (orderId: string) => void
}) {
  const [status, setStatus] = useState<SquarespaceStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/squarespace/status", {
        cache: "no-store",
      })
      if (!response.ok) throw new Error(String(response.status))
      setStatus((await response.json()) as SquarespaceStatus)
      setNow(Date.now())
    } catch {
      toast.error("Couldn't load the Squarespace import.")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, syncVersion])

  // Keeps "last checked 4 min ago" honest while the screen sits open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  async function checkNow() {
    setChecking(true)
    try {
      await onCheckNow()
      await load()
    } finally {
      setChecking(false)
    }
  }

  if (!status) return null

  const today = todayShopDay(new Date(now))
  const upcoming = status.lines.filter((line) => !line.collectionDay || compareShopDays(line.collectionDay, today) >= 0)
  const past = status.lines.filter((line) => line.collectionDay && compareShopDays(line.collectionDay, today) < 0)
  const run = status.lastRun

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div className="flex min-w-0 items-start gap-3">
            {!status.enabled ? (
              <CirclePause className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            ) : run && run.ok === false ? (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            ) : (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            )}
            <div className="min-w-0">
              <CardTitle>
                {!status.enabled
                  ? "Squarespace import is switched off"
                  : run && run.ok === false
                    ? "The last check of Squarespace failed"
                    : "Connected to Squarespace"}
              </CardTitle>
              <CardDescription className="mt-1">
                {!status.enabled
                  ? "Orders are not being copied in. Switching it on is a setting on the server, not a change to the shop."
                  : status.lastGoodAt
                    ? `Last checked ${ago(status.lastGoodAt, now)}. Checks itself every 10 minutes while the portal is open, and every morning.`
                    : "Not checked yet."}
              </CardDescription>
              {status.enabled && run && run.ok === false && run.error && (
                <p className="mt-2 text-sm text-destructive">{run.error}</p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Read-only: the portal never changes an order, stock or price on Squarespace, and never emails
                Squarespace customers.
              </p>
            </div>
          </div>
          {status.enabled && (
            <Button variant="outline" onClick={() => void checkNow()} disabled={checking}>
              <RefreshCw className={cn("size-4", checking && "animate-spin")} aria-hidden />
              {checking ? "Checking…" : "Check now"}
            </Button>
          )}
        </CardHeader>
      </Card>

      {status.lines.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Empty>
              <EmptyTitle>Nothing from Squarespace yet</EmptyTitle>
              <EmptyDescription>Orders appear here after the first check.</EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        GROUPS.map((group) => {
          const lines = upcoming
            .filter((line) =>
              group.key === "other"
                ? group.outcomes.includes(line.outcome) || isShopItem(line)
                : group.outcomes.includes(line.outcome) && !isShopItem(line),
            )
            .sort(byCollection)
          if (lines.length === 0 && group.key !== "imported") return null
          return (
            <LineGroup
              key={group.key}
              title={group.title}
              description={group.description}
              lines={lines}
              tone={group.key === "attention" ? "attention" : "plain"}
              onSelectOrder={onSelectOrder}
            />
          )
        })
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-4">
          <Button variant="ghost" className="self-start" onClick={() => setShowPast((value) => !value)}>
            {showPast ? "Hide" : "Show"} {past.length} already collected
          </Button>
          {showPast && (
            <LineGroup
              title="Already collected"
              description="Collection dates that have passed. Never imported, so history and reports are unchanged."
              lines={[...past].sort(byCollection).reverse()}
              tone="plain"
              onSelectOrder={onSelectOrder}
            />
          )}
        </div>
      )}
    </div>
  )
}

function LineGroup({
  title,
  description,
  lines,
  tone,
  onSelectOrder,
}: {
  title: string
  description: string
  lines: SquarespaceLineView[]
  tone: "attention" | "plain"
  onSelectOrder: (orderId: string) => void
}) {
  return (
    <Card className={cn(tone === "attention" && "border-destructive/40")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant="outline" className="font-mono tabular-nums">
            {lines.length}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">None for upcoming collections.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Squarespace order</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sr-only">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow
                  key={line.lineItemId}
                  className={cn(line.portalOrderId && "cursor-pointer")}
                  onClick={line.portalOrderId ? () => onSelectOrder(line.portalOrderId!) : undefined}
                >
                  <TableCell className="font-mono tabular-nums">#{line.orderNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{line.productName}</span>
                      {line.options && (
                        <span className="text-xs text-muted-foreground">{optionValues(line.options)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{line.quantity}</TableCell>
                  <TableCell>
                    {line.collectionDay
                      ? formatDateLong(shopMoment(line.collectionDay, "12:00"))
                      : (line.collectionRaw ?? <span className="text-muted-foreground">—</span>)}
                  </TableCell>
                  <TableCell>
                    {line.portalStatus ? (
                      <Badge variant="outline" className={STATUS_BADGE_CLASS[line.portalStatus as OrderStatus]}>
                        {line.portalStatus === "Confirmed" ? "Confirmed — to schedule" : line.portalStatus}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          line.outcome === "imported" && "border-success/40 bg-success/10 text-success",
                          ["needs-mapping", "date-unreadable", "no-date", "missing-variant"].includes(line.outcome) &&
                            "border-destructive/30 bg-destructive/10 text-destructive",
                        )}
                      >
                        {isShopItem(line)
                          ? OUTCOME_LABEL["not-a-product"]
                          : (OUTCOME_LABEL[line.outcome] ?? line.outcome)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="w-8 text-right">
                    {line.portalOrderId && (
                      <ChevronRight className="size-4 text-muted-foreground" aria-label="Open order" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
