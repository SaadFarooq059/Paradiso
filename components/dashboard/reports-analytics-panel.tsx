import { BarChart3, TrendingUp, TriangleAlert, Users, Wheat } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import {
  getStaffColor,
  INGREDIENT_INFO,
  INGREDIENT_ORDER,
  ORDER_STATUS_ORDER,
} from "@/lib/mock-data"
import { AnalyticsBarCard } from "@/components/ui/analytics-bar-card"
import { Meter } from "@/components/ui/meter"
import { ProportionRingCard } from "@/components/ui/proportion-ring-card"
import { StackedBar } from "@/components/ui/stacked-bar"
import type { ProductionDayDemand } from "@/components/dashboard/use-dashboard-data"
import type { IngredientKey, Order, OrderStatus, ProductVariant, StaffMember } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ReportsAnalyticsPanelProps {
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  staff: StaffMember[]
  /** Batched demand per production day — the real ingredient draw. */
  productionDemand: ProductionDayDemand[]
  /** What is physically in the building — the denominator for the ingredient meters. */
  onHand: Record<string, number>
  /** Jump to the Production Calendar, where the per-day breakdown lives. */
  onViewProduction: () => void
}

/**
 * Segment fills for the status bar.
 *
 * STATUS_BAR_COLOR maps six statuses onto three hues — Scheduled and Completed
 * are both the success hue — which is fine for separate rows and useless for
 * adjacent stacked segments. Each family keeps its meaning and splits by
 * lightness: soft for the in-progress state, solid for the one it ends in.
 */
const STATUS_SEGMENT: Record<OrderStatus, string> = {
  Scheduled: "bg-success/40",
  Completed: "bg-success",
  "In Production": "bg-primary/40",
  Ready: "bg-primary",
  "On Hold": "bg-destructive/40",
  Cancelled: "bg-destructive",
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

export function ReportsAnalyticsPanel({
  orders,
  variantsById,
  staff,
  productionDemand,
  onHand,
  onViewProduction,
}: ReportsAnalyticsPanelProps) {
  // 1. Orders by status
  const statusCounts = ORDER_STATUS_ORDER.map((status) => ({
    status,
    count: orders.filter((order) => order.status === status).length,
  }))

  // 2. Product performance — total quantity ordered per variant, across all orders
  const quantityByProduct = new Map<string, number>()
  for (const order of orders) {
    quantityByProduct.set(order.productId, (quantityByProduct.get(order.productId) ?? 0) + order.quantity)
  }
  const productPerformance = [...quantityByProduct.entries()]
    .map(([productId, quantity]) => ({ productId, quantity, variant: variantsById[productId] }))
    .sort((a, b) => b.quantity - a.quantity)
  const totalUnitsOrdered = productPerformance.reduce((sum, p) => sum + p.quantity, 0)

  // 3. Ingredient consumption — the kitchen's real draw, taken from each
  // production day's batch totals rather than by summing orders' snapshots.
  // Those snapshots hold each order's *share* of a batch, and a partly-empty
  // batch's surplus belongs to no order, so adding them up would under-report
  // what actually left the store cupboard.
  const consumedTotals: Partial<Record<IngredientKey, number>> = {}
  for (const day of productionDemand) {
    for (const key of INGREDIENT_ORDER) {
      const amount = day.amounts[key]
      if (amount) consumedTotals[key] = (consumedTotals[key] ?? 0) + amount
    }
  }
  // The batching payoff, as one figure: the ovens produce whole batches, so the
  // units coming out split into the ones somebody ordered and the spare capacity
  // nobody has claimed yet. Both come straight from the per-day batch breakdown.
  const orderedUnits = productionDemand.reduce(
    (total, day) => total + day.variants.reduce((sum, v) => sum + v.units, 0),
    0
  )
  const surplusUnits = productionDemand.reduce(
    (total, day) => total + day.variants.reduce((sum, v) => sum + v.surplusUnits, 0),
    0
  )
  const consumptionRows = INGREDIENT_ORDER.filter((key) => consumedTotals[key]).map((key) => ({
    key,
    total: consumedTotals[key] ?? 0,
  }))

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

  return (
    <div className="@container grid grid-cols-1 gap-4 @2xl:grid-cols-2">
      <ProportionRingCard
        className="@2xl:col-span-2 @4xl:col-span-1"
        caption="In production"
        total={orderedUnits + surplusUnits}
        totalSuffix="units coming out of the ovens"
        segments={[
          { label: "Ordered", value: orderedUnits, color: "var(--color-chart-2)" },
          { label: "Spare capacity", value: surplusUnits, color: "var(--color-chart-4)" },
        ]}
        emptyMessage="Nothing is in production, so there are no batches to break down yet."
        action={{ label: "See it day by day", onClick: onViewProduction }}
      />

      <SectionCard
        icon={BarChart3}
        title="Orders by status"
        description={`${orders.length} order${orders.length === 1 ? "" : "s"} placed this session, by where each one has got to.`}
      >
        <StackedBar
          segments={ORDER_STATUS_ORDER.map((status) => ({
            label: status,
            value: statusCounts.find((entry) => entry.status === status)?.count ?? 0,
            className: STATUS_SEGMENT[status],
          }))}
          emptyMessage="No orders yet — the pipeline will fill in here."
        />
      </SectionCard>

      <AnalyticsBarCard
        title="Product performance"
        totalAmount={`${totalUnitsOrdered} ${totalUnitsOrdered === 1 ? "unit" : "units"}`}
        caption="Ordered per variant, all statuses."
        icon={<TrendingUp className="size-4" />}
        data={productPerformance.map(({ quantity, variant }) => ({
          label: variant?.name ?? "Unknown",
          value: quantity,
        }))}
        emptyMessage="No orders yet — product rankings will show up here."
      />

      <SectionCard
        icon={Wheat}
        title="Ingredient consumption"
        description={`What the kitchen actually draws, counted in whole batches across every scheduled production day${surplusUnits > 0 ? ` — includes ${surplusUnits} surplus unit${surplusUnits === 1 ? "" : "s"} produced but not ordered` : ""}.`}
      >
        {consumptionRows.length === 0 ? (
          <Empty>
            <EmptyTitle>Nothing consumed yet</EmptyTitle>
            <EmptyDescription>Ingredient totals will show up once an order is scheduled.</EmptyDescription>
          </Empty>
        ) : (
          consumptionRows.map(({ key, total }) => {
            const info = INGREDIENT_INFO[key]
            const stock = onHand[key] ?? 0
            return (
              <Meter
                key={key}
                label={info.label}
                ratio={stock > 0 ? total / stock : 0}
                valueLabel={`${total}${info.unit} of ${stock}${info.unit}`}
                sublabel={
                  stock > 0 && total > stock
                    ? `Over-committed by ${Math.round((total - stock) * 100) / 100}${info.unit}`
                    : `${stock > 0 ? Math.round((total / stock) * 100) : 0}% of what's in the building`
                }
              />
            )
          })
        )}
      </SectionCard>

      <SectionCard
        icon={Users}
        title="Staff workload"
        description="Orders currently assigned per staff member (the round-robin counter)."
      >
        {staff.map((member) => (
          <Meter
            key={member.id}
            leading={
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                  getStaffColor(member.name)
                )}
              >
                {member.name.charAt(0)}
              </span>
            }
            label={member.name}
            // Against the busiest person, so the bars answer "who is carrying
            // more" rather than each filling its own row.
            ratio={maxOrderCount > 0 ? member.orderCount / maxOrderCount : 0}
            valueLabel={`${member.orderCount} order${member.orderCount === 1 ? "" : "s"}`}
            fillClass={getStaffColor(member.name)}
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
            <div
              key={ingredient}
              className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5"
            >
              {/* Status always ships with an icon and a label, never colour alone. */}
              <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-foreground">
                {INGREDIENT_INFO[ingredient].label}
              </span>
              <span className="font-mono text-xs tabular-nums text-destructive">
                blocking {count} order{count === 1 ? "" : "s"}
              </span>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  )
}
