"use client"

import dynamic from "next/dynamic"

import type { Order } from "@/lib/types"

/**
 * Loads the chart, and recharts with it, only when Reports is opened.
 *
 * The dashboard is one client-rendered page, so a static import of this card
 * would put the whole charting library in the bundle every visitor downloads —
 * including the ones who never leave New Order. This is the same reason the
 * export writers are dynamically imported.
 *
 * `ssr: false` because the chart sizes itself from its container, which has no
 * dimensions on the server; prerendering it only produces markup that is thrown
 * away on hydration.
 */
const Chart = dynamic(
  () => import("./orders-by-status-chart").then((m) => m.OrdersByStatusChart),
  {
    ssr: false,
    // Holds the card's height so opening Reports does not jolt the layout.
    loading: () => (
      <div
        className="min-h-[26rem] animate-pulse rounded-xl bg-card ring-1 ring-foreground/10"
        aria-hidden="true"
      />
    ),
  }
)

export function OrdersByStatusChart(props: { orders: Order[]; className?: string }) {
  return <Chart {...props} />
}
