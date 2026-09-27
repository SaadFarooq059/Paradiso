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
import { ProductsRecipesPanel } from "@/components/dashboard/products-recipes-panel"
import { ReportsAnalyticsPanel } from "@/components/dashboard/reports-analytics-panel"
import { type DashboardView, isPreviewView, SidebarNav } from "@/components/dashboard/sidebar-nav"
import { CalendarRulesPanel } from "@/components/dashboard/calendar-rules-panel"
import { StaffManagementPanel } from "@/components/dashboard/staff-management-panel"
import { StockLevelsPanel } from "@/components/dashboard/stock-levels-panel"
import { WeddingsPanel } from "@/components/dashboard/weddings-panel"
import { WeddingsSummaryCard } from "@/components/dashboard/weddings-summary-card"
import { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import type { CalendarSettings, IngredientKey, ProductVariant, StaffMember } from "@/lib/types"
import { can, canUseView, landingViewFor } from "@/lib/auth/roles"
import { shopDayOf } from "@/lib/shop-time"


const VIEW_META: Record<DashboardView, { title: string; description: string }> = {
  "new-order": {
    title: "New Order",
    description: "Take an order and confirm it. Scheduling it books the kitchen.",
  },
  weddings: {
    title: "Weddings",
    description: "Enquiries, quotes and bespoke orders, from first contact to delivered.",
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
  "calendar-rules": {
    title: "Calendar Rules",
    description: "Which days and times orders can be collected — admin only.",
  },
  "preview-logins": {
    title: "Staff Logins & Permissions",
    description: "Preview only — a look at how individual logins and role-based views would work.",
  },
  "preview-storefront": {
    title: "Customer Website",
    description: "Preview only — how a customer would order from the website themselves.",
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
  const [view, setView] = useState<DashboardView | null>(null)
  const [selectedWeddingId, setSelectedWeddingId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  // Which day the Production Calendar is focused on. Lives here rather than inside
  // the panel so Order Detail can jump the calendar to an order's collection date,
  // and so the day stays put when you drill into an order and come back.
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date())
  // Set when a day is picked on the calendar, so New Order opens with that
  // collection date already chosen. Cleared once the form has taken it, or the
  // date would reappear on every later visit to the screen.
  const [prefilledDate, setPrefilledDate] = useState<Date | null>(null)

  const { orders, stock, capacity, staff, variants, restockLog, calendarSettings, productionDemand,
    weddings,
    weddingPackages,
    weddingExtras } =
    data
  const holdCount = useMemo(() => orders.filter((order) => order.status === "On Hold").length, [orders])
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null

  /**
   * Land on a screen this role can actually use, and leave one it cannot.
   *
   * Kitchen opened on New Order — hidden in its own sidebar, and refused by the
   * API if submitted. Not a hole, but a role should not start on a dead end.
   * Also covers a role changing under an open session.
   */
  useEffect(() => {
    if (!currentUser) return
    if (view === null || !canUseView(currentUser.role, view)) {
      setView(landingViewFor(currentUser.role) as DashboardView)
    }
  }, [currentUser, view])

  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.replace("/sign-in")
    }
  }, [isAuthLoading, currentUser, router])

  function handleViewChange(nextView: DashboardView) {
    setSelectedOrderId(null)
    setPrefilledDate(null)
    setView(nextView)
  }

  /**
   * Jump to New Order with a collection date already picked. The form still
   * validates it against the selected product's lead time and the calendar
   * rules, and clears it if that product can't be made for that day — so this
   * is a shortcut, never a way past the rules.
   */
  function handleScheduleForDate(date: Date) {
    setPrefilledDate(date)
    setSelectedOrderId(null)
    setView("new-order")
  }

  async function handleNewOrder(
    productId: string,
    quantity: number,
    collectionDate: Date,
    customer: { name: string; email: string; phone: string }
  ) {
    const orderId = await mutate("/api/orders", {
      body: JSON.stringify({
        productId,
        quantity,
        // The day the user clicked, as a plain calendar day. Sending an
        // instant instead would carry this browser's timezone to the server,
        // where a London midnight reads as the previous day in UTC.
        collectionDay: shopDayOf(collectionDate),
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
      }),
    })
    if (!orderId) return
    // Drop straight into the new order's detail view, with Orders as the screen
    // behind it so "Back" lands on the list instead of the form you just cleared.
    setView("orders")
    setSelectedOrderId(orderId)
  }

  /**
   * One door to every order mutation. The lifecycle now has eight statuses and
   * three money actions; a callback prop per action would be a dozen of them
   * threaded through Order Detail for no gain, when the server already
   * distinguishes them by name.
   */
  function orderAction(orderId: string, action: string, payload?: Record<string, unknown>) {
    return mutate(`/api/orders/${orderId}`, { body: JSON.stringify({ action, ...payload }) })
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
    setPrefilledDate(null)
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

  function handleSaveCalendarSettings(settings: CalendarSettings) {
    void mutate("/api/settings", { body: JSON.stringify(settings) })
  }

  function handleSaveStaffMember(member: StaffMember, password: string) {
    // The password goes straight to the server and is hashed there. It is never
    // put in app state, so a re-render cannot leave it lying around.
    void mutate("/api/staff", { body: JSON.stringify({ ...member, password }) })
  }

  function handleDeleteStaffMember(id: string) {
    void mutate(`/api/staff/${id}`, { method: "DELETE" })
  }

  if (isAuthLoading || isDataLoading || !currentUser || view === null) {
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
        onSignOut={async () => {
          // Await it: the server has to clear the session cookie before we land
          // on the sign-in page, or the redirect there would bounce straight back.
          await signOut()
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
              onAction={(action, payload) => void orderAction(selectedOrder.id, action, payload)}
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
                  initialDate={prefilledDate}
                  onInitialDateApplied={() => setPrefilledDate(null)}
                  onSubmit={handleNewOrder}
                />
              )}
              {view === "weddings" && (
                <WeddingsPanel
                  weddings={weddings}
                  packages={weddingPackages}
                  extras={weddingExtras}
                  variants={variants}
                  settings={calendarSettings}
                  canManage={can(currentUser.role, "weddings:manage")}
                  selectedId={selectedWeddingId}
                  onSelectedIdChange={setSelectedWeddingId}
                  onCreate={(input) => void mutate("/api/weddings", { body: JSON.stringify(input) })}
                  onAction={(weddingId, action, payload) =>
                    void mutate(`/api/weddings/${weddingId}`, {
                      body: JSON.stringify({ action, ...payload }),
                    })
                  }
                />
              )}
              {view === "orders" && (
                <div className="flex flex-col gap-4">
                  <OrdersTable
                    orders={orders}
                    variantsById={variantsById}
                    onSelectOrder={setSelectedOrderId}
                  />
                  {/* Weddings live here too, so nobody has to know a separate
                      screen exists to find one. */}
                  {can(currentUser.role, "weddings:view") && (
                    <WeddingsSummaryCard
                      weddings={weddings}
                      onSelectWedding={(id) => {
                        setSelectedWeddingId(id)
                        setView("weddings")
                      }}
                      onViewAll={() => setView("weddings")}
                    />
                  )}
                </div>
              )}
              {view === "calendar" && (
                <ProductionCalendarPanel
                  orders={orders}
                  variantsById={variantsById}
                  staff={staff}
                  productionDemand={productionDemand}
                  weddings={weddings}
                  onHand={capacity}
                  onScheduleForDate={handleScheduleForDate}
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
                <ReportsAnalyticsPanel
                  orders={orders}
                  variantsById={variantsById}
                  staff={staff}
                  productionDemand={productionDemand}
                  weddings={weddings}
                  onHand={capacity}
                  onViewProduction={() => handleViewChange("calendar")}
                />
              )}
              {view === "calendar-rules" && can(currentUser.role, "settings:manage") && (
                <CalendarRulesPanel settings={calendarSettings} onSave={handleSaveCalendarSettings} />
              )}
              {view === "staff" && can(currentUser.role, "staff:manage") && (
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
              {view === "preview-accounts" && <PreviewAccountsSyncPanel />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
