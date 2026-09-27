"use client"

import { useState } from "react"
import { Banknote, Check, HeartHandshake, PackageCheck, Plus, Truck, Undo2, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDateLong, formatDateTime } from "@/lib/format-date"
import { formatMoney, parseMoney } from "@/lib/payments"
import {
  DEAD_STAGES,
  WEDDING_PROGRESSION,
  WEDDING_STAGE_LABEL,
  deliveryAmount,
  extraLineAmount,
  weddingPaymentLabel,
  type WeddingStage,
} from "@/lib/weddings"
import type {
  CalendarSettings,
  ProductVariant,
  Wedding,
  WeddingExtra,
  WeddingPackage,
} from "@/lib/types"
import { cn } from "@/lib/utils"

export function WeddingDetail({
  wedding,
  packages,
  extras,
  variants,
  settings,
  canManage,
  onAction,
}: {
  wedding: Wedding
  packages: WeddingPackage[]
  extras: WeddingExtra[]
  variants: ProductVariant[]
  settings: CalendarSettings
  canManage: boolean
  onAction: (action: string, payload?: Record<string, unknown>) => void
}) {
  const quote = wedding.currentQuote
  const isDead = DEAD_STAGES.includes(wedding.stage as WeddingStage)
  const nextStage = nextStageAfter(wedding.stage as WeddingStage)

  return (
    <div className="@container grid gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @4xl:items-start">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <HeartHandshake className="size-5" />
                </div>
                <div>
                  <CardTitle>{wedding.customer?.name ?? "Unknown customer"}</CardTitle>
                  <CardDescription>
                    {wedding.reference} · {formatDateLong(wedding.eventDate)}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline">
                {WEDDING_STAGE_LABEL[wedding.stage as WeddingStage] ?? wedding.stage}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 text-sm">
            <dl className="grid gap-3 @sm:grid-cols-2 @3xl:grid-cols-4">
              <Detail label="Venue" value={wedding.venue || "—"} />
              <Detail label="Guests" value={String(wedding.guestCount)} />
              <Detail
                label="Contact"
                value={wedding.customer?.email ?? "—"}
                sub={wedding.customer?.phone ?? undefined}
              />
              <Detail
                label="Kitchen"
                value={wedding.capacityBookedAt ? "Capacity booked" : "Not booked"}
                sub={
                  wedding.capacityBookedAt
                    ? formatDateTime(wedding.capacityBookedAt)
                    : `Books ${settings.weddingCapacityStage === "AtQuote" ? "at quote" : settings.weddingCapacityStage === "AtDeposit" ? "at deposit" : "at confirmation"}`
                }
              />
            </dl>

            {(wedding.flavourNotes || wedding.dietaryRequirements || wedding.notes) && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                {wedding.flavourNotes && <Note label="Flavours" text={wedding.flavourNotes} />}
                {wedding.dietaryRequirements && (
                  <Note label="Dietary requirements" text={wedding.dietaryRequirements} emphasis />
                )}
                {wedding.notes && <Note label="Notes" text={wedding.notes} />}
              </div>
            )}

            {canManage && !isDead && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {nextStage && (
                  <Button onClick={() => onAction("stage", { stage: nextStage })}>
                    <Check data-icon="inline-start" />
                    Move to {WEDDING_STAGE_LABEL[nextStage]}
                  </Button>
                )}
                <Button variant="outline" onClick={() => onAction("stage", { stage: "Lost" })}>
                  Mark lost
                </Button>
                <Button variant="destructive" onClick={() => onAction("stage", { stage: "Cancelled" })}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <QuoteCard
          wedding={wedding}
          packages={packages}
          extras={extras}
          variants={variants}
          settings={settings}
          canManage={canManage && !isDead}
          onAction={onAction}
        />

        <MoneyCard wedding={wedding} settings={settings} canManage={canManage && !isDead} onAction={onAction} />

        <LogisticsCard
          wedding={wedding}
          settings={settings}
          canManage={canManage && !isDead}
          onAction={onAction}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
            <CardDescription>Every stage this wedding has been through.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {wedding.stageHistory.map((event, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {WEDDING_STAGE_LABEL[event.stage as WeddingStage] ?? event.stage}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(event.at)} · {event.actorName ?? "author unknown"}
                      {event.note ? ` — ${event.note}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {wedding.quotes.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quote history</CardTitle>
              <CardDescription>
                Amendments create a version. Nothing is overwritten, so what was agreed survives.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {wedding.quotes.map((q) => (
                  <li key={q.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-baseline gap-2">
                      <span className={cn("font-medium", q.supersededAt ? "text-muted-foreground" : "text-foreground")}>
                        v{q.version}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {q.guestCount} guests · {formatDateTime(q.createdAt)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "font-mono text-sm tabular-nums",
                        q.supersededAt ? "text-muted-foreground line-through" : "text-foreground"
                      )}
                    >
                      {formatMoney(q.total)}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

/** The next step in the straight line, or null at the end. */
function nextStageAfter(stage: WeddingStage): WeddingStage | null {
  const i = WEDDING_PROGRESSION.indexOf(stage)
  if (i < 0 || i === WEDDING_PROGRESSION.length - 1) return null
  return WEDDING_PROGRESSION[i + 1]
}

function Detail({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  )
}

function Note({ label, text, emphasis }: { label: string; text: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm", emphasis ? "font-medium text-destructive" : "text-foreground")}>
        {text}
      </span>
    </div>
  )
}

/* ----------------------------------------------------------------- quote */

function QuoteCard({
  wedding,
  packages,
  extras,
  variants,
  settings,
  canManage,
  onAction,
}: {
  wedding: Wedding
  packages: WeddingPackage[]
  extras: WeddingExtra[]
  variants: ProductVariant[]
  settings: CalendarSettings
  canManage: boolean
  onAction: (action: string, payload?: Record<string, unknown>) => void
}) {
  const quote = wedding.currentQuote
  const [editing, setEditing] = useState(false)
  const [packageId, setPackageId] = useState(quote?.packageId ?? packages[0]?.id ?? "")
  const [guestCount, setGuestCount] = useState(String(quote?.guestCount ?? wedding.guestCount))
  const [tiers, setTiers] = useState<{ variantId: string; quantity: string; label: string }[]>(
    quote?.tiers.map((t) => ({ variantId: t.variantId, quantity: String(t.quantity), label: t.label })) ?? [
      { variantId: variants[0]?.id ?? "", quantity: "1", label: "" },
    ]
  )
  const [adjustmentLabel, setAdjustmentLabel] = useState("")
  const [adjustmentAmount, setAdjustmentAmount] = useState("")

  // The priced lines are read back out of the quote rather than kept in a second
  // place, so amending starts from what was actually agreed.
  const [extraQuantities, setExtraQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (quote?.adjustments ?? [])
        .filter((a) => a.kind === "extra" && a.extraId)
        .map((a) => [a.extraId as string, String(a.quantity ?? 0)])
    )
  )
  const [deliveryMiles, setDeliveryMiles] = useState(() => {
    const line = (quote?.adjustments ?? []).find((a) => a.kind === "delivery")
    return line ? String(line.quantity ?? "") : ""
  })
  const [stencil, setStencil] = useState(() => {
    const line = (quote?.adjustments ?? []).find((a) => a.kind === "stencil")
    return line?.label.replace(/^Stencil: "(.*)"$/, "$1") ?? ""
  })

  const pkg = packages.find((p) => p.id === packageId)
  // Only the hand-typed ones carry forward as-is; the rest are re-priced below
  // from the current price list.
  const adjustments = (quote?.adjustments ?? []).filter((a) => !a.kind)
  const pendingAdjustment =
    adjustmentLabel.trim() && parseMoney(adjustmentAmount.replace(/^-/, "")) !== null
      ? {
          label: adjustmentLabel.trim(),
          amount:
            (adjustmentAmount.trim().startsWith("-") ? -1 : 1) *
            (parseMoney(adjustmentAmount.replace(/^-/, "")) ?? 0),
        }
      : null

  const nextAdjustments = pendingAdjustment ? [...adjustments, pendingAdjustment] : adjustments

  // Chosen extras, as ids and counts. What they cost is the server's decision;
  // this only mirrors the arithmetic so the total on screen is not a surprise.
  const chosenExtras = extras
    .map((extra) => ({ extra, quantity: Number.parseInt(extraQuantities[extra.id] ?? "", 10) }))
    .filter(({ quantity }) => Number.isFinite(quantity) && quantity > 0)

  const milesValue = Number.parseFloat(deliveryMiles)
  const hasDelivery = Number.isFinite(milesValue) && milesValue > 0

  const previewLines = [
    ...chosenExtras.map(({ extra, quantity }) => ({
      label: `${extra.name} × ${quantity}`,
      amount: extraLineAmount(extra, quantity),
      discounted: extra.bulkFrom !== null && quantity >= extra.bulkFrom,
    })),
    ...(hasDelivery
      ? [
          {
            label: `Delivery, ${milesValue} miles`,
            amount: deliveryAmount(milesValue, settings.deliveryPerMile),
            discounted: false,
          },
        ]
      : []),
  ]

  const projectedTotal =
    (pkg?.basePrice ?? 0) +
    nextAdjustments.reduce((sum, a) => sum + a.amount, 0) +
    previewLines.reduce((sum, line) => sum + line.amount, 0)
  const delta = quote ? projectedTotal - quote.total : 0

  const overMaxMiles = hasDelivery && milesValue > settings.deliveryMaxMiles
  const underMinimum = hasDelivery && projectedTotal < settings.deliveryMinimumOrder

  function submit() {
    onAction("quote", {
      packageId: packageId || null,
      guestCount: Number.parseInt(guestCount, 10),
      adjustments: nextAdjustments,
      extras: chosenExtras.map(({ extra, quantity }) => ({ extraId: extra.id, quantity })),
      deliveryMiles: hasDelivery ? milesValue : null,
      stencil: pkg?.stencilOptions.length ? stencil || null : null,
      tiers: tiers
        .filter((t) => t.variantId && Number.parseInt(t.quantity, 10) > 0)
        .map((t) => ({
          variantId: t.variantId,
          quantity: Number.parseInt(t.quantity, 10),
          label: t.label,
        })),
    })
    setEditing(false)
    setAdjustmentLabel("")
    setAdjustmentAmount("")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Quote {quote ? `v${quote.version}` : ""}
            </CardTitle>
            <CardDescription>
              Built from a package, extras and adjustments, at the shop&apos;s published
              prices.
            </CardDescription>
          </div>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : quote ? "Amend" : "Build a quote"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-sm">
        {quote && !editing && (
          <>
            <dl className="grid gap-3 @sm:grid-cols-3">
              <Detail label="Package" value={packages.find((p) => p.id === quote.packageId)?.name ?? "Bespoke"} />
              <Detail label="Guests" value={String(quote.guestCount)} />
              <Detail label="Total" value={formatMoney(quote.total)} />
            </dl>
            <div className="flex flex-wrap gap-1.5">
              {quote.tiers.map((tier, i) => (
                <Badge key={i} variant="secondary" className="font-normal">
                  {tier.quantity} × {variants.find((v) => v.id === tier.variantId)?.name ?? tier.variantId}
                  {tier.label ? ` (${tier.label})` : ""}
                </Badge>
              ))}
            </div>
            {quote.adjustments.length > 0 && (
              <ul className="flex flex-col gap-1">
                {quote.adjustments.map((a, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{a.label}</span>
                    <span className="font-mono tabular-nums">{formatMoney(a.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {!quote && !editing && (
          <p className="text-muted-foreground">
            No quote yet. Building one moves this enquiry to Quoted — the shop quotes
            within {settings.weddingQuoteTurnaround}.
          </p>
        )}

        {editing && (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="q-package">Package</FieldLabel>
              <Select value={packageId} onValueChange={(v) => setPackageId(v as string)}>
                <SelectTrigger id="q-package" className="w-full">
                  <SelectValue>
                    {(v: string | null) => packages.find((p) => p.id === v)?.name ?? "Choose a package"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.basePrice)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pkg && (
                <FieldDescription>
                  {pkg.description} Includes: {pkg.includes.join("; ")}.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="q-guests">Guest count</FieldLabel>
              <Input
                id="q-guests"
                type="number"
                min={1}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Tiers</span>
              {tiers.map((tier, i) => (
                <div key={i} className="grid gap-2 @sm:grid-cols-[minmax(0,2fr)_5rem_minmax(0,2fr)_auto]">
                  <Select
                    value={tier.variantId}
                    onValueChange={(v) =>
                      setTiers((prev) => prev.map((t, j) => (j === i ? { ...t, variantId: v as string } : t)))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string | null) => variants.find((x) => x.id === v)?.name ?? "Recipe"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={tier.quantity}
                    onChange={(e) =>
                      setTiers((prev) => prev.map((t, j) => (j === i ? { ...t, quantity: e.target.value } : t)))
                    }
                  />
                  <Input
                    placeholder="Label"
                    value={tier.label}
                    onChange={(e) =>
                      setTiers((prev) => prev.map((t, j) => (j === i ? { ...t, label: e.target.value } : t)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Remove tier"
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  setTiers((prev) => [...prev, { variantId: variants[0]?.id ?? "", quantity: "1", label: "" }])
                }
              >
                <Plus data-icon="inline-start" />
                Add a tier
              </Button>
            </div>

            {pkg && pkg.stencilOptions.length > 0 && (
              <Field>
                <FieldLabel htmlFor="q-stencil">Stencilled message</FieldLabel>
                <Select value={stencil} onValueChange={(v) => setStencil(v as string)}>
                  <SelectTrigger id="q-stencil" className="w-full">
                    <SelectValue>{(v: string | null) => v || "Choose a message"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {pkg.stencilOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Included in the package price.</FieldDescription>
              </Field>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Extras</span>
              {extras.map((extra) => {
                const quantity = Number.parseInt(extraQuantities[extra.id] ?? "", 10)
                const qualifies =
                  extra.bulkFrom !== null && Number.isFinite(quantity) && quantity >= extra.bulkFrom
                if (extra.unit === "per mile") return null
                return (
                  <div
                    key={extra.id}
                    className="grid items-center gap-2 @sm:grid-cols-[minmax(0,1fr)_5rem_6rem]"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-foreground">{extra.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {formatMoney(extra.unitPrice)} {extra.unit}
                        {extra.bulkFrom !== null &&
                          ` · ${extra.bulkDiscountPercent}% off from ${extra.bulkFrom}`}
                      </span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      aria-label={`${extra.name} quantity`}
                      value={extraQuantities[extra.id] ?? ""}
                      onChange={(e) =>
                        setExtraQuantities((prev) => ({ ...prev, [extra.id]: e.target.value }))
                      }
                    />
                    <span
                      className={cn(
                        "text-right font-mono text-sm tabular-nums",
                        qualifies ? "text-success" : "text-muted-foreground"
                      )}
                    >
                      {Number.isFinite(quantity) && quantity > 0
                        ? formatMoney(extraLineAmount(extra, quantity))
                        : "—"}
                    </span>
                  </div>
                )
              })}
            </div>

            <Field>
              <FieldLabel htmlFor="q-miles">Delivery distance</FieldLabel>
              <Input
                id="q-miles"
                type="number"
                min={0}
                step="0.1"
                placeholder="Leave empty for collection"
                value={deliveryMiles}
                onChange={(e) => setDeliveryMiles(e.target.value)}
              />
              <FieldDescription>
                {formatMoney(settings.deliveryPerMile)} per mile, up to {settings.deliveryMaxMiles}{" "}
                miles, minimum order {formatMoney(settings.deliveryMinimumOrder)}. Collection is free.
              </FieldDescription>
              {overMaxMiles && (
                <FieldDescription className="text-destructive">
                  That is beyond the {settings.deliveryMaxMiles}-mile limit.
                </FieldDescription>
              )}
              {underMinimum && !overMaxMiles && (
                <FieldDescription className="text-destructive">
                  This quote is under the {formatMoney(settings.deliveryMinimumOrder)} delivery
                  minimum, so it is collection only.
                </FieldDescription>
              )}
            </Field>

            <div className="grid gap-2 @sm:grid-cols-[minmax(0,2fr)_8rem]">
              <Input
                placeholder="Adjustment, e.g. Extra tier"
                value={adjustmentLabel}
                onChange={(e) => setAdjustmentLabel(e.target.value)}
              />
              <Input
                placeholder="0.00 or -50.00"
                inputMode="decimal"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
              <span className="text-sm text-muted-foreground">
                New total
                {quote && delta !== 0 && (
                  // The difference, not a silently restated figure. The whole
                  // point of versioning is that the change is visible.
                  <span className={cn("ml-2 font-medium", delta > 0 ? "text-destructive" : "text-success")}>
                    {delta > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(delta))} vs v{quote.version}
                  </span>
                )}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {formatMoney(projectedTotal)}
              </span>
            </div>

            <Button onClick={submit} className="w-fit" disabled={overMaxMiles || underMinimum}>
              Save quote {quote ? `v${quote.version + 1}` : ""}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------------------- money */

function MoneyCard({
  wedding,
  settings,
  canManage,
  onAction,
}: {
  wedding: Wedding
  settings: CalendarSettings
  canManage: boolean
  onAction: (action: string, payload?: Record<string, unknown>) => void
}) {
  const [amount, setAmount] = useState("")
  const pence = parseMoney(amount)
  const valid = pence !== null && pence > 0
  const depositMet = wedding.payment.paid >= wedding.depositDue && wedding.depositDue > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Money</CardTitle>
            <CardDescription>
              The same ledger orders use — one place for takings and refunds.
            </CardDescription>
          </div>
          <Badge variant="outline">
            {weddingPaymentLabel(
              wedding.payment.total,
              wedding.payment.paid,
              wedding.payment.refunded,
              wedding.depositDue
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-2 gap-3 @sm:grid-cols-4">
          <Detail label="Quoted" value={formatMoney(wedding.payment.total)} />
          <Detail
            label={`Deposit (${settings.weddingDepositPercent}%)`}
            value={formatMoney(wedding.depositDue)}
            sub={depositMet ? "met" : "outstanding"}
          />
          <Detail label="Paid" value={formatMoney(wedding.payment.paid)} />
          <Detail
            label="Balance due"
            value={formatMoney(wedding.outstanding)}
            // The client's terms are a date, not a vague "before the day", so
            // say which date and whether it has passed.
            sub={
              wedding.balanceDueDate
                ? `by ${formatDateLong(new Date(wedding.balanceDueDate))}`
                : undefined
            }
          />
        </dl>

        {wedding.outstanding > 0 && wedding.balanceDueDate && (
          <p
            className={cn(
              "text-xs",
              wedding.balanceDueDate < Date.now() ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {wedding.balanceDueDate < Date.now()
              ? `The balance was due on ${formatDateLong(new Date(wedding.balanceDueDate))}.`
              : `The balance is due ${settings.weddingBalanceDueDaysBefore} days before the event, on ${formatDateLong(new Date(wedding.balanceDueDate))}.`}
          </p>
        )}

        {canManage && (
          <div className="flex flex-wrap items-end gap-2">
            <Field className="w-32">
              <FieldLabel htmlFor="w-amount">Amount</FieldLabel>
              <Input
                id="w-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Button
              variant="outline"
              disabled={!valid}
              onClick={() => {
                onAction("pay", { amount: pence })
                setAmount("")
              }}
            >
              <Banknote data-icon="inline-start" />
              Record payment
            </Button>
            <Button
              variant="outline"
              disabled={!valid}
              onClick={() => {
                onAction("refund", { amount: pence })
                setAmount("")
              }}
            >
              <Undo2 data-icon="inline-start" />
              Record refund
            </Button>
          </div>
        )}

        {wedding.payment.events.length > 0 && (
          <ol className="flex flex-col gap-1.5 border-t border-border pt-3">
            {wedding.payment.events.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3">
                <span className={cn("font-medium", e.kind === "Refund" ? "text-destructive" : "text-success")}>
                  {e.kind === "Refund" ? "−" : "+"}
                  {formatMoney(e.amount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(e.at)} · {e.actorName ?? "author unknown"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------- logistics */

function LogisticsCard({
  wedding,
  settings,
  canManage,
  onAction,
}: {
  wedding: Wedding
  settings: CalendarSettings
  canManage: boolean
  onAction: (action: string, payload?: Record<string, unknown>) => void
}) {
  const [staff, setStaff] = useState(String(wedding.staffRequired))
  const [drivers, setDrivers] = useState(String(wedding.driversRequired))
  const [item, setItem] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [deposit, setDeposit] = useState("")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Staff and logistics</CardTitle>
        <CardDescription>
          People and vehicles on the day, and what goes out on loan.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-end gap-2">
          <Field className="w-28">
            <FieldLabel htmlFor="w-staff">
              <Users className="mr-1 inline size-3.5" />
              Staff
            </FieldLabel>
            <Input id="w-staff" type="number" min={0} value={staff} onChange={(e) => setStaff(e.target.value)} />
          </Field>
          <Field className="w-28">
            <FieldLabel htmlFor="w-drivers">
              <Truck className="mr-1 inline size-3.5" />
              Drivers
            </FieldLabel>
            <Input
              id="w-drivers"
              type="number"
              min={0}
              value={drivers}
              onChange={(e) => setDrivers(e.target.value)}
            />
          </Field>
          {canManage && (
            <Button
              variant="outline"
              onClick={() =>
                onAction("logistics", {
                  staffRequired: Number.parseInt(staff, 10),
                  driversRequired: Number.parseInt(drivers, 10),
                })
              }
            >
              Save
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div>
            <span className="text-sm font-medium text-foreground">Trays and stands on loan</span>
            <p className="text-xs text-muted-foreground">
              Deposits come back when the item does, within {settings.loanReturnDays} days.
            </p>
          </div>
          {wedding.loans.length === 0 ? (
            <p className="text-muted-foreground">Nothing out on loan.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {wedding.loans.map((loan) => (
                <li key={loan.id} className="flex items-center justify-between gap-3">
                  <span className={cn("min-w-0", loan.returned && "text-muted-foreground")}>
                    <span className={cn(loan.returned && "line-through")}>
                      {loan.quantity} × {loan.item}
                    </span>
                    {loan.depositAmount > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatMoney(loan.depositAmount)} deposit
                        {loan.returned &&
                          (loan.depositRefundedAt
                            ? ` · refunded ${formatDateLong(new Date(loan.depositRefundedAt))}`
                            : " · kept, returned late")}
                      </span>
                    )}
                  </span>
                  {loan.returned ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-normal",
                        loan.depositAmount > 0 && !loan.depositRefundedAt
                          ? "border-destructive/30 text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      Returned
                    </Badge>
                  ) : canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction("loan-return", { loanId: loan.id })}
                    >
                      <PackageCheck data-icon="inline-start" />
                      Mark returned
                    </Button>
                  ) : (
                    <Badge variant="outline" className="border-primary/30 font-normal text-primary">
                      Out
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <div className="grid gap-2 @sm:grid-cols-[minmax(0,2fr)_5rem_6rem_auto]">
              <Input placeholder="Cake stand, 14-inch" value={item} onChange={(e) => setItem(e.target.value)} />
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <Input
                placeholder="Deposit"
                inputMode="decimal"
                aria-label="Deposit held"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!item.trim()}
                onClick={() => {
                  onAction("loan-out", {
                    item,
                    quantity: Number.parseInt(quantity, 10),
                    depositAmount: parseMoney(deposit) ?? 0,
                  })
                  setItem("")
                  setQuantity("1")
                  setDeposit("")
                }}
              >
                <Plus data-icon="inline-start" />
                Lend
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
