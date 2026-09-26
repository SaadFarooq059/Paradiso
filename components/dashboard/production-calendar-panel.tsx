"use client"

import { useMemo, useState } from "react"
import { addDays, addMonths, isSameDay, startOfDay, startOfMonth, startOfWeek } from "date-fns"
import {
  CalendarDays,
  CalendarRange,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { ProductArt } from "@/components/dashboard/product-art"
import {
  getStaffColor,
  INGREDIENT_INFO,
  INGREDIENT_ORDER,
  ORDER_STATUS_ORDER,
  STATUS_BADGE_CLASS,
} from "@/lib/mock-data"
import { formatDateLong, formatDateShort } from "@/lib/format-date"
import { dayKey } from "@/lib/production-schedule"
import type { ProductionDayDemand } from "@/components/dashboard/use-dashboard-data"
import type { Order, OrderStatus, ProductVariant, StaffMember } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The Production Calendar.
 *
 * Deliberately NOT a generic event calendar. An order is not an event with a
 * free-text colour and an arbitrary start and end: it has a status, a product, a
 * collection *day* at the shop's opening time, and a production day derived from
 * its lead time. So colour comes from status, filters are status/product/staff,
 * and there is no hourly grid — every collection is at the same time of day and
 * production is planned per day, so hour rows would be empty 23 hours out of 24.
 *
 * It is read-only by design. Moving an order to another day has to satisfy lead
 * time, blocked weekdays, production-day capacity and re-batching, so dragging
 * would either bypass those rules or need to re-run them; rescheduling stays
 * where that logic already lives.
 */

type CalendarView = "month" | "week" | "day" | "list"

interface ProductionCalendarPanelProps {
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  staff: StaffMember[]
  /** Forward projection: what each production day needs, oldest first. */
  productionDemand: ProductionDayDemand[]
  /** What is physically in the building, for the running balance. */
  onHand: Record<string, number>
  /** Focused day. Controlled by the dashboard so Order Detail can jump here. */
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onSelectOrder: (orderId: string) => void
  /** Start a new order with this collection date already chosen. */
  onScheduleForDate: (date: Date) => void
}

const VIEWS: { id: CalendarView; label: string; icon: typeof CalendarDays }[] = [
  { id: "month", label: "Month", icon: CalendarDays },
  { id: "week", label: "Week", icon: CalendarRange },
  { id: "day", label: "Day", icon: ChefHat },
  { id: "list", label: "List", icon: List },
]

export function ProductionCalendarPanel({
  orders,
  variantsById,
  staff,
  productionDemand,
  onHand,
  selectedDate,
  onSelectDate,
  onSelectOrder,
  onScheduleForDate,
}: ProductionCalendarPanelProps) {
  const [view, setView] = useState<CalendarView>("month")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<OrderStatus[]>([])
  const [productFilter, setProductFilter] = useState<string[]>([])
  const [staffFilter, setStaffFilter] = useState<string[]>([])

  const visibleOrders = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return orders.filter((order) => {
      if (statusFilter.length > 0 && !statusFilter.includes(order.status)) return false
      if (productFilter.length > 0 && !productFilter.includes(order.productId)) return false
      if (staffFilter.length > 0 && !staffFilter.includes(order.assignedStaff ?? "")) return false
      if (!needle) return true
      const variant = variantsById[order.productId]
      return [variant?.name, order.assignedStaff, order.status]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    })
  }, [orders, query, statusFilter, productFilter, staffFilter, variantsById])

  const hasFilters =
    statusFilter.length + productFilter.length + staffFilter.length > 0 || query.trim().length > 0

  function clearFilters() {
    setStatusFilter([])
    setProductFilter([])
    setStaffFilter([])
    setQuery("")
  }

  function shift(direction: -1 | 1) {
    if (view === "month") onSelectDate(addMonths(selectedDate, direction))
    else if (view === "week") onSelectDate(addDays(selectedDate, direction * 7))
    else onSelectDate(addDays(selectedDate, direction))
  }

  const heading =
    view === "month"
      ? selectedDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : view === "week"
        ? `Week of ${formatDateLong(startOfWeek(selectedDate, { weekStartsOn: 1 }))}`
        : view === "day"
          ? formatDateLong(selectedDate)
          : "All orders"

  return (
    <div className="flex flex-col gap-4">
      <CalendarToolbar
        heading={heading}
        view={view}
        onViewChange={setView}
        onShift={shift}
        onToday={() => onSelectDate(new Date())}
        showNavigation={view !== "list"}
      />

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        statusFilter={statusFilter}
        onStatusToggle={(status) =>
          setStatusFilter((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
          )
        }
        productFilter={productFilter}
        onProductToggle={(id) =>
          setProductFilter((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
        }
        staffFilter={staffFilter}
        onStaffToggle={(name) =>
          setStaffFilter((prev) =>
            prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
          )
        }
        variants={Object.values(variantsById)}
        staff={staff}
        hasFilters={hasFilters}
        onClear={clearFilters}
        matchCount={visibleOrders.length}
        totalCount={orders.length}
      />

      {view === "month" && (
        <MonthView
          selectedDate={selectedDate}
          orders={visibleOrders}
          variantsById={variantsById}
          productionDemand={productionDemand}
          onSelectDate={onSelectDate}
          onSelectOrder={onSelectOrder}
          onScheduleForDate={onScheduleForDate}
        />
      )}

      {view === "week" && (
        <WeekView
          selectedDate={selectedDate}
          orders={visibleOrders}
          variantsById={variantsById}
          productionDemand={productionDemand}
          onSelectDate={onSelectDate}
          onSelectOrder={onSelectOrder}
          onScheduleForDate={onScheduleForDate}
        />
      )}

      {view === "day" && (
        <DayView
          selectedDate={selectedDate}
          orders={orders}
          visibleOrders={visibleOrders}
          variantsById={variantsById}
          productionDemand={productionDemand}
          onHand={onHand}
          onSelectOrder={onSelectOrder}
          onScheduleForDate={onScheduleForDate}
        />
      )}

      {view === "list" && (
        <ListView orders={visibleOrders} variantsById={variantsById} onSelectOrder={onSelectOrder} />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- toolbar */

function CalendarToolbar({
  heading,
  view,
  onViewChange,
  onShift,
  onToday,
  showNavigation,
}: {
  heading: string
  view: CalendarView
  onViewChange: (view: CalendarView) => void
  onShift: (direction: -1 | 1) => void
  onToday: () => void
  showNavigation: boolean
}) {
  return (
    <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">{heading}</h2>
        {showNavigation && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" aria-label="Previous" onClick={() => onShift(-1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next" onClick={() => onShift(1)}>
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Calendar view"
        className="flex w-fit items-center gap-0.5 rounded-lg border border-border bg-card p-1"
      >
        {VIEWS.map((option) => {
          const Icon = option.icon
          const isActive = view === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onViewChange(option.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden @sm:inline">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- filter bar */

function FilterBar({
  query,
  onQueryChange,
  statusFilter,
  onStatusToggle,
  productFilter,
  onProductToggle,
  staffFilter,
  onStaffToggle,
  variants,
  staff,
  hasFilters,
  onClear,
  matchCount,
  totalCount,
}: {
  query: string
  onQueryChange: (value: string) => void
  statusFilter: OrderStatus[]
  onStatusToggle: (status: OrderStatus) => void
  productFilter: string[]
  onProductToggle: (id: string) => void
  staffFilter: string[]
  onStaffToggle: (name: string) => void
  variants: ProductVariant[]
  staff: StaffMember[]
  hasFilters: boolean
  onClear: () => void
  matchCount: number
  totalCount: number
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search orders"
            placeholder="Search product, staff or status…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-8"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQueryChange("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={() => setIsOpen((prev) => !prev)} aria-expanded={isOpen}>
          <SlidersHorizontal data-icon="inline-start" />
          Filters
        </Button>

        {hasFilters && (
          <>
            <span className="text-xs text-muted-foreground">
              {matchCount} of {totalCount} shown
            </span>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X data-icon="inline-start" />
              Clear
            </Button>
          </>
        )}
      </div>

      {isOpen && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <FilterGroup label="Status">
              {ORDER_STATUS_ORDER.map((status) => (
                <FilterChip
                  key={status}
                  active={statusFilter.includes(status)}
                  onClick={() => onStatusToggle(status)}
                  className={statusFilter.includes(status) ? STATUS_BADGE_CLASS[status] : undefined}
                >
                  {status}
                </FilterChip>
              ))}
            </FilterGroup>

            <FilterGroup label="Product">
              {variants.map((variant) => (
                <FilterChip
                  key={variant.id}
                  active={productFilter.includes(variant.id)}
                  onClick={() => onProductToggle(variant.id)}
                >
                  {variant.name}
                </FilterChip>
              ))}
            </FilterGroup>

            <FilterGroup label="Staff">
              {staff.map((member) => (
                <FilterChip
                  key={member.id}
                  active={staffFilter.includes(member.name)}
                  onClick={() => onStaffToggle(member.name)}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-semibold text-white",
                      getStaffColor(member.name)
                    )}
                  >
                    {member.name.charAt(0)}
                  </span>
                  {member.name}
                </FilterChip>
              ))}
            </FilterGroup>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------- order chip */

/** One order in a grid cell. Colour is status — the domain's only real colour axis. */
function OrderChip({
  order,
  variant,
  onSelect,
}: {
  order: Order
  variant: ProductVariant | undefined
  onSelect: () => void
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          e.stopPropagation()
          onSelect()
        }
      }}
      title={`${variant?.name ?? "Unknown"} × ${order.quantity} — ${order.status}${
        order.assignedStaff ? ` — ${order.assignedStaff}` : ""
      }`}
      className={cn(
        "block w-full cursor-pointer truncate rounded border px-1.5 py-0.5 text-left text-[0.7rem] font-medium transition-transform hover:scale-[1.02]",
        STATUS_BADGE_CLASS[order.status]
      )}
    >
      {variant?.name ?? "Unknown"} × {order.quantity}
    </span>
  )
}

function useDayIndex(orders: Order[]) {
  return useMemo(() => {
    const index = new Map<string, Order[]>()
    for (const order of orders) {
      const key = dayKey(order.collectionDate)
      const bucket = index.get(key)
      if (bucket) bucket.push(order)
      else index.set(key, [order])
    }
    for (const bucket of index.values()) bucket.sort((a, b) => a.createdAt - b.createdAt)
    return index
  }, [orders])
}

/* ------------------------------------------------------------- month view */

function MonthView({
  selectedDate,
  orders,
  variantsById,
  productionDemand,
  onSelectDate,
  onSelectOrder,
  onScheduleForDate,
}: {
  selectedDate: Date
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  productionDemand: ProductionDayDemand[]
  onSelectDate: (date: Date) => void
  onSelectOrder: (id: string) => void
  onScheduleForDate: (date: Date) => void
}) {
  const byDay = useDayIndex(orders)
  const productionDays = useMemo(
    () => new Set(productionDemand.map((day) => day.day)),
    [productionDemand]
  )

  // Six fixed rows from the Monday on or before the 1st, so the grid does not
  // change height between months.
  const gridStart = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 })
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const today = startOfDay(new Date())

  return (
    <Card className="overflow-hidden py-0">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
            <span className="hidden @sm:inline">{day}</span>
            <span className="@sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const key = dayKey(day)
          const dayOrders = byDay.get(key) ?? []
          const inMonth = day.getMonth() === selectedDate.getMonth()
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, selectedDate)

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-label={formatDateLong(day)}
              onClick={() => onSelectDate(day)}
              onDoubleClick={() => onScheduleForDate(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectDate(day)
              }}
              className={cn(
                "flex min-h-24 cursor-pointer flex-col gap-1 border-r border-b border-border p-1.5 transition-colors [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/30",
                isSelected ? "bg-primary/5 ring-1 ring-primary/40 ring-inset" : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    isToday && "bg-primary font-semibold text-primary-foreground",
                    !isToday && !inMonth && "text-muted-foreground"
                  )}
                >
                  {day.getDate()}
                </span>
                {/* A dot means the kitchen is making something that day — often a
                    day with no collections at all. */}
                {productionDays.has(key) && (
                  <span title="In production this day" className="size-1.5 shrink-0 rounded-full bg-chart-4" />
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                {dayOrders.slice(0, 3).map((order) => (
                  <OrderChip
                    key={order.id}
                    order={order}
                    variant={variantsById[order.productId]}
                    onSelect={() => onSelectOrder(order.id)}
                  />
                ))}
                {dayOrders.length > 3 && (
                  <span className="px-1 text-[0.65rem] text-muted-foreground">
                    +{dayOrders.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------- week view */

function WeekView({
  selectedDate,
  orders,
  variantsById,
  productionDemand,
  onSelectDate,
  onSelectOrder,
  onScheduleForDate,
}: {
  selectedDate: Date
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  productionDemand: ProductionDayDemand[]
  onSelectDate: (date: Date) => void
  onSelectOrder: (id: string) => void
  onScheduleForDate: (date: Date) => void
}) {
  const byDay = useDayIndex(orders)
  const demandByDay = useMemo(
    () => new Map(productionDemand.map((day) => [day.day, day])),
    [productionDemand]
  )
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = startOfDay(new Date())

  // Day columns, not hour rows: every collection is at the shop's opening time.
  return (
    <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-7">
      {days.map((day) => {
        const key = dayKey(day)
        const dayOrders = byDay.get(key) ?? []
        const demand = demandByDay.get(key)

        return (
          <Card
            key={key}
            className={cn("gap-0 py-0", isSameDay(day, selectedDate) && "ring-1 ring-primary/40")}
          >
            <button
              type="button"
              onClick={() => onSelectDate(day)}
              className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-left"
            >
              <span className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isSameDay(day, today) ? "text-primary" : "text-foreground"
                  )}
                >
                  {day.getDate()}
                </span>
              </span>
              {demand && (
                <Badge variant="outline" className="shrink-0 text-[0.65rem]">
                  {demand.variants.reduce((sum, v) => sum + v.batches, 0)} batch
                </Badge>
              )}
            </button>

            <div className="flex flex-1 flex-col gap-1 p-2">
              {dayOrders.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onScheduleForDate(day)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md border border-dashed border-border py-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Plus className="size-3" />
                  Add
                </button>
              ) : (
                dayOrders.map((order) => (
                  <OrderChip
                    key={order.id}
                    order={order}
                    variant={variantsById[order.productId]}
                    onSelect={() => onSelectOrder(order.id)}
                  />
                ))
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------------- day view */

/**
 * The kitchen's run sheet for one day, rather than an hourly grid.
 *
 * This is where the production-vs-collection distinction is visible: it routinely
 * shows work on a date with no collections, because a Suprema collected on the
 * 30th is made on the 26th.
 *
 * The production half reads UNFILTERED orders on purpose — the batches still have
 * to be made whatever the screen is filtered to — and the collections half says
 * how many rows a filter is hiding rather than silently shortening the list.
 */
function DayView({
  selectedDate,
  orders,
  visibleOrders,
  variantsById,
  productionDemand,
  onHand,
  onSelectOrder,
  onScheduleForDate,
}: {
  selectedDate: Date
  orders: Order[]
  visibleOrders: Order[]
  variantsById: Record<string, ProductVariant>
  productionDemand: ProductionDayDemand[]
  onHand: Record<string, number>
  onSelectOrder: (id: string) => void
  onScheduleForDate: (date: Date) => void
}) {
  const key = dayKey(selectedDate)
  const demand = productionDemand.find((day) => day.day === key)

  const collections = orders
    .filter((order) => isSameDay(order.collectionDate, selectedDate))
    .sort((a, b) => a.createdAt - b.createdAt)
  const visibleIds = new Set(visibleOrders.map((order) => order.id))
  const hiddenByFilter = collections.filter((order) => !visibleIds.has(order.id)).length

  // Stock left once every production day up to and including this one is served.
  const runningBalance: Record<string, number> = { ...onHand }
  for (const day of productionDemand) {
    if (day.day > key) break
    for (const ingredient of INGREDIENT_ORDER) {
      const amount = day.amounts[ingredient]
      if (amount) runningBalance[ingredient] = (runningBalance[ingredient] ?? 0) - amount
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
          <CardDescription>
            {collections.length} order{collections.length === 1 ? "" : "s"} due for collection on{" "}
            {formatDateLong(selectedDate)}.
            {hiddenByFilter > 0 && ` ${hiddenByFilter} hidden by filters.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {collections.length === 0 ? (
            <Empty>
              <EmptyTitle>Nothing due this day</EmptyTitle>
              <EmptyDescription>
                <Button variant="outline" size="sm" onClick={() => onScheduleForDate(selectedDate)}>
                  <Plus data-icon="inline-start" />
                  Schedule one for this day
                </Button>
              </EmptyDescription>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {collections.map((order) => (
                <li key={order.id}>
                  <OrderRow
                    order={order}
                    variant={variantsById[order.productId]}
                    dimmed={!visibleIds.has(order.id)}
                    onSelect={() => onSelectOrder(order.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>In production this day</CardTitle>
          <CardDescription>
            Orders whose lead time puts them into production on {formatDateLong(selectedDate)} — not
            orders collected then — and what is left afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!demand ? (
            <Empty>
              <EmptyTitle>Nothing in production this day</EmptyTitle>
              <EmptyDescription>No scheduled order needs to be started on this date.</EmptyDescription>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1.5">
                {demand.variants.map((entry) => (
                  <li
                    key={entry.variantId}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {variantsById[entry.variantId]?.name ?? entry.variantId}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {entry.batches} batch{entry.batches === 1 ? "" : "es"} · {entry.units} ordered
                      {entry.surplusUnits > 0 ? ` · ${entry.surplusUnits} spare` : ""}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="grid gap-2 @sm:grid-cols-2">
                {INGREDIENT_ORDER.filter((ingredient) => demand.amounts[ingredient]).map((ingredient) => {
                  const info = INGREDIENT_INFO[ingredient]
                  const left = runningBalance[ingredient] ?? 0
                  return (
                    <div
                      key={ingredient}
                      className={cn(
                        "flex items-baseline justify-between gap-2 rounded-lg border border-border p-3",
                        left < 0 && "border-destructive/40 bg-destructive/5"
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">{info.label}</span>
                      <span className="flex flex-col items-end font-mono tabular-nums">
                        <span className="text-sm text-foreground">
                          {demand.amounts[ingredient]}
                          {info.unit} needed
                        </span>
                        <span
                          className={cn("text-xs", left < 0 ? "text-destructive" : "text-muted-foreground")}
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

/* -------------------------------------------------------------- list view */

function OrderRow({
  order,
  variant,
  dimmed = false,
  onSelect,
  showDate = false,
}: {
  order: Order
  variant: ProductVariant | undefined
  dimmed?: boolean
  onSelect: () => void
  showDate?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50",
        dimmed && "opacity-45"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <ProductArt productId={order.productId} className="size-7" />
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-sm font-medium text-foreground">
          {variant?.name ?? "Unknown"} × {order.quantity}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {showDate && <span>{formatDateShort(order.collectionDate)}</span>}
          {order.assignedStaff && (
            <span className="flex items-center gap-1.5">
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
        </span>
      </span>
      <Badge variant="outline" className={cn("shrink-0", STATUS_BADGE_CLASS[order.status])}>
        {order.status}
      </Badge>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

function ListView({
  orders,
  variantsById,
  onSelectOrder,
}: {
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  onSelectOrder: (id: string) => void
}) {
  const grouped = useMemo(() => {
    const index = new Map<string, { date: Date; orders: Order[] }>()
    for (const order of [...orders].sort(
      (a, b) => a.collectionDate.getTime() - b.collectionDate.getTime() || a.createdAt - b.createdAt
    )) {
      const key = dayKey(order.collectionDate)
      const bucket = index.get(key)
      if (bucket) bucket.orders.push(order)
      else index.set(key, { date: order.collectionDate, orders: [order] })
    }
    return [...index.values()]
  }, [orders])

  if (grouped.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <Empty>
            <EmptyTitle>No orders match</EmptyTitle>
            <EmptyDescription>Clear the filters, or schedule a new order.</EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-5">
        {grouped.map((group) => (
          <div key={dayKey(group.date)} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {formatDateLong(group.date)}
            </h3>
            <ul className="flex flex-col gap-2">
              {group.orders.map((order) => (
                <li key={order.id}>
                  <OrderRow
                    order={order}
                    variant={variantsById[order.productId]}
                    onSelect={() => onSelectOrder(order.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
