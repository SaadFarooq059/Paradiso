"use client"

import { isSameDay } from "date-fns"
import { ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { ProductArt } from "@/components/dashboard/product-art"
import { getStaffColor, INGREDIENT_INFO, INGREDIENT_ORDER, STATUS_BADGE_CLASS } from "@/lib/mock-data"
import { formatDateLong, UK_LOCALE } from "@/lib/format-date"
import { dayKey } from "@/lib/production-schedule"
import type { ProductionDayDemand } from "@/components/dashboard/use-dashboard-data"
import type { Order, ProductVariant } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ProductionCalendarPanelProps {
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  /** Forward projection: what each production day needs, oldest first. */
  productionDemand: ProductionDayDemand[]
  /** What is physically in the building, for the running balance. */
  onHand: Record<string, number>
  /** Focused day. Controlled by the dashboard so Order Detail can jump here. */
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onSelectOrder: (orderId: string) => void
}

export function ProductionCalendarPanel({
  orders,
  variantsById,
  productionDemand,
  onHand,
  selectedDate,
  onSelectDate,
  onSelectOrder,
}: ProductionCalendarPanelProps) {
  const datesWithOrders = orders.map((order) => order.collectionDate)
  const ordersForDay = orders
    .filter((order) => isSameDay(order.collectionDate, selectedDate))
    .sort((a, b) => a.createdAt - b.createdAt)

  // What has to be made on the selected day, and what stock is left once every
  // production day up to and including it has been served. This is the whole
  // point of the projection: the answer for a future day, not for today.
  const selectedKey = dayKey(selectedDate)
  const demandForDay = productionDemand.find((day) => day.day === selectedKey)
  const runningBalance: Record<string, number> = { ...onHand }
  for (const day of productionDemand) {
    if (day.day > selectedKey) break
    for (const ingredient of INGREDIENT_ORDER) {
      const amount = day.amounts[ingredient]
      if (amount) runningBalance[ingredient] = (runningBalance[ingredient] ?? 0) - amount
    }
  }

  return (
    <div className="@container grid grid-cols-1 gap-4 @2xl:grid-cols-[auto_1fr]">
      <Card className="w-fit">
        <CardHeader>
          <CardTitle>Production Calendar</CardTitle>
          <CardDescription>Days with at least one order due are highlighted.</CardDescription>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            locale={UK_LOCALE}
            selected={selectedDate}
            onSelect={(value) => value && onSelectDate(value)}
            modifiers={{ hasOrders: datesWithOrders }}
            modifiersClassNames={{ hasOrders: "font-semibold underline decoration-primary/60 decoration-2 underline-offset-4" }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{formatDateLong(selectedDate)}</CardTitle>
          <CardDescription>
            {ordersForDay.length} order{ordersForDay.length === 1 ? "" : "s"} due for collection this day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ordersForDay.length === 0 ? (
            <Empty>
              <EmptyTitle>Nothing due this day</EmptyTitle>
              <EmptyDescription>Pick another highlighted date to see its orders.</EmptyDescription>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {ordersForDay.map((order) => {
                const variant = variantsById[order.productId]
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => onSelectOrder(order.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <ProductArt productId={order.productId} className="size-7" />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {variant?.name ?? "Unknown"} × {order.quantity}
                        </span>
                        {order.assignedStaff && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-semibold text-white",
                                getStaffColor(order.assignedStaff)
                              )}
                            >
                              {order.assignedStaff.charAt(0)}
                            </span>
                            {order.assignedStaff}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className={STATUS_BADGE_CLASS[order.status]}>
                        {order.status}
                      </Badge>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="@2xl:col-span-2">
        <CardHeader>
          <CardTitle>In production this day</CardTitle>
          <CardDescription>
            Ingredients needed on {formatDateLong(selectedDate)} — orders whose lead time puts them
            into production that day, not orders collected then — and what is left afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!demandForDay ? (
            <Empty>
              <EmptyTitle>Nothing in production this day</EmptyTitle>
              <EmptyDescription>
                No scheduled order needs to be started on this date.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {demandForDay.orderCount} order{demandForDay.orderCount === 1 ? "" : "s"} to make.
              </p>
              <div className="grid gap-2 @sm:grid-cols-2 @xl:grid-cols-3">
                {INGREDIENT_ORDER.filter((key) => demandForDay.amounts[key]).map((key) => {
                  const info = INGREDIENT_INFO[key]
                  const left = runningBalance[key] ?? 0
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-baseline justify-between gap-2 rounded-lg border border-border p-3",
                        left < 0 && "border-destructive/40 bg-destructive/5"
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">{info.label}</span>
                      <span className="flex flex-col items-end font-mono tabular-nums">
                        <span className="text-sm text-foreground">
                          {demandForDay.amounts[key]}
                          {info.unit} needed
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            left < 0 ? "text-destructive" : "text-muted-foreground"
                          )}
                        >
                          {left}
                          {info.unit} left after
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
