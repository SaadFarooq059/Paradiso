"use client"

import { formatDistanceToNow } from "date-fns"
import {
  ArrowLeft,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  CookingPot,
  MessageSquareCheck,
  MessageSquareWarning,
  PackageCheck,
  RotateCcw,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth/auth-context"
import { can } from "@/lib/auth/roles"
import { OrderEmailsCard } from "@/components/dashboard/order-emails-card"
import { OrderPaymentCard } from "@/components/dashboard/order-payment-card"
import { ProductArt } from "@/components/dashboard/product-art"
import { getStaffColor, INGREDIENT_INFO, INGREDIENT_ORDER, STATUS_BADGE_CLASS } from "@/lib/mock-data"
import { formatShortageLabel } from "@/lib/order-engine"
import { formatDateLong, formatDateTime } from "@/lib/format-date"
import type { Order, OrderStatus, ProductVariant } from "@/lib/types"
import { cn } from "@/lib/utils"

interface OrderDetailPanelProps {
  order: Order
  variant: ProductVariant | undefined
  onBack: () => void
  onAction: (action: string, payload?: Record<string, unknown>) => void
  onViewOnCalendar: () => void
}

/** Statuses from which an order can still be stopped. A collected one cannot. */
const CANCELLABLE_STATUSES: OrderStatus[] = [
  "Confirmed",
  "Scheduled",
  "In Production",
  "Ready for collection",
  "Details require clarification",
  "On Hold",
]

/** Statuses from which the customer can still be queried. */
const QUERYABLE_STATUSES: OrderStatus[] = ["Confirmed", "Scheduled", "In Production", "On Hold"]

export function OrderDetailPanel({
  order,
  variant,
  onBack,
  onAction,
  onViewOnCalendar,
}: OrderDetailPanelProps) {
  const { currentUser } = useAuth()
  const role = currentUser?.role
  // Read from the same matrix the API enforces. The routes refuse these anyway;
  // this stops a role being shown controls it will only be told off for using.
  const seesMoney = role ? can(role, "payments:record") : false
  const seesCustomers = role ? can(role, "customers:view") : false
  const allowed = (capability: Parameters<typeof can>[1]) => (role ? can(role, capability) : false)

  const consumedEntries = INGREDIENT_ORDER.filter((key) => order.consumedIngredients[key])
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)
  const canQuery = QUERYABLE_STATUSES.includes(order.status)

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back
      </Button>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @4xl:items-start">
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
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-muted-foreground">Collection date</span>
              <span className="text-sm font-medium text-foreground">
                {formatDateLong(order.collectionDate)}
              </span>
              <button
                type="button"
                onClick={onViewOnCalendar}
                className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                <CalendarRange className="size-3" />
                View on calendar
              </button>
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
            <h3 className="text-sm font-medium text-foreground">Customer</h3>
            {!seesCustomers ? (
              <p className="text-sm text-muted-foreground">
                Customer details aren&apos;t shown for your role.
              </p>
            ) : order.customer ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium text-foreground">{order.customer.name}</span>
                <a
                  href={`mailto:${order.customer.email}`}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  {order.customer.email}
                </a>
                {order.customer.phone && (
                  <span className="text-muted-foreground">{order.customer.phone}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No customer on this order — it was taken before customers were recorded.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">This order&apos;s share of the batch</h3>
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
                  A share of the batch this order is made in, not a separate bake — the kitchen
                  bakes whole batches and orders for the same day share them. Frozen when the order
                  was scheduled, so later recipe edits and other orders joining the same batch
                  don&apos;t change it.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This order isn&apos;t booked into production, so it has no share of a batch yet.
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

        </CardContent>
      </Card>

      {/* Its own card so it can sit beside the detail on a wide screen instead
          of pushing it further down a narrow column. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifecycle</CardTitle>
          <CardDescription>Every status this order has been through.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {order.statusHistory.map((event, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{event.status}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.at)}
                    {/* "Unknown" rather than a name or "system": changes made
                        before actors were tracked have no author to claim. */}
                    {" · "}
                    {event.actorName ?? "author unknown"}
                    {event.note ? ` — ${event.note}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      </div>

      {seesMoney && <OrderPaymentCard order={order} canCancel={canCancel} onAction={onAction} />}

      {seesCustomers && <OrderEmailsCard emails={order.emails} />}

      {(canCancel || order.status === "Details require clarification") && (
        <div className="flex flex-wrap gap-2">
          {order.status === "Confirmed" && allowed("orders:schedule") && (
            <Button onClick={() => onAction("schedule")}>
              <CalendarCheck data-icon="inline-start" />
              Schedule
            </Button>
          )}
          {order.status === "On Hold" && allowed("orders:schedule") && (
            <Button onClick={() => onAction("recheck")}>
              <RotateCcw data-icon="inline-start" />
              Re-check stock
            </Button>
          )}
          {order.status === "Scheduled" && allowed("orders:advance:production") && (
            <Button onClick={() => onAction("start")}>
              <CookingPot data-icon="inline-start" />
              Start production
            </Button>
          )}
          {order.status === "In Production" && allowed("orders:advance:production") && (
            <Button onClick={() => onAction("ready")}>
              <PackageCheck data-icon="inline-start" />
              Mark ready
            </Button>
          )}
          {order.status === "Ready for collection" && allowed("orders:advance:handover") && (
            <Button onClick={() => onAction("complete")}>
              <CheckCircle2 data-icon="inline-start" />
              Mark collected
            </Button>
          )}
          {order.status === "Details require clarification" && allowed("orders:query") && (
            <Button onClick={() => onAction("resolve")}>
              <MessageSquareCheck data-icon="inline-start" />
              Details clarified
            </Button>
          )}
          {canQuery && allowed("orders:query") && (
            <Button variant="outline" onClick={() => onAction("query")}>
              <MessageSquareWarning data-icon="inline-start" />
              Query details
            </Button>
          )}
          {allowed("orders:cancel") && (
          <Button variant="destructive" onClick={() => onAction("cancel")}>
            <XCircle data-icon="inline-start" />
            Cancel order
          </Button>
          )}
        </div>
      )}
    </div>
  )
}
