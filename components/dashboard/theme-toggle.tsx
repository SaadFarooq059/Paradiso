"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"

import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/**
 * Theme switch for the sidebar.
 *
 * Three states rather than two, because "system" is a real choice and a plain
 * light/dark toggle silently throws it away the first time it is pressed.
 *
 * Nothing theme-dependent renders until after mount. On the server there is no
 * way to know the resolved theme — it comes from localStorage or a media query —
 * so rendering the active state during SSR guarantees a hydration mismatch and a
 * visible flicker. The placeholder keeps the layout from shifting meanwhile.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { open, animate } = useSidebar()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="h-9" aria-hidden="true" />
  }

  const ActiveIcon = resolvedTheme === "dark" ? Moon : Sun

  // Collapsed rail: one button that cycles, since three targets will not fit.
  if (!open) {
    const next = resolvedTheme === "dark" ? "light" : "dark"
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`Switch to ${next} theme`}
        title={`Switch to ${next} theme`}
        className="flex h-9 w-full items-center justify-center rounded-lg border border-sidebar-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ActiveIcon className="size-4 shrink-0" />
      </button>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-sidebar-border p-0.5",
        animate && "transition-opacity duration-200"
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const isActive = theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(option.value)}
            title={option.label}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
