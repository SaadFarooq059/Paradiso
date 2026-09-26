"use client"

import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

/**
 * A headline total split into two parts, drawn as concentric rings of dots.
 *
 * The dots carry the data. Each ring allocates its dots between the two
 * segments in proportion to their values, starting at twelve o'clock — so a
 * 50/50 split looks like a 50/50 split and a 9/1 split looks like one. The
 * reference design this is based on used a fixed number of evenly spaced dots
 * in each ring, which reads as a chart but encodes nothing; that is fine as
 * decoration and misleading on a page labelled analytics.
 *
 * There is deliberately no trend indicator. Showing "+15.2%" would require
 * history this app does not keep, and an invented one on a reporting screen is
 * worse than none.
 */

export interface RingSegment {
  label: string
  value: number
  /** A CSS colour — pass a palette token, e.g. "var(--color-chart-2)". */
  color: string
}

interface ProportionRingCardProps {
  /** Small label above the headline figure. */
  caption: string
  /** Total shown in the middle. Defaults to the sum of the segments. */
  total?: number
  /** Unit suffix for the headline, e.g. "units". */
  totalSuffix?: string
  segments: [RingSegment, RingSegment]
  /** Shown instead of the rings when there is nothing to divide up. */
  emptyMessage?: string
  action?: { label: string; onClick: () => void }
  className?: string
  outerDots?: number
  innerDots?: number
}

const VIEWBOX = 400
const CENTRE = VIEWBOX / 2

function ringDots(count: number, radius: number, firstShare: number) {
  // Split the ring's dots between the two segments, then place them clockwise
  // from twelve o'clock. Rounding is applied once, to the first segment, so the
  // two counts always add back up to `count`.
  const firstCount = Math.round(count * firstShare)
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2
    return {
      x: Math.round((CENTRE + radius * Math.cos(angle)) * 100) / 100,
      y: Math.round((CENTRE + radius * Math.sin(angle)) * 100) / 100,
      segment: i < firstCount ? 0 : 1,
      delay: i * 0.012,
    }
  })
}

export function ProportionRingCard({
  caption,
  total,
  totalSuffix,
  segments,
  emptyMessage = "Nothing to show yet.",
  action,
  className,
  outerDots = 48,
  innerDots = 36,
}: ProportionRingCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const animate = !shouldReduceMotion

  const sum = segments[0].value + segments[1].value
  const headline = total ?? sum
  const firstShare = sum > 0 ? segments[0].value / sum : 0
  const isEmpty = sum <= 0

  const rings = [
    { dots: ringDots(outerDots, 168, firstShare), r: 9 },
    { dots: ringDots(innerDots, 132, firstShare), r: 7 },
  ]

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className
      )}
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <div className="relative">
        {isEmpty ? (
          <div className="flex min-h-56 items-center justify-center px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="relative mx-auto aspect-square w-full max-w-80">
            <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="h-full w-full" aria-hidden="true">
              {rings.map((ring, ringIndex) =>
                ring.dots.map((dot, i) => (
                  <motion.circle
                    key={`${ringIndex}-${i}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={ring.r}
                    fill={segments[dot.segment].color}
                    initial={animate ? { opacity: 0, scale: 0 } : false}
                    // The second segment is secondary, not disabled: it is often
                    // the larger share, so it has to stay clearly legible.
                    animate={{ opacity: dot.segment === 0 ? 0.95 : 0.7, scale: 1 }}
                    transition={{ delay: dot.delay, duration: 0.35, ease: "easeOut" }}
                    style={{ transformOrigin: `${dot.x}px ${dot.y}px` }}
                  />
                ))
              )}
            </svg>

            {/* Fades the lower part of the rings so the legend sits cleanly over
                them. Uses the card token so it works in both themes. */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 0%, var(--color-card) 72%, var(--color-card) 100%)",
              }}
            />

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-10">
              <motion.span
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                initial={animate ? { opacity: 0, y: -6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {caption}
              </motion.span>
              <motion.span
                className="font-mono text-4xl font-semibold tabular-nums text-foreground"
                initial={animate ? { opacity: 0, y: 10, filter: "blur(4px)" } : false}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.35, type: "spring", stiffness: 280, damping: 26 }}
              >
                {headline.toLocaleString("en-GB")}
              </motion.span>
              {totalSuffix && (
                <span className="text-xs text-muted-foreground">{totalSuffix}</span>
              )}
            </div>
          </div>
        )}

        <div className={cn("px-5 pb-5", isEmpty ? "pt-0" : "-mt-6")}>
          <div className="flex items-start justify-between gap-4">
            {segments.map((segment, index) => {
              // Round once and derive the other, or 62.5/37.5 prints as 63% and
              // 38% and the card claims 101%.
              const firstPct = sum > 0 ? Math.round((segments[0].value / sum) * 100) : 0
              const share = sum > 0 ? (index === 0 ? firstPct : 100 - firstPct) : 0
              return (
                <div key={segment.label} className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-0.5 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-sm text-muted-foreground">{segment.label}</span>
                  </span>
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {segment.value.toLocaleString("en-GB")}
                  </span>
                  {sum > 0 && (
                    <span className="text-xs text-muted-foreground">{share}% of total</span>
                  )}
                </div>
              )
            })}
          </div>

          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-4 w-full rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
