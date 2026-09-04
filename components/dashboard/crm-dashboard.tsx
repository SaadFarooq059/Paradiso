"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useAuth } from "@/components/auth/auth-context"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { IngredientsRestockPanel } from "@/components/dashboard/ingredients-restock-panel"
import { NewOrderForm } from "@/components/dashboard/new-order-form"
import { OrderDetailPanel } from "@/components/dashboard/order-detail-panel"
import { OrdersTable } from "@/components/dashboard/orders-table"
import { ProductionCalendarPanel } from "@/components/dashboard/production-calendar-panel"
import { ProductsRecipesPanel } from "@/components/dashboard/products-recipes-panel"
import { ReportsAnalyticsPanel } from "@/components/dashboard/reports-analytics-panel"
import { type DashboardView, SidebarNav } from "@/components/dashboard/sidebar-nav"
import { StaffManagementPanel } from "@/components/dashboard/staff-management-panel"
import { StockLevelsPanel } from "@/components/dashboard/stock-levels-panel"
import { INGREDIENT_INFO, INITIAL_STAFF, INITIAL_STOCK, PRODUCT_VARIANTS } from "@/lib/mock-data"
import { calculateIngredientsNeeded, deductStock, findShortages, restockIngredients } from "@/lib/order-engine"
import type {
  IngredientKey,
  Order,
  OrderStatus,
  ProductVariant,
  RestockEntry,
  StaffMember,
  StaffName,
} from "@/lib/types"

const ADMIN_ONLY_VIEWS: DashboardView[] = ["recipes", "restock", "staff"]

const VIEW_META: Record<DashboardView, { title: string; description: string }> = {
  "new-order": {
    title: "New Order",
    description: "Schedule a new order and check it against live ingredient stock.",
  },
  orders: {
    title: "Orders",
    description: "All orders placed this session, with staff assignment and status.",
  },
  calendar: {
    title: "Production Calendar",
    description: "Orders grouped by collection date.",
  },
  recipes: {
    title: "Products & Recipes",
    description: "Manage the product variants and their ingredient recipes.",
  },
  restock: {
    title: "Ingredients & Restock",
    description: "Add delivered stock back into the pool.",
  },
  stock: {
    title: "Stock Levels",
    description: "Remaining ingredient stock after every scheduled order.",
  },
  reports: {
    title: "Reports & Analytics",
    description: "A read-only rollup of orders, ingredients, and staff — built from data already in the app.",
  },
  staff: {
    title: "Staff Management",
    description: "Add, edit, and remove staff — admin only.",
  },
}

export function CrmDashboard() {
  const router = useRouter()
  const { currentUser, isLoading, signOut } = useAuth()
  const [view, setView] = useState<DashboardView>("new-order")
  const [orders, setOrders] = useState<Order[]>([])
  const [stock, setStock] = useState<Record<IngredientKey, number>>(INITIAL_STOCK)
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF)
  const [variants, setVariants] = useState<ProductVariant[]>(PRODUCT_VARIANTS)
  const [restockLog, setRestockLog] = useState<RestockEntry[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const variantsById = useMemo(
    () => Object.fromEntries(variants.map((variant) => [variant.id, variant])),
    [variants]
  )

  const holdCount = useMemo(() => orders.filter((order) => order.status === "On Hold").length, [orders])
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null
  const isAdmin = currentUser?.role === "admin"

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace("/sign-in")
    }
  }, [isLoading, currentUser, router])

  useEffect(() => {
    if (currentUser && !isAdmin && ADMIN_ONLY_VIEWS.includes(view)) {
      setView("new-order")
    }
  }, [currentUser, isAdmin, view])

  function pickStaff(): StaffName | null {
    if (staff.length === 0) return null
    return [...staff].sort((a, b) => a.orderCount - b.orderCount)[0].name
  }

  function assignStaff(assignedStaff: StaffName) {
    setStaff((prev) =>
      prev.map((member) => (member.name === assignedStaff ? { ...member, orderCount: member.orderCount + 1 } : member))
    )
  }

  function handleViewChange(nextView: DashboardView) {
    setSelectedOrderId(null)
    setView(nextView)
  }

  function handleNewOrder(productId: string, quantity: number, collectionDate: Date) {
    const variant = variantsById[productId]
    if (!variant) return

    const needed = calculateIngredientsNeeded(variant, quantity)
    const shortages = findShortages(needed, stock)

    if (shortages.length === 0) {
      const assignedStaff = pickStaff()
      if (!assignedStaff) {
        toast.error("Can't schedule — there's no staff to assign. Add staff in Staff Management.")
        return
      }
      setStock((prev) => deductStock(prev, needed))
      assignStaff(assignedStaff)
      setOrders((prev) => [
        {
          id: crypto.randomUUID(),
          productId,
          quantity,
          collectionDate,
          status: "Scheduled",
          assignedStaff,
          shortages: [],
          consumedIngredients: needed,
          statusHistory: [{ status: "Scheduled", at: Date.now() }],
          createdAt: Date.now(),
        },
        ...prev,
      ])
      toast.success(`Order scheduled and assigned to ${assignedStaff}`)
    } else {
      setOrders((prev) => [
        {
          id: crypto.randomUUID(),
          productId,
          quantity,
          collectionDate,
          status: "On Hold",
          assignedStaff: null,
          shortages,
          consumedIngredients: {},
          statusHistory: [{ status: "On Hold", at: Date.now() }],
          createdAt: Date.now(),
        },
        ...prev,
      ])
      toast.warning("Order put on hold — insufficient stock")
    }
  }

  function handleRecheckOrder(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    if (!order || order.status !== "On Hold") return

    const variant = variantsById[order.productId]
    if (!variant) {
      toast.error("Can't re-check — this product's recipe no longer exists.")
      return
    }

    const needed = calculateIngredientsNeeded(variant, order.quantity)
    const shortages = findShortages(needed, stock)

    if (shortages.length === 0) {
      const assignedStaff = pickStaff()
      if (!assignedStaff) {
        toast.error("Can't re-check — there's no staff to assign. Add staff in Staff Management.")
        return
      }
      setStock((prev) => deductStock(prev, needed))
      assignStaff(assignedStaff)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: "Scheduled",
                assignedStaff,
                shortages: [],
                consumedIngredients: needed,
                statusHistory: [...o.statusHistory, { status: "Scheduled", at: Date.now(), note: "Re-checked and scheduled" }],
              }
            : o
        )
      )
      toast.success(`Order re-checked and scheduled — assigned to ${assignedStaff}`)
    } else {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                shortages,
                statusHistory: [...o.statusHistory, { status: "On Hold", at: Date.now(), note: "Re-checked — still short" }],
              }
            : o
        )
      )
      toast.warning("Still insufficient stock")
    }
  }

  function handleStartProduction(orderId: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId && o.status === "Scheduled"
          ? {
              ...o,
              status: "In Production",
              statusHistory: [...o.statusHistory, { status: "In Production", at: Date.now() }],
            }
          : o
      )
    )
    toast.success("Order moved to production")
  }

  function handleMarkReady(orderId: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId && o.status === "In Production"
          ? { ...o, status: "Ready", statusHistory: [...o.statusHistory, { status: "Ready", at: Date.now() }] }
          : o
      )
    )
    toast.success("Order marked ready")
  }

  function handleCompleteOrder(orderId: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId && o.status === "Ready"
          ? { ...o, status: "Completed", statusHistory: [...o.statusHistory, { status: "Completed", at: Date.now() }] }
          : o
      )
    )
    toast.success("Order marked completed")
  }

  function handleCancelOrder(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    const cancellableStatuses: OrderStatus[] = ["Scheduled", "In Production", "Ready", "On Hold"]
    if (!order || !cancellableStatuses.includes(order.status)) return

    const hadConsumedStock = Object.keys(order.consumedIngredients).length > 0
    if (hadConsumedStock) {
      setStock((prev) => restockIngredients(prev, order.consumedIngredients))
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: "Cancelled", statusHistory: [...o.statusHistory, { status: "Cancelled", at: Date.now() }] }
          : o
      )
    )
    toast.success(hadConsumedStock ? "Order cancelled — ingredients restocked" : "Order cancelled")
  }

  function handleSaveVariant(variant: ProductVariant) {
    setVariants((prev) => {
      const exists = prev.some((v) => v.id === variant.id)
      return exists ? prev.map((v) => (v.id === variant.id ? variant : v)) : [...prev, variant]
    })
    toast.success(`Recipe saved: ${variant.name}`)
  }

  function handleDeleteVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id))
    toast.success("Recipe removed")
  }

  function handleRestock(ingredient: IngredientKey, amount: number) {
    if (amount <= 0) return
    setStock((prev) => restockIngredients(prev, { [ingredient]: amount }))
    setRestockLog((prev) => [{ id: crypto.randomUUID(), ingredient, amount, at: Date.now() }, ...prev])
    toast.success(`Restocked ${amount}${INGREDIENT_INFO[ingredient].unit} ${INGREDIENT_INFO[ingredient].label.toLowerCase()}`)
  }

  function handleSaveStaffMember(member: StaffMember) {
    setStaff((prev) => {
      const exists = prev.some((m) => m.id === member.id)
      return exists ? prev.map((m) => (m.id === member.id ? member : m)) : [...prev, member]
    })
    toast.success(`Staff saved: ${member.name}`)
  }

  function handleDeleteStaffMember(id: string) {
    setStaff((prev) => prev.filter((m) => m.id !== id))
    toast.success("Staff member removed")
  }

  if (isLoading || !currentUser) {
    return <div className="h-dvh w-full bg-background" />
  }

  const meta = selectedOrder
    ? { title: "Order Detail", description: "Full detail and lifecycle actions for this order." }
    : VIEW_META[view]

  return (
    <div className="flex h-dvh w-full flex-col bg-background md:flex-row">
      <SidebarNav
        active={view}
        onChange={handleViewChange}
        holdCount={holdCount}
        staff={staff}
        currentUser={currentUser}
        onSignOut={() => {
          signOut()
          router.replace("/sign-in")
        }}
      />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <header className="border-b border-border bg-gradient-to-b from-muted/40 to-background px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </header>
        <main className="@container flex-1 space-y-6 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          {!selectedOrder && <DashboardStats orders={orders} stock={stock} />}
          {selectedOrder ? (
            <OrderDetailPanel
              order={selectedOrder}
              variant={variantsById[selectedOrder.productId]}
              onBack={() => setSelectedOrderId(null)}
              onStartProduction={() => handleStartProduction(selectedOrder.id)}
              onMarkReady={() => handleMarkReady(selectedOrder.id)}
              onComplete={() => handleCompleteOrder(selectedOrder.id)}
              onCancel={() => handleCancelOrder(selectedOrder.id)}
              onRecheck={() => handleRecheckOrder(selectedOrder.id)}
            />
          ) : (
            <>
              {view === "new-order" && <NewOrderForm variants={variants} onSubmit={handleNewOrder} />}
              {view === "orders" && (
                <OrdersTable orders={orders} variantsById={variantsById} onSelectOrder={setSelectedOrderId} />
              )}
              {view === "calendar" && (
                <ProductionCalendarPanel
                  orders={orders}
                  variantsById={variantsById}
                  onSelectOrder={setSelectedOrderId}
                />
              )}
              {view === "recipes" && (
                <ProductsRecipesPanel
                  variants={variants}
                  onSave={handleSaveVariant}
                  onDelete={handleDeleteVariant}
                />
              )}
              {view === "restock" && (
                <IngredientsRestockPanel stock={stock} restockLog={restockLog} onRestock={handleRestock} />
              )}
              {view === "stock" && <StockLevelsPanel available={stock} />}
              {view === "reports" && (
                <ReportsAnalyticsPanel orders={orders} variantsById={variantsById} staff={staff} />
              )}
              {view === "staff" && isAdmin && (
                <StaffManagementPanel
                  staff={staff}
                  currentUserId={currentUser.id}
                  onSave={handleSaveStaffMember}
                  onDelete={handleDeleteStaffMember}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
