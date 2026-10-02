"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ChefHat, MapPin, Package, Plus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { WeddingDetail } from "@/components/dashboard/wedding-detail"
import { WeddingEnquiryForm } from "@/components/dashboard/wedding-enquiry-form"
import {
  DateTile,
  STAGE_CLASS,
  STAGE_DOT,
  WEEKDAY,
  countdown,
  daysUntil,
} from "@/components/dashboard/wedding-visuals"
import { formatMoney } from "@/lib/payments"
import { DEAD_STAGES, WEDDING_PROGRESSION, WEDDING_STAGE_LABEL, type WeddingStage } from "@/lib/weddings"
import type { CalendarSettings, ProductVariant, Wedding, WeddingExtra, WeddingPackage } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The wedding pipeline.
 *
 * A wedding is never an Order — it has a quote history, a venue, tiers and
 * logistics that would be nullable noise on every counter tiramisù. It books
 * kitchen capacity directly instead, which is why the production calendar and
 * the stock forecast already know about it without a parallel system.
 */

export function WeddingsPanel({
  weddings,
  packages,
  extras,
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
  extras: WeddingExtra[]
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
  /** A progression stage, "closed" for Cancelled and Lost, or null for every live wedding. */
  const [filter, setFilter] = useState<WeddingStage | "closed" | null>(null)
  const setSelectedId = onSelectedIdChange

  const selected = selectedId ? (weddings.find((w) => w.id === selectedId) ?? null) : null

  const isDead = (w: Wedding) => DEAD_STAGES.includes(w.stage as WeddingStage)

  // Soonest event first: that is the one someone needs to act on.
  const sorted = useMemo(() => {
    const byDate = [...weddings].sort((a, b) => +new Date(a.eventDate) - +new Date(b.eventDate))
    if (filter === "closed") return byDate.filter(isDead)
    if (filter) return byDate.filter((w) => w.stage === filter)
    return byDate.filter((w) => !isDead(w))
  }, [weddings, filter])

  const live = weddings.filter((w) => !isDead(w))
  const totals = {
    quoted: live.reduce((sum, w) => sum + (w.currentQuote?.total ?? 0), 0),
    paid: live.reduce((sum, w) => sum + w.payment.paid, 0),
    outstanding: live.reduce((sum, w) => sum + w.outstanding, 0),
  }

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
          extras={extras}
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <dl className="flex flex-wrap gap-x-8 gap-y-2">
              <Total label="Live weddings" value={String(live.length)} />
              <Total label="Quoted" value={formatMoney(totals.quoted)} />
              <Total label="Paid" value={formatMoney(totals.paid)} />
              <Total label="Outstanding" value={formatMoney(totals.outstanding)} emphasis={totals.outstanding > 0} />
            </dl>
            {canManage && (
              <Button onClick={() => setIsAdding(true)}>
                <Plus data-icon="inline-start" />
                Log an enquiry
              </Button>
            )}
          </div>

          {/* The pipeline doubles as the filter: each stage is a count you can open. */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter by stage">
            <StageChip label="All live" count={live.length} active={filter === null} onClick={() => setFilter(null)} />
            {WEDDING_PROGRESSION.map((stage) => (
              <StageChip
                key={stage}
                label={WEDDING_STAGE_LABEL[stage]}
                count={weddings.filter((w) => w.stage === stage).length}
                active={filter === stage}
                dotClass={STAGE_DOT[stage]}
                onClick={() => setFilter(filter === stage ? null : stage)}
              />
            ))}
            <StageChip
              label="Closed"
              count={weddings.length - live.length}
              active={filter === "closed"}
              dotClass="bg-destructive"
              onClick={() => setFilter(filter === "closed" ? null : "closed")}
            />
          </div>
        </CardContent>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Empty>
              <EmptyTitle>{weddings.length === 0 ? "No weddings yet" : "Nothing at this stage"}</EmptyTitle>
              <EmptyDescription>
                {weddings.length === 0
                  ? "Enquiries logged here move through quoting, deposit and production. They book the kitchen at whatever stage Calendar Rules says."
                  : "Pick another stage above, or All live to see everything that is still going ahead."}
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
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
  const dead = DEAD_STAGES.includes(wedding.stage as WeddingStage)
  const eventDate = new Date(wedding.eventDate)
  const days = daysUntil(eventDate)
  const quoted = wedding.currentQuote?.total ?? 0
  const paidRatio = quoted > 0 ? Math.min(wedding.payment.paid / quoted, 1) : 0
  const onLoan = wedding.loans.filter((l) => !l.returned).length

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        "cursor-pointer gap-0 py-0 transition-colors hover:border-primary/40 hover:bg-muted/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dead && "opacity-60"
      )}
    >
      <div className="flex gap-4 p-4">
        <DateTile date={eventDate} />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate font-medium text-foreground">{wedding.customer?.name ?? "Unknown customer"}</span>
            <Badge variant="outline" className={cn("shrink-0", STAGE_CLASS[wedding.stage])}>
              {WEDDING_STAGE_LABEL[wedding.stage as WeddingStage] ?? wedding.stage}
            </Badge>
          </div>
          <span className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {wedding.venue || "Venue tbc"}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{WEEKDAY.format(eventDate)}</span>
            {!dead && (
              <span className={cn("font-medium", days >= 0 && days <= 14 ? "text-primary" : "text-foreground")}>
                {countdown(days)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="size-3" aria-hidden="true" />
              {wedding.guestCount} guests
            </span>
            <span className="font-mono">{wedding.reference}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3">
        {wedding.currentQuote ? (
          <>
            <div className="flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums text-muted-foreground">
              <span>
                <span className="text-sm font-semibold text-foreground">{formatMoney(wedding.payment.paid)}</span> of{" "}
                {formatMoney(quoted)} paid
              </span>
              {wedding.outstanding > 0 && <span>{formatMoney(wedding.outstanding)} due</span>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className={cn("h-full rounded-full", paidRatio >= 1 ? "bg-success" : "bg-primary")}
                style={{ width: `${paidRatio * 100}%` }}
              />
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Not quoted yet</span>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {wedding.capacityBookedAt ? (
            <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 font-normal text-success">
              <ChefHat data-icon="inline-start" />
              Kitchen booked · {tierUnits} cake{tierUnits === 1 ? "" : "s"}
            </Badge>
          ) : (
            !dead && (
              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                <ChefHat data-icon="inline-start" />
                Kitchen not booked yet
              </Badge>
            )
          )}
          {onLoan > 0 && (
            <Badge variant="outline" className="gap-1 border-primary/30 font-normal text-primary">
              <Package data-icon="inline-start" />
              {onLoan} out on loan
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}

function StageChip({
  label,
  count,
  active,
  dotClass,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  dotClass?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
        !active && count === 0 && "text-muted-foreground"
      )}
    >
      {dotClass && <span className={cn("size-2 rounded-full", dotClass, active && "bg-primary-foreground")} aria-hidden="true" />}
      {label}
      <span className={cn("font-mono text-xs tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {count}
      </span>
    </button>
  )
}

function Total({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono text-lg tabular-nums text-foreground", emphasis && "font-semibold")}>{value}</dd>
    </div>
  )
}
