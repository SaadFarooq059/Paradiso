import {
  BarChart3,
  HeartHandshake,
  Receipt,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
  Wheat,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import {
  getStaffColor,
  INGREDIENT_INFO,
  INGREDIENT_ORDER,
} from "@/lib/mock-data"
import { AnalyticsBarCard } from "@/components/ui/analytics-bar-card"
import { OrdersByStatusChart } from "@/components/dashboard/orders-by-status-chart.lazy"
import { ExportMenu } from "@/components/ui/export-menu"
import { analyticsDocument } from "@/lib/export/documents"
import { Meter } from "@/components/ui/meter"
import { formatMoney } from "@/lib/payments"
import { DEAD_STAGES } from "@/lib/weddings"
import {
  allLedgerEvents,
  averageOrderValue,
  customerSplit,
  defaultWindowStart,
  totalsFromLedger,
  weddingMoney,
  weddingsByMonth,
} from "@/lib/reporting"
import { ProportionRingCard } from "@/components/ui/proportion-ring-card"
import type { ProductionDayDemand } from "@/components/dashboard/use-dashboard-data"
import type { IngredientKey, Order, ProductVariant, StaffMember, Wedding } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ReportsAnalyticsPanelProps {
  orders: Order[]
  weddings: Wedding[]
  variantsById: Record<string, ProductVariant>
  staff: StaffMember[]
  /** Batched demand per production day — the real ingredient draw. */
  productionDemand: ProductionDayDemand[]
  /** What is physically in the building — the denominator for the ingredient meters. */
  onHand: Record<string, number>
  /** Jump to the Production Calendar, where the per-day breakdown lives. */
  onViewProduction: () => void
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
  weddings,
  variantsById,
  staff,
  productionDemand,
  onHand,
  onViewProduction,
}: ReportsAnalyticsPanelProps) {
  // Money, all of it from the PaymentEvent ledger. Orders and weddings write to
  // the same table, so these reconcile by construction rather than by two
  // separate tallies happening to agree.
  const ledger = allLedgerEvents(orders, weddings)
  const money = totalsFromLedger(ledger)
  const orderMoney = totalsFromLedger(orders.flatMap((o) => o.payment.events))
  const wedding = weddingMoney(weddings, DEAD_STAGES)
  const byMonth = weddingsByMonth(weddings, DEAD_STAGES)
  const aov = averageOrderValue(orders)
  const customers = customerSplit(orders, weddings, defaultWindowStart())

  // 1. Product performance — total quantity ordered per variant, across all orders
  const quantityByProduct = new Map<string, number>()
  for (const order of orders) {
    quantityByProduct.set(order.productId, (quantityByProduct.get(order.productId) ?? 0) + order.quantity)
  }
  const productPerformance = [...quantityByProduct.entries()]
    .map(([productId, quantity]) => ({ productId, quantity, variant: variantsById[productId] }))
    .sort((a, b) => b.quantity - a.quantity)
  const totalUnitsOrdered = productPerformance.reduce((sum, p) => sum + p.quantity, 0)

  // 2. Ingredient consumption — the kitchen's real draw, taken from each
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

  // 3. Staff workload — the same orderCount the round-robin assignment reads and increments
  const maxOrderCount = Math.max(...staff.map((member) => member.orderCount), 1)

  // 4. On Hold summary
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
    <div className="@container flex flex-col gap-4">
      {/* The page heading lives in the dashboard shell, so this row carries the
          export control alone rather than repeating the title. */}
      <div className="flex justify-end">
        <ExportMenu
          build={() =>
            analyticsDocument({ orders, variantsById, staff, productionDemand, onHand })
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
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

        {/* Spans the row: an area chart needs width to be readable, and this is
            the card that shows the whole order book rather than one slice. */}
        <OrdersByStatusChart orders={orders} className="@2xl:col-span-2" />

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
        <SectionCard
          icon={Wallet}
          title="Money taken"
          description="Every payment and refund, orders and weddings together — one ledger, so these reconcile."
        >
          <dl className="grid grid-cols-2 gap-3 @sm:grid-cols-4">
            <Figure label="Taken" value={formatMoney(money.taken)} />
            <Figure label="Refunded" value={formatMoney(money.refunded)} tone="negative" />
            <Figure label="Net" value={formatMoney(money.net)} emphasis />
            <Figure
              label="Of which weddings"
              value={formatMoney(wedding.taken - wedding.refunded)}
            />
          </dl>
          <StackedBarish
            segments={[
              { label: "Counter orders", value: Math.max(orderMoney.net, 0), className: "bg-chart-2" },
              { label: "Weddings", value: Math.max(wedding.taken - wedding.refunded, 0), className: "bg-chart-1" },
            ]}
            format={formatMoney}
          />
          <p className="text-xs text-muted-foreground">
            Refunds are netted off rather than hidden, so this is what the business kept.
          </p>
        </SectionCard>

        <SectionCard
          icon={HeartHandshake}
          title="Weddings"
          description="The bespoke order book: what is quoted, what is held, and what is still owed."
        >
          <dl className="grid grid-cols-2 gap-3 @sm:grid-cols-4">
            <Figure label="Quoted" value={formatMoney(wedding.quoted)} />
            <Figure label="Deposits held" value={formatMoney(wedding.depositsHeld)} />
            <Figure label="Outstanding" value={formatMoney(wedding.outstanding)} emphasis />
            <Figure label="Live" value={String(byMonth.reduce((n, m) => n + m.count, 0))} />
          </dl>
          {byMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground">No weddings booked yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">By month</span>
              {byMonth.map((month) => (
                <Meter
                  key={month.month}
                  label={month.label}
                  valueLabel={`${month.count} · ${formatMoney(month.value)}`}
                  ratio={month.value / Math.max(...byMonth.map((m) => m.value), 1)}
                  fillClass="bg-chart-1"
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={Receipt}
          title="Average order value"
          description="Across orders that were actually fulfilled and had a price."
        >
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {formatMoney(aov.average)}
            </span>
            <span className="text-sm text-muted-foreground">
              over {aov.counted} order{aov.counted === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Cancelled orders and anything priced at zero are left out — including them would drag
            the figure toward nothing and answer a different question.
          </p>
        </SectionCard>

        <SectionCard
          icon={UserPlus}
          title="New and returning customers"
          description="By when they first bought, over the last 90 days."
        >
          <StackedBarish
            segments={[
              { label: "New", value: customers.newCustomers, className: "bg-chart-2" },
              { label: "Returning", value: customers.returning, className: "bg-chart-4" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            &quot;Returning&quot; means they had already bought before this window opened — not that
            they bought twice inside it. {customers.repeatCustomers} customer
            {customers.repeatCustomers === 1 ? " has" : "s have"} ordered more than once.
          </p>
        </SectionCard>
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string
  value: string
  emphasis?: boolean
  tone?: "negative"
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-sm tabular-nums",
          tone === "negative" ? "text-destructive" : "text-foreground",
          emphasis && "font-semibold"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Part-to-whole as one bar plus a legend.
 *
 * The legend is never optional: two segments of one measure need naming, and
 * colour alone cannot carry identity for anyone who cannot distinguish them.
 */
function StackedBarish({
  segments,
  format = (n: number) => String(n),
}: {
  segments: { label: string; value: number; className: string }[]
  /** How to render the figure. Money must not appear as raw pence. */
  format?: (value: number) => string
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {total === 0 ? (
          <div className="h-full w-full rounded-full bg-muted" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((segment) => (
              <div
                key={segment.label}
                className={cn("h-full rounded-full", segment.className)}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 shrink-0 rounded-full",
                segment.value > 0 ? segment.className : "bg-muted-foreground/25"
              )}
            />
            <span className="text-xs text-muted-foreground">{segment.label}</span>
            <span className="font-mono text-xs tabular-nums text-foreground">
              {format(segment.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
