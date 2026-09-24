"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/auth-context"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { IngredientsRestockPanel } from "@/components/dashboard/ingredients-restock-panel"
import { NewOrderForm } from "@/components/dashboard/new-order-form"
import { OrderDetailPanel } from "@/components/dashboard/order-detail-panel"
import { OrdersTable } from "@/components/dashboard/orders-table"
import { ProductionCalendarPanel } from "@/components/dashboard/production-calendar-panel"
import { PreviewAccountsSyncPanel } from "@/components/dashboard/preview-accounts-sync-panel"
import { PreviewCustomerWebsitePanel } from "@/components/dashboard/preview-customer-website-panel"
import { PreviewStaffLoginsPanel } from "@/components/dashboard/preview-staff-logins-panel"
import { PreviewWeddingEnquiriesPanel } from "@/components/dashboard/preview-wedding-enquiries-panel"
import { ProductsRecipesPanel } from "@/components/dashboard/products-recipes-panel"
import { ReportsAnalyticsPanel } from "@/components/dashboard/reports-analytics-panel"
import { type DashboardView, isPreviewView, SidebarNav } from "@/components/dashboard/sidebar-nav"
import { StaffManagementPanel } from "@/components/dashboard/staff-management-panel"
import { StockLevelsPanel } from "@/components/dashboard/stock-levels-panel"
import { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import type { IngredientKey, ProductVariant, StaffMember } from "@/lib/types"

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
  "preview-logins": {
    title: "Staff Logins & Permissions",
    description: "Preview only — a look at how individual logins and role-based views would work.",
  },
  "preview-storefront": {
    title: "Customer Website",
    description: "Preview only — how a customer would order from the website themselves.",
  },
  "preview-weddings": {
    title: "Wedding Enquiries",
    description: "Preview only — how wedding enquiries, quotes and deposits would be handled.",
  },
  "preview-accounts": {
    title: "Accounts Sync",
    description: "Preview only — how a completed order would raise an invoice in the accounts package.",
  },
}

export function CrmDashboard() {
  const router = useRouter()
  const { currentUser, isLoading: isAuthLoading, signOut } = useAuth()
  const { data, variantsById, isLoading: isDataLoading, mutate } = useDashboardData()
  const [view, setView] = useState<DashboardView>("new-order")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  // Which day the Production Calendar is focused on. Lives here rather than inside
  // the panel so Order Detail can jump the calendar to an order's collection date,
  // and so the day stays put when you drill into an order and come back.
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date())

  const { orders, stock, capacity, staff, variants, restockLog, calendarSettings } = data
  const holdCount = useMemo(() => orders.filter((order) => order.status === "On Hold").length, [orders])
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null
  const isAdmin = currentUser?.role === "admin"

  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.replace("/sign-in")
    }
  }, [isAuthLoading, currentUser, router])

  useEffect(() => {
    if (currentUser && !isAdmin && ADMIN_ONLY_VIEWS.includes(view)) {
      setView("new-order")
    }
  }, [currentUser, isAdmin, view])

  function handleViewChange(nextView: DashboardView) {
    setSelectedOrderId(null)
    setView(nextView)
  }

  async function handleNewOrder(productId: string, quantity: number, collectionDate: Date) {
    const orderId = await mutate("/api/orders", {
      body: JSON.stringify({ productId, quantity, collectionDate: collectionDate.toISOString() }),
    })
    if (!orderId) return
    // Drop straight into the new order's detail view, with Orders as the screen
    // behind it so "Back" lands on the list instead of the form you just cleared.
    setView("orders")
    setSelectedOrderId(orderId)
  }

  function orderAction(orderId: string, action: string) {
    return mutate(`/api/orders/${orderId}`, { body: JSON.stringify({ action }) })
  }

  /** Jumps the Production Calendar to an order's collection date and shows that day. */
  function handleViewOnCalendar(collectionDate: Date) {
    setCalendarDate(collectionDate)
    setSelectedOrderId(null)
    setView("calendar")
  }

  /**
   * Restores the seeded demo state. Unlike the in-memory version this has to clear
   * persisted rows, so it goes through the server and adopts what comes back.
   */
  async function handleResetDemoData() {
    await mutate("/api/reset")
    setSelectedOrderId(null)
    setCalendarDate(new Date())
    setView("new-order")
  }

  function handleSaveVariant(variant: ProductVariant) {
    void mutate("/api/variants", { body: JSON.stringify(variant) })
  }

  function handleDeleteVariant(id: string) {
    void mutate(`/api/variants/${id}`, { method: "DELETE" })
  }

  function handleRestock(ingredient: IngredientKey, amount: number) {
    void mutate("/api/restock", { body: JSON.stringify({ ingredient, amount }) })
  }

  function handleSaveStaffMember(member: StaffMember) {
    void mutate("/api/staff", { body: JSON.stringify(member) })
  }

  function handleDeleteStaffMember(id: string) {
    void mutate(`/api/staff/${id}`, { method: "DELETE" })
  }

  if (isAuthLoading || isDataLoading || !currentUser) {
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
        onResetDemoData={handleResetDemoData}
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
          {/* Preview screens are mockups, so the real stats strip is hidden above them
              to avoid pairing live numbers with a not-built-yet screen. */}
          {!selectedOrder && !isPreviewView(view) && (
            <DashboardStats orders={orders} stock={stock} capacity={capacity} />
          )}
          {selectedOrder ? (
            <OrderDetailPanel
              order={selectedOrder}
              variant={variantsById[selectedOrder.productId]}
              onBack={() => setSelectedOrderId(null)}
              onStartProduction={() => void orderAction(selectedOrder.id, "start")}
              onMarkReady={() => void orderAction(selectedOrder.id, "ready")}
              onComplete={() => void orderAction(selectedOrder.id, "complete")}
              onCancel={() => void orderAction(selectedOrder.id, "cancel")}
              onRecheck={() => void orderAction(selectedOrder.id, "recheck")}
              onViewOnCalendar={() => handleViewOnCalendar(selectedOrder.collectionDate)}
            />
          ) : (
            <>
              {view === "new-order" && (
                <NewOrderForm
                  variants={variants}
                  orders={orders}
                  variantsById={variantsById}
                  settings={calendarSettings}
                  onSubmit={handleNewOrder}
                />
              )}
              {view === "orders" && (
                <OrdersTable orders={orders} variantsById={variantsById} onSelectOrder={setSelectedOrderId} />
              )}
              {view === "calendar" && (
                <ProductionCalendarPanel
                  orders={orders}
                  variantsById={variantsById}
                  selectedDate={calendarDate}
                  onSelectDate={setCalendarDate}
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
              {view === "stock" && <StockLevelsPanel available={stock} capacity={capacity} />}
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

              {/* Coming Soon mockups — static markup only, no app state touched. */}
              {view === "preview-logins" && <PreviewStaffLoginsPanel />}
              {view === "preview-storefront" && <PreviewCustomerWebsitePanel />}
              {view === "preview-weddings" && <PreviewWeddingEnquiriesPanel />}
              {view === "preview-accounts" && <PreviewAccountsSyncPanel />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
