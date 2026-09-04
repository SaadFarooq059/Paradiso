import { BarChart3, TrendingUp, TriangleAlert, Users, Wheat } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { ProductArt } from "@/components/dashboard/product-art"
import {
  getStaffColor,
  INGREDIENT_INFO,
  INGREDIENT_ORDER,
  ORDER_STATUS_ORDER,
  STATUS_BAR_COLOR,
} from "@/lib/mock-data"
import type { IngredientKey, Order, ProductVariant, StaffMember } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ReportsAnalyticsPanelProps {
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  staff: StaffMember[]
}

interface BarRowProps {
  leading?: React.ReactNode
  label: string
  sublabel?: string
  value: number
  max: number
  valueLabel: string
  colorClass: string
}

function BarRow({ leading, label, sublabel, value, max, valueLabel, colorClass }: BarRowProps) {
  const widthPct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0
  return (
    <div className="flex items-center gap-3">
      {leading}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{valueLabel}</span>
        </div>
        {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", colorClass)} style={{ width: `${widthPct}%` }} />
        </div>
      </div>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof BarChart3
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

export function ReportsAnalyticsPanel({ orders, variantsById, staff }: ReportsAnalyticsPanelProps) {
  // 1. Orders by status
  const statusCounts = ORDER_STATUS_ORDER.map((status) => ({
    status,
    count: orders.filter((order) => order.status === status).length,
  }))
  const maxStatusCount = Math.max(...statusCounts.map((s) => s.count), 1)

  // 2. Product performance — total quantity ordered per variant, across all orders
  const quantityByProduct = new Map<string, number>()
  for (const order of orders) {
    quantityByProduct.set(order.productId, (quantityByProduct.get(order.productId) ?? 0) + order.quantity)
  }
  const productPerformance = [...quantityByProduct.entries()]
    .map(([productId, quantity]) => ({ productId, quantity, variant: variantsById[productId] }))
    .sort((a, b) => b.quantity - a.quantity)
  const maxProductQuantity = Math.max(...productPerformance.map((p) => p.quantity), 1)

  // 3. Ingredient consumption — summed from frozen consumedIngredients snapshots, non-cancelled orders only
  const nonCancelledOrders = orders.filter((order) => order.status !== "Cancelled")
  const consumedTotals: Partial<Record<IngredientKey, number>> = {}
  for (const order of nonCancelledOrders) {
    for (const key of INGREDIENT_ORDER) {
      const amount = order.consumedIngredients[key]
      if (amount) consumedTotals[key] = (consumedTotals[key] ?? 0) + amount
    }
  }
  const consumptionRows = INGREDIENT_ORDER.filter((key) => consumedTotals[key]).map((key) => ({
    key,
    total: consumedTotals[key] ?? 0,
  }))
  const maxConsumption = Math.max(...consumptionRows.map((r) => r.total), 1)

  // 4. Staff workload — the same orderCount the round-robin assignment reads and increments
  const maxOrderCount = Math.max(...staff.map((member) => member.orderCount), 1)

  // 5. On Hold summary
  const onHoldOrders = orders.filter((order) => order.status === "On Hold")
  const blockCounts = new Map<IngredientKey, number>()
  for (const order of onHoldOrders) {
    for (const shortage of order.shortages) {
      blockCounts.set(shortage.ingredient, (blockCounts.get(shortage.ingredient) ?? 0) + 1)
    }
  }
  const blockRows = [...blockCounts.entries()]
    .map(([ingredient, count]) => ({ ingredient, count }))
    .sort((a, b) => b.count - a.count)
  const maxBlockCount = Math.max(...blockRows.map((r) => r.count), 1)

  return (
    <div className="@container grid grid-cols-1 gap-4 @2xl:grid-cols-2">
      <SectionCard icon={BarChart3} title="Orders by status" description="Every order placed this session.">
        {statusCounts.map(({ status, count }) => (
          <BarRow
            key={status}
            label={status}
            value={count}
            max={maxStatusCount}
            valueLabel={String(count)}
            colorClass={STATUS_BAR_COLOR[status]}
          />
        ))}
      </SectionCard>

      <SectionCard
        icon={TrendingUp}
        title="Product performance"
        description="Total quantity ordered per variant, all statuses."
      >
        {productPerformance.length === 0 ? (
          <Empty>
            <EmptyTitle>No orders yet</EmptyTitle>
            <EmptyDescription>Product rankings will show up here.</EmptyDescription>
          </Empty>
        ) : (
          productPerformance.map(({ productId, quantity, variant }) => (
            <BarRow
              key={productId}
              leading={
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <ProductArt productId={productId} className="size-6" />
                </div>
              }
              label={variant?.name ?? "Unknown"}
              value={quantity}
              max={maxProductQuantity}
              valueLabel={`${quantity} units`}
              colorClass="bg-primary"
            />
          ))
        )}
      </SectionCard>

      <SectionCard
        icon={Wheat}
        title="Ingredient consumption"
        description="Summed from each order's frozen consumedIngredients snapshot — non-cancelled orders only, never recalculated from the live recipe."
      >
        {consumptionRows.length === 0 ? (
          <Empty>
            <EmptyTitle>Nothing consumed yet</EmptyTitle>
            <EmptyDescription>Ingredient totals will show up once an order is scheduled.</EmptyDescription>
          </Empty>
        ) : (
          consumptionRows.map(({ key, total }) => (
            <BarRow
              key={key}
              label={INGREDIENT_INFO[key].label}
              value={total}
              max={maxConsumption}
              valueLabel={`${total}${INGREDIENT_INFO[key].unit}`}
              colorClass="bg-chart-4"
            />
          ))
        )}
      </SectionCard>

      <SectionCard
        icon={Users}
        title="Staff workload"
        description="Orders currently assigned per staff member (the round-robin counter)."
      >
        {staff.map((member) => (
          <BarRow
            key={member.id}
            leading={
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white",
                  getStaffColor(member.name)
                )}
              >
                {member.name.charAt(0)}
              </span>
            }
            label={member.name}
            value={member.orderCount}
            max={maxOrderCount}
            valueLabel={`${member.orderCount} order${member.orderCount === 1 ? "" : "s"}`}
            colorClass={getStaffColor(member.name)}
          />
        ))}
      </SectionCard>

      <SectionCard
        icon={TriangleAlert}
        title="On Hold summary"
        description={`${onHoldOrders.length} order${onHoldOrders.length === 1 ? "" : "s"} currently blocked on stock.`}
      >
        {blockRows.length === 0 ? (
          <Empty>
            <EmptyTitle>Nothing on hold</EmptyTitle>
            <EmptyDescription>Every order placed so far had enough stock to schedule.</EmptyDescription>
          </Empty>
        ) : (
          blockRows.map(({ ingredient, count }) => (
            <BarRow
              key={ingredient}
              label={INGREDIENT_INFO[ingredient].label}
              value={count}
              max={maxBlockCount}
              valueLabel={`blocking ${count} order${count === 1 ? "" : "s"}`}
              colorClass="bg-destructive"
            />
          ))
        )}
      </SectionCard>
    </div>
  )
}
