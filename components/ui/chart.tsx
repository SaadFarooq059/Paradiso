"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

/**
 * Recharts harness — container, per-chart CSS variables, tooltip and legend.
 *
 * Adapted from the shadcn chart primitive. Two things differ from the version
 * that ships with it, both because this project's tokens are oklch rather than
 * raw HSL channels: colours are written as whole CSS values (`var(--color-x)`,
 * `color-mix(...)`) and never wrapped in `hsl(...)`, and the surface classes
 * point at this project's own tokens. Wrapping an oklch token in `hsl()`
 * produces an invalid colour that silently renders as nothing.
 */

const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> })
}

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

export function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used within a <ChartContainer />")
  return context
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-hidden",
          "[&_.recharts-sector]:outline-hidden",
          "[&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

/**
 * Publishes each series' colour as `--color-<key>` scoped to this chart, so the
 * marks can refer to them by name and dark mode can supply its own step.
 */
export function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.theme || item.color)
  if (!colorConfig.length) return null

  const css = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const declarations = colorConfig
        .map(([key, item]) => {
          const color = item.theme?.[theme as keyof typeof item.theme] || item.color
          return color ? `  --color-${key}: ${color};` : null
        })
        .filter(Boolean)
        .join("\n")
      return `${prefix} [data-chart=${id}] {\n${declarations}\n}`
    })
    .join("\n")

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}

export const ChartTooltip = RechartsPrimitive.Tooltip
export const ChartLegend = RechartsPrimitive.Legend

/**
 * Recharts 3 no longer exposes `payload` on LegendProps, so the shape the
 * `content` render prop actually receives is declared here rather than derived.
 */
export interface ChartLegendPayloadItem {
  value?: string
  dataKey?: string | number
  color?: string
}

export function ChartLegendContent({
  className,
  payload,
  verticalAlign = "bottom",
  order,
}: React.ComponentProps<"div"> & {
  payload?: ChartLegendPayloadItem[]
  verticalAlign?: "top" | "bottom" | "middle"
  /**
   * Series keys in the order they should be listed. Recharts returns its
   * payload in its own order, which for a stacked chart is not the order the
   * series mean anything in — a lifecycle reads Scheduled to Cancelled, not
   * alphabetically.
   */
  order?: string[]
}) {
  const { config } = useChart()
  if (!payload?.length) return null

  const sorted = order
    ? [...payload].sort(
        (a, b) =>
          order.indexOf(`${a.dataKey ?? a.value}`) - order.indexOf(`${b.dataKey ?? b.value}`)
      )
    : payload

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {sorted.map((item) => {
        const key = `${item.dataKey || item.value}`
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {/* Text wears text tokens; the swatch beside it carries identity. */}
            <span className="text-xs text-muted-foreground">{config[key]?.label ?? key}</span>
          </div>
        )
      })}
    </div>
  )
}
