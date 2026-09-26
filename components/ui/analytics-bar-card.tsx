"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

/**
 * A headline figure over a small animated bar chart.
 *
 * Note the filename. The reference ships this as `card.tsx`, which in this
 * codebase would overwrite the shadcn Card that thirteen files import — hence
 * `analytics-bar-card`. It is a chart card, not a replacement for Card.
 *
 * Bars are scaled to the largest value rather than treated as percentages. The
 * reference used `value` directly as both the height and the printed label, so
 * it only worked if the caller pre-computed percentages, and a set like 20/15/10
 * rendered as three stubs in an otherwise empty frame. Scaling to the max uses
 * the space and keeps the printed number the real one.
 */

export interface BarDatum {
  label: string
  value: number
  /** Overrides the text drawn on the bar. Defaults to the value. */
  display?: string
}

export interface AnalyticsBarCardProps {
  title: string
  /** The headline figure, already formatted. */
  totalAmount: string
  /** Sits under the headline, e.g. what the bars are measuring. */
  caption?: string
  icon?: React.ReactNode
  data: BarDatum[]
  emptyMessage?: string
  className?: string
}

export function AnalyticsBarCard({
  title,
  totalAmount,
  caption,
  icon,
  data = [],
  emptyMessage = "Nothing to chart yet.",
  className,
}: AnalyticsBarCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const maxValue = Math.max(...data.map((item) => item.value), 0)
  const hasData = data.length > 0 && maxValue > 0

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 text-card-foreground", className)}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2 mb-5">
        <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {totalAmount}
        </p>
        {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
      </div>

      {!hasData ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div
          role="img"
          aria-label={`${title}: ${data.map((d) => `${d.label} ${d.display ?? d.value}`).join(", ")}`}
          // Columns follow the data rather than being pinned at three: recipes can
          // be added and removed, and a hardcoded grid-cols-3 breaks the moment
          // there are two or four.
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        >
          {data.map((item, index) => {
            const heightPct = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 4) : 0
            const isMax = item.value === maxValue
            return (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div
                  className="relative flex h-32 w-full items-end overflow-hidden rounded-lg bg-muted/40"
                  style={{
                    // The reference wrote hsl(var(--muted)); these tokens are
                    // oklch, so that produced an invalid colour and no stripes.
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 4px, var(--color-muted) 4px, var(--color-muted) 8px)",
                  }}
                >
                  <motion.div
                    className={cn(
                      "relative w-full rounded-t-md",
                      isMax ? "bg-primary" : "bg-primary/45"
                    )}
                    initial={shouldReduceMotion ? false : { height: "0%" }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{
                      duration: 0.7,
                      delay: shouldReduceMotion ? 0 : index * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <span className="absolute top-1.5 left-1/2 h-1 w-1/3 -translate-x-1/2 rounded-full bg-primary-foreground/40" />
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-mono text-xs font-semibold tabular-nums text-primary-foreground">
                      {item.display ?? item.value}
                    </span>
                  </motion.div>
                </div>
                <span className="w-full truncate text-center text-xs text-muted-foreground">
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
