"use client"

import { PackagePlus, TriangleAlert } from "lucide-react"

import { INGREDIENT_ICONS } from "@/components/dashboard/ingredient-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExportMenu } from "@/components/ui/export-menu"
import { stockLevelsDocument } from "@/lib/export/documents"
import { INGREDIENT_INFO, INGREDIENT_ORDER } from "@/lib/mock-data"
import type { IngredientKey } from "@/lib/types"
import { cn } from "@/lib/utils"

interface StockLevelsPanelProps {
  available: Record<IngredientKey, number>
  /**
   * Total stock ever brought into the pool, from the database — seed plus every
   * restock. Committed is capacity minus available. This used to be derived from
   * the INITIAL_STOCK constant, so restocking an ingredient above its seed amount
   * made committed collapse to 0 and total capacity read lower than what was
   * actually on hand.
   */
  capacity: Record<IngredientKey, number>
  /** Present only for roles that may restock; opens Restock on that ingredient. */
  onRestock?: (ingredient: IngredientKey) => void
}

export const LOW_STOCK_THRESHOLD = 0.2

export function StockLevelsPanel({ available, capacity, onRestock }: StockLevelsPanelProps) {
  const rows = INGREDIENT_ORDER.map((key) => {
    const total = capacity[key] ?? 0
    const remaining = Math.max(available[key] ?? 0, 0)
    const committed = Math.max(total - remaining, 0)
    const ratio = total > 0 ? remaining / total : 1
    return { key, total, remaining, committed, ratio, isLow: ratio <= LOW_STOCK_THRESHOLD }
  })
  const lowCount = rows.filter((row) => row.isLow).length

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>Stock Levels</CardTitle>
        <CardDescription>
          {lowCount === 0
            ? "Everything is above the low-stock line."
            : `${lowCount} of ${rows.length} ingredients are running low.`}{" "}
          Available is free for new orders; committed is held by scheduled ones.
        </CardDescription>
        <CardAction>
          <ExportMenu build={() => stockLevelsDocument(available, capacity)} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary/25" aria-hidden="true" />
            Committed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-destructive" aria-hidden="true" />
            Low (≤ {Math.round(LOW_STOCK_THRESHOLD * 100)}% available)
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {rows.map(({ key, total, remaining, committed, ratio, isLow }) => {
            const info = INGREDIENT_INFO[key]
            const Icon = INGREDIENT_ICONS[key]
            const availablePct = total > 0 ? Math.min(remaining / total, 1) * 100 : 0
            const committedPct = total > 0 ? Math.min(committed / total, 1) * 100 : 0

            return (
              <li
                key={key}
                className={cn(
                  "grid gap-3 rounded-lg border border-border bg-card p-4",
                  "@2xl:grid-cols-[12rem_1fr_auto] @2xl:items-center @2xl:gap-6",
                  isLow && "border-destructive/40 bg-destructive/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md bg-muted",
                      isLow && "bg-destructive/10"
                    )}
                  >
                    <Icon className={cn("size-4.5 text-muted-foreground", isLow && "text-destructive")} aria-hidden="true" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{info.label}</span>
                    {isLow ? (
                      <Badge variant="destructive" className="mt-0.5 w-fit gap-1">
                        <TriangleAlert data-icon="inline-start" />
                        Low stock
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{Math.round(ratio * 100)}% available</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div
                    className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                    role="meter"
                    aria-label={`${info.label} available`}
                    aria-valuenow={Math.round(ratio * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={cn("h-full transition-[width] duration-500", isLow ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${availablePct}%` }}
                    />
                    <div
                      className={cn("h-full transition-[width] duration-500", isLow ? "bg-destructive/25" : "bg-primary/25")}
                      style={{ width: `${committedPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between gap-2 font-mono text-xs tabular-nums text-muted-foreground">
                    <span>
                      <span className="text-base font-semibold text-foreground">
                        {remaining.toLocaleString()}
                        {info.unit}
                      </span>{" "}
                      available
                    </span>
                    <span>
                      {committed.toLocaleString()}
                      {info.unit} committed · {total.toLocaleString()}
                      {info.unit} total
                    </span>
                  </div>
                </div>

                {onRestock && (
                  <Button
                    type="button"
                    size="sm"
                    variant={isLow ? "default" : "outline"}
                    onClick={() => onRestock(key)}
                    className="w-fit"
                  >
                    <PackagePlus data-icon="inline-start" />
                    Restock
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
