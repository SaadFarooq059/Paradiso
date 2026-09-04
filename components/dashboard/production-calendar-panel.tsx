"use client"

import { useState } from "react"
import { format, isSameDay } from "date-fns"
import { ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { ProductArt } from "@/components/dashboard/product-art"
import { getStaffColor, STATUS_BADGE_CLASS } from "@/lib/mock-data"
import type { Order, ProductVariant } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ProductionCalendarPanelProps {
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  onSelectOrder: (orderId: string) => void
}

export function ProductionCalendarPanel({
  orders,
  variantsById,
  onSelectOrder,
}: ProductionCalendarPanelProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const datesWithOrders = orders.map((order) => order.collectionDate)
  const ordersForDay = orders
    .filter((order) => isSameDay(order.collectionDate, selectedDate))
    .sort((a, b) => a.createdAt - b.createdAt)

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
            selected={selectedDate}
            onSelect={(value) => value && setSelectedDate(value)}
            modifiers={{ hasOrders: datesWithOrders }}
            modifiersClassNames={{ hasOrders: "font-semibold underline decoration-primary/60 decoration-2 underline-offset-4" }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{format(selectedDate, "PPP")}</CardTitle>
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
    </div>
  )
}
