import { CalendarCheck, ClipboardList, PauseCircle, TriangleAlert } from "lucide-react"

import { INITIAL_STOCK } from "@/lib/mock-data"
import type { IngredientKey, Order } from "@/lib/types"
import { cn } from "@/lib/utils"

const LOW_STOCK_THRESHOLD = 0.2

interface DashboardStatsProps {
  orders: Order[]
  stock: Record<IngredientKey, number>
}

export function DashboardStats({ orders, stock }: DashboardStatsProps) {
  const scheduled = orders.filter((order) => order.status === "Scheduled").length
  const onHold = orders.filter((order) => order.status === "On Hold").length
  const lowStock = Object.entries(stock).filter(([key, remaining]) => {
    const initial = INITIAL_STOCK[key as IngredientKey]
    return initial > 0 && Math.max(remaining, 0) / initial <= LOW_STOCK_THRESHOLD
  }).length

  const stats = [
    { label: "Total orders", value: orders.length, icon: ClipboardList, tone: "default" as const },
    { label: "Scheduled", value: scheduled, icon: CalendarCheck, tone: "success" as const },
    { label: "On hold", value: onHold, icon: PauseCircle, tone: onHold > 0 ? ("warn" as const) : ("default" as const) },
    { label: "Low stock", value: lowStock, icon: TriangleAlert, tone: lowStock > 0 ? ("danger" as const) : ("default" as const) },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 ring-1 ring-foreground/5"
          >
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                stat.tone === "success" && "bg-success/10 text-success",
                stat.tone === "warn" && "bg-primary/10 text-primary",
                stat.tone === "danger" && "bg-destructive/10 text-destructive",
                stat.tone === "default" && "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xl leading-tight font-semibold tabular-nums text-foreground">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
