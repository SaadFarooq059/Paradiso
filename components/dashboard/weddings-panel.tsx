"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, CalendarHeart, HeartHandshake, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { WeddingDetail } from "@/components/dashboard/wedding-detail"
import { WeddingEnquiryForm } from "@/components/dashboard/wedding-enquiry-form"
import { formatDateLong } from "@/lib/format-date"
import { formatMoney } from "@/lib/payments"
import { DEAD_STAGES, WEDDING_STAGE_LABEL, type WeddingStage } from "@/lib/weddings"
import type { CalendarSettings, ProductVariant, Wedding, WeddingPackage } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The wedding pipeline.
 *
 * A wedding is never an Order — it has a quote history, a venue, tiers and
 * logistics that would be nullable noise on every counter tiramisù. It books
 * kitchen capacity directly instead, which is why the production calendar and
 * the stock forecast already know about it without a parallel system.
 */

const STAGE_CLASS: Record<string, string> = {
  Enquiry: "border-border bg-muted text-muted-foreground",
  Quoted: "border-primary/30 bg-primary/10 text-primary",
  DepositPaid: "border-success/30 bg-success/10 text-success",
  Confirmed: "border-success/40 bg-success text-success-foreground",
  InProduction: "border-primary/30 bg-primary/10 text-primary",
  Delivered: "border-primary/40 bg-primary text-primary-foreground",
  Completed: "border-success/40 bg-success text-success-foreground",
  Cancelled: "border-destructive/40 bg-destructive text-destructive-foreground",
  Lost: "border-destructive/30 bg-destructive/10 text-destructive",
}

export function WeddingsPanel({
  weddings,
  packages,
  variants,
  settings,
  canManage,
  selectedId,
  onSelectedIdChange,
  onCreate,
  onAction,
}: {
  weddings: Wedding[]
  packages: WeddingPackage[]
  variants: ProductVariant[]
  settings: CalendarSettings
  canManage: boolean
  /** Controlled by the dashboard so the Orders screen can open one directly. */
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
  onCreate: (input: Record<string, unknown>) => void
  onAction: (weddingId: string, action: string, payload?: Record<string, unknown>) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const setSelectedId = onSelectedIdChange

  const selected = selectedId ? (weddings.find((w) => w.id === selectedId) ?? null) : null

  // Live first, then the ones that are finished or gone.
  const sorted = useMemo(() => {
    const live = weddings.filter((w) => !DEAD_STAGES.includes(w.stage as WeddingStage))
    const dead = weddings.filter((w) => DEAD_STAGES.includes(w.stage as WeddingStage))
    return [...live, ...dead]
  }, [weddings])

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="-ml-2">
          <ArrowLeft data-icon="inline-start" />
          Back to weddings
        </Button>
        <WeddingDetail
          wedding={selected}
          packages={packages}
          variants={variants}
          settings={settings}
          canManage={canManage}
          onAction={(action, payload) => onAction(selected.id, action, payload)}
        />
      </div>
    )
  }

  if (isAdding) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="-ml-2">
          <ArrowLeft data-icon="inline-start" />
          Back to weddings
        </Button>
        <WeddingEnquiryForm
          onSubmit={(input) => {
            onCreate(input)
            setIsAdding(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Button onClick={() => setIsAdding(true)}>
          <Plus data-icon="inline-start" />
          Log an enquiry
        </Button>
      )}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Empty>
              <EmptyTitle>No weddings yet</EmptyTitle>
              <EmptyDescription>
                Enquiries logged here move through quoting, deposit and production. They book the
                kitchen at whatever stage Calendar Rules says.
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
          {sorted.map((wedding) => (
            <WeddingCard key={wedding.id} wedding={wedding} onOpen={() => setSelectedId(wedding.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function WeddingCard({ wedding, onOpen }: { wedding: Wedding; onOpen: () => void }) {
  const tiers = wedding.currentQuote?.tiers ?? []
  const tierUnits = tiers.reduce((sum, t) => sum + t.quantity, 0)

  return (
    <Card
      onClick={onOpen}
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/40",
        DEAD_STAGES.includes(wedding.stage as WeddingStage) && "opacity-60"
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <HeartHandshake className="size-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {wedding.customer?.name ?? "Unknown customer"}
              </CardTitle>
              <CardDescription className="truncate">
                {wedding.reference} · {wedding.venue || "venue tbc"}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={cn("shrink-0", STAGE_CLASS[wedding.stage])}>
            {WEDDING_STAGE_LABEL[wedding.stage as WeddingStage] ?? wedding.stage}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarHeart className="size-3.5 shrink-0" />
          {formatDateLong(wedding.eventDate)} · {wedding.guestCount} guests
        </div>

        <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
          <Figure label="Quoted" value={wedding.currentQuote ? formatMoney(wedding.currentQuote.total) : "—"} />
          <Figure label="Paid" value={formatMoney(wedding.payment.paid)} />
          <Figure
            label="Outstanding"
            value={formatMoney(wedding.outstanding)}
            emphasis={wedding.outstanding > 0}
          />
        </dl>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {wedding.capacityBookedAt ? (
            <Badge variant="outline" className="border-success/30 bg-success/10 font-normal text-success">
              Kitchen booked · {tiers.length} tier{tiers.length === 1 ? "" : "s"}, {tierUnits} cake
              {tierUnits === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              Not holding capacity yet
            </Badge>
          )}
          {wedding.loans.some((l) => !l.returned) && (
            <Badge variant="outline" className="border-primary/30 font-normal text-primary">
              {wedding.loans.filter((l) => !l.returned).length} out on loan
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Figure({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-sm tabular-nums",
          emphasis ? "font-semibold text-foreground" : "text-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
