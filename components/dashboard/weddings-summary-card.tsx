"use client"

import { CalendarHeart, ChevronRight, HeartHandshake } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateLong } from "@/lib/format-date"
import { formatMoney } from "@/lib/payments"
import { DEAD_STAGES, WEDDING_STAGE_LABEL, type WeddingStage } from "@/lib/weddings"
import type { Wedding } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Weddings, on the Orders screen.
 *
 * A sibling list rather than extra rows in the orders table, because the two do
 * not share columns. A wedding has no single product and no single quantity —
 * it is three tiers across two production days — and its stages are a different
 * vocabulary from OrderStatus. Putting "Deposit paid" in a column that otherwise
 * reads "Ready for collection" would make one column mean two things, which is
 * how a table starts lying.
 *
 * What matters is that it is here at all: someone looking for a wedding finds it
 * where they already look for work, without knowing a separate screen exists.
 */
export function WeddingsSummaryCard({
  weddings,
  onSelectWedding,
  onViewAll,
}: {
  weddings: Wedding[]
  onSelectWedding: (id: string) => void
  onViewAll: () => void
}) {
  // Live ones first; cancelled and lost drop to the bottom.
  const live = weddings.filter((w) => !DEAD_STAGES.includes(w.stage as WeddingStage))
  const dead = weddings.filter((w) => DEAD_STAGES.includes(w.stage as WeddingStage))
  const ordered = [...live, ...dead]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <HeartHandshake className="size-4" />
            </div>
            <div>
              <CardTitle>Weddings and bespoke orders</CardTitle>
              <CardDescription>
                {live.length} live · they book the kitchen separately from counter orders.
              </CardDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Open Weddings
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {ordered.length === 0 ? (
          <Empty>
            <EmptyTitle>No weddings yet</EmptyTitle>
            <EmptyDescription>Enquiries logged in Weddings will show up here too.</EmptyDescription>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Event date</TableHead>
                <TableHead>Cake</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((wedding) => {
                const tiers = wedding.currentQuote?.tiers ?? []
                const cakes = tiers.reduce((sum, t) => sum + t.quantity, 0)
                return (
                  <TableRow
                    key={wedding.id}
                    onClick={() => onSelectWedding(wedding.id)}
                    className={cn(
                      "cursor-pointer",
                      DEAD_STAGES.includes(wedding.stage as WeddingStage) && "opacity-60"
                    )}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {wedding.customer?.name ?? "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {wedding.reference} · {wedding.venue || "venue tbc"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <CalendarHeart className="size-3.5 shrink-0 text-muted-foreground" />
                        {formatDateLong(wedding.eventDate)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tiers.length === 0
                        ? "Not quoted"
                        : `${tiers.length} tier${tiers.length === 1 ? "" : "s"} · ${cakes} cake${cakes === 1 ? "" : "s"}`}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {wedding.currentQuote ? formatMoney(wedding.currentQuote.total) : "—"}
                      {wedding.outstanding > 0 && wedding.currentQuote && (
                        <span className="block text-xs text-muted-foreground">
                          {formatMoney(wedding.outstanding)} due
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {WEDDING_STAGE_LABEL[wedding.stage as WeddingStage] ?? wedding.stage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
