"use client"

import { TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { INGREDIENT_INFO, INGREDIENT_ORDER, INITIAL_STOCK } from "@/lib/mock-data"
import type { IngredientKey } from "@/lib/types"
import { cn } from "@/lib/utils"

interface StockLevelsPanelProps {
  available: Record<IngredientKey, number>
}

const LOW_STOCK_THRESHOLD = 0.2

export function StockLevelsPanel({ available }: StockLevelsPanelProps) {
  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>Stock Levels</CardTitle>
        <CardDescription>
          Available quantity vs. what&apos;s already committed to scheduled orders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-3">
          {INGREDIENT_ORDER.map((key) => {
            const info = INGREDIENT_INFO[key]
            const initial = INITIAL_STOCK[key]
            const remaining = Math.max(available[key] ?? 0, 0)
            const committed = Math.max(initial - remaining, 0)
            const remainingRatio = initial > 0 ? remaining / initial : 1
            const isLow = remainingRatio <= LOW_STOCK_THRESHOLD

            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
                  isLow && "border-destructive/40 bg-destructive/5"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{info.label}</span>
                  {isLow && (
                    <Badge variant="destructive" className="gap-1">
                      <TriangleAlert data-icon="inline-start" />
                      Low stock
                    </Badge>
                  )}
                </div>

                <div className="flex items-end justify-between font-mono tabular-nums">
                  <div className="flex flex-col">
                    <span className="text-2xl font-semibold text-foreground">
                      {remaining}
                      {info.unit}
                    </span>
                    <span className="text-xs text-muted-foreground">available</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm text-muted-foreground">
                      {committed}
                      {info.unit}
                    </span>
                    <span className="text-xs text-muted-foreground">committed</span>
                  </div>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isLow ? "bg-destructive" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(Math.max(remainingRatio, 0), 1) * 100}%` }}
                  />
                </div>

                <span className="text-xs text-muted-foreground">
                  {initial}
                  {info.unit} total capacity
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
