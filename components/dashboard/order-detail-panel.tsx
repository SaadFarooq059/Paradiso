"use client"

import { format, formatDistanceToNow } from "date-fns"
import { ArrowLeft, CheckCircle2, CookingPot, PackageCheck, RotateCcw, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProductArt } from "@/components/dashboard/product-art"
import { getStaffColor, INGREDIENT_INFO, INGREDIENT_ORDER, STATUS_BADGE_CLASS } from "@/lib/mock-data"
import { formatShortageLabel } from "@/lib/order-engine"
import type { Order, ProductVariant } from "@/lib/types"
import { cn } from "@/lib/utils"

interface OrderDetailPanelProps {
  order: Order
  variant: ProductVariant | undefined
  onBack: () => void
  onStartProduction: () => void
  onMarkReady: () => void
  onComplete: () => void
  onCancel: () => void
  onRecheck: () => void
}

export function OrderDetailPanel({
  order,
  variant,
  onBack,
  onStartProduction,
  onMarkReady,
  onComplete,
  onCancel,
  onRecheck,
}: OrderDetailPanelProps) {
  const consumedEntries = INGREDIENT_ORDER.filter((key) => order.consumedIngredients[key])
  const canCancel =
    order.status === "Scheduled" ||
    order.status === "In Production" ||
    order.status === "Ready" ||
    order.status === "On Hold"

  return (
    <div className="max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-muted to-muted/30">
                <ProductArt productId={order.productId} className="size-12" />
              </div>
              <div>
                <CardTitle className="text-lg">{variant?.name ?? "Unknown product"}</CardTitle>
                <CardDescription>
                  {variant?.servings ?? "Recipe no longer exists"} · Qty {order.quantity}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-sm", STATUS_BADGE_CLASS[order.status])}>
              {order.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 @sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Collection date</span>
              <span className="text-sm font-medium text-foreground">
                {format(order.collectionDate, "PPP")}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Assigned staff</span>
              {order.assignedStaff ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-semibold text-white",
                      getStaffColor(order.assignedStaff)
                    )}
                  >
                    {order.assignedStaff.charAt(0)}
                  </span>
                  {order.assignedStaff}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Created</span>
              <span className="text-sm font-medium text-foreground">
                {formatDistanceToNow(order.createdAt, { addSuffix: true })}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Order ID</span>
              <span className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Ingredients consumed</h3>
            {consumedEntries.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {consumedEntries.map((key) => (
                    <Badge key={key} variant="secondary" className="font-normal">
                      {order.consumedIngredients[key]}
                      {INGREDIENT_INFO[key].unit} {INGREDIENT_INFO[key].label.toLowerCase()}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Frozen at the moment this order was scheduled — later recipe edits don&apos;t change
                  this record.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing was deducted from stock for this order.
              </p>
            )}
          </div>

          {order.shortages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Shortage</h3>
              <div className="flex flex-wrap gap-1.5">
                {order.shortages.map((shortage) => (
                  <Badge key={shortage.ingredient} variant="destructive" className="font-normal">
                    {formatShortageLabel(
                      shortage,
                      INGREDIENT_INFO[shortage.ingredient].label,
                      INGREDIENT_INFO[shortage.ingredient].unit
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Lifecycle</h3>
            <ol className="space-y-3">
              {order.statusHistory.map((event, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{event.status}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(event.at, "PPP p")}
                      {event.note ? ` — ${event.note}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      {canCancel && (
        <div className="flex flex-wrap gap-2">
          {order.status === "On Hold" && (
            <Button onClick={onRecheck}>
              <RotateCcw data-icon="inline-start" />
              Re-check stock
            </Button>
          )}
          {order.status === "Scheduled" && (
            <Button onClick={onStartProduction}>
              <CookingPot data-icon="inline-start" />
              Start production
            </Button>
          )}
          {order.status === "In Production" && (
            <Button onClick={onMarkReady}>
              <PackageCheck data-icon="inline-start" />
              Mark ready
            </Button>
          )}
          {order.status === "Ready" && (
            <Button onClick={onComplete}>
              <CheckCircle2 data-icon="inline-start" />
              Mark completed
            </Button>
          )}
          <Button variant="destructive" onClick={onCancel}>
            <XCircle data-icon="inline-start" />
            Cancel order
          </Button>
        </div>
      )}
    </div>
  )
}
