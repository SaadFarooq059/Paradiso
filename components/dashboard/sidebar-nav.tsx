"use client"

import { useState } from "react"
import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  LogOut,
  NotebookPen,
  PackagePlus,
  PackageSearch,
  PlusCircle,
  UserCog,
} from "lucide-react"

import { Sidebar, SidebarBody, useSidebar } from "@/components/ui/sidebar"
import { getStaffColor } from "@/lib/mock-data"
import type { StaffMember } from "@/lib/types"
import { cn } from "@/lib/utils"

export type DashboardView =
  | "new-order"
  | "orders"
  | "calendar"
  | "recipes"
  | "restock"
  | "stock"
  | "reports"
  | "staff"

interface NavItem {
  id: DashboardView
  label: string
  icon: typeof PlusCircle
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: "new-order", label: "New Order", icon: PlusCircle },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "calendar", label: "Calendar", icon: CalendarRange },
  { id: "recipes", label: "Recipes", icon: NotebookPen, adminOnly: true },
  { id: "restock", label: "Restock", icon: PackagePlus, adminOnly: true },
  { id: "stock", label: "Stock Levels", icon: PackageSearch },
  { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
  { id: "staff", label: "Staff Management", icon: UserCog, adminOnly: true },
]

interface SidebarNavProps {
  active: DashboardView
  onChange: (view: DashboardView) => void
  holdCount: number
  staff: StaffMember[]
  currentUser: StaffMember
  onSignOut: () => void
}

export function SidebarNav({ active, onChange, holdCount, staff, currentUser, onSignOut }: SidebarNavProps) {
  const [open, setOpen] = useState(false)
  const isAdmin = currentUser.role === "admin"
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-6 border-r border-sidebar-border bg-sidebar">
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <SidebarLogo />
          <SidebarUserBlock currentUser={currentUser} onSignOut={onSignOut} />
          <nav className="mt-6 flex flex-col gap-0.5">
            {visibleItems.map((item) => (
              <SidebarNavButton
                key={item.id}
                item={item}
                isActive={active === item.id}
                badge={item.id === "orders" ? holdCount : undefined}
                onClick={() => onChange(item.id)}
              />
            ))}
          </nav>
        </div>
        <SidebarFooter staff={staff} />
      </SidebarBody>
    </Sidebar>
  )
}

function SidebarLogo() {
  const { open } = useSidebar()
  return (
    <div className="flex h-9 items-center gap-2">
      {open ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo.webp" alt="Paradiso" className="h-9 w-auto object-contain" />
      ) : (
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary font-serif text-sm font-bold text-primary-foreground">
          P
        </div>
      )}
    </div>
  )
}

function SidebarUserBlock({ currentUser, onSignOut }: { currentUser: StaffMember; onSignOut: () => void }) {
  const { open, animate } = useSidebar()
  return (
    <div className="mt-4 flex items-center gap-2 border-b border-sidebar-border pb-4">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
          getStaffColor(currentUser.name)
        )}
      >
        {currentUser.name.charAt(0)}
      </span>
      <div
        className={cn(
          "flex flex-1 items-center justify-between gap-2 overflow-hidden whitespace-nowrap transition-all duration-200",
          animate ? (open ? "max-w-xs opacity-100" : "max-w-0 opacity-0") : "max-w-xs opacity-100"
        )}
      >
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-medium text-sidebar-foreground">{currentUser.name}</span>
          <span className="text-[0.65rem] text-muted-foreground">
            {currentUser.role === "admin" ? "Admin" : "Staff"}
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function SidebarNavButton({
  item,
  isActive,
  badge,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  badge?: number
  onClick: () => void
}) {
  const { open, animate, setOpen } = useSidebar()
  const Icon = item.icon
  const hasBadge = !!badge && badge > 0

  return (
    <button
      type="button"
      onClick={() => {
        onClick()
        // On mobile the sidebar is a full-screen drawer opened via a hamburger toggle
        // (the same `open` state desktop uses for hover-expand) — close it after
        // navigating so the selected view is actually visible.
        if (window.matchMedia("(max-width: 767px)").matches) setOpen(false)
      }}
      aria-label={item.label}
      className={cn(
        "group/sidebar relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/70"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span
        className={cn(
          "!m-0 overflow-hidden !p-0 whitespace-pre transition-all duration-200 group-hover/sidebar:translate-x-1",
          animate ? (open ? "max-w-xs opacity-100" : "max-w-0 opacity-0") : "max-w-xs opacity-100"
        )}
      >
        {item.label}
      </span>
      {hasBadge && open && (
        <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-[0.65rem] font-semibold text-destructive">
          {badge}
        </span>
      )}
      {hasBadge && !open && (
        <span className="absolute top-1.5 right-1.5 size-2 shrink-0 rounded-full bg-destructive" />
      )}
    </button>
  )
}

function SidebarFooter({ staff }: { staff: StaffMember[] }) {
  const { open, animate } = useSidebar()
  return (
    <div
      className={cn(
        "overflow-hidden border-t border-sidebar-border pt-4",
        animate && "transition-all duration-200",
        animate ? (open ? "max-h-60 opacity-100" : "max-h-0 border-t-0 pt-0 opacity-0") : "max-h-60 opacity-100"
      )}
    >
      <span className="text-xs font-medium whitespace-nowrap text-muted-foreground">On shift</span>
      <ul className="mt-2 flex flex-col gap-2">
        {staff.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white",
                  getStaffColor(member.name)
                )}
              >
                {member.name.charAt(0)}
              </span>
              <span className="whitespace-nowrap text-sidebar-foreground">{member.name}</span>
            </span>
            <span className="font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">
              {member.orderCount} order{member.orderCount === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.7rem] leading-relaxed whitespace-nowrap text-muted-foreground">
        Internal ops tool. Session-only mock data.
      </p>
    </div>
  )
}
