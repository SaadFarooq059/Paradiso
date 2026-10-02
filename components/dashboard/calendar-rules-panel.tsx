"use client"

import { useEffect, useState } from "react"
import { CalendarCog, Check, HeartHandshake, Store, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import {
  CAPACITY_STAGE_LABEL,
  CAPACITY_STAGE_SUMMARY,
  type WeddingCapacityStage,
} from "@/lib/weddings"
import { formatMoney } from "@/lib/payments"
import { SHOP_TIME_ZONE, addShopDays, shopMoment, shopWeekdayOf, todayShopDay } from "@/lib/shop-time"
import type { CalendarSettings, Weekday } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CalendarRulesPanelProps {
  settings: CalendarSettings
  onSave: (settings: CalendarSettings) => void
}

/**
 * Monday first, matching the UK calendars everywhere else in the app. The value
 * is JavaScript's getDay() numbering, where Sunday is 0 — which is why the list
 * is not simply 0..6 in order.
 */
const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
]

export function CalendarRulesPanel({ settings, onSave }: CalendarRulesPanelProps) {
  const [blocked, setBlocked] = useState<Weekday[]>(settings.blockedWeekdays)
  const [earliest, setEarliest] = useState(settings.earliestCollectionTime)
  const [maxOrders, setMaxOrders] = useState(String(settings.maxOrdersPerProductionDay))
  const [shopName, setShopName] = useState(settings.shopName)
  const [shopAddress, setShopAddress] = useState(settings.shopAddress)
  const [shopPhone, setShopPhone] = useState(settings.shopPhone)
  const [capacityStage, setCapacityStage] = useState<WeddingCapacityStage>(
    settings.weddingCapacityStage
  )
  const [depositPercent, setDepositPercent] = useState(String(settings.weddingDepositPercent))

  // Adopt whatever the server last confirmed, so a save (or another admin's
  // change arriving with a refresh) is reflected rather than silently overwritten
  // by a stale form.
  useEffect(() => {
    setBlocked(settings.blockedWeekdays)
    setEarliest(settings.earliestCollectionTime)
    setMaxOrders(String(settings.maxOrdersPerProductionDay))
    setShopName(settings.shopName)
    setShopAddress(settings.shopAddress)
    setShopPhone(settings.shopPhone)
    setCapacityStage(settings.weddingCapacityStage)
    setDepositPercent(String(settings.weddingDepositPercent))
  }, [settings])

  const parsedMax = Number.parseInt(maxOrders, 10)
  const timeIsValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(earliest)
  const maxIsValid = Number.isFinite(parsedMax) && parsedMax >= 1
  // Blocking every day would leave no collection date selectable anywhere.
  const daysAreValid = blocked.length < 7
  // The shop's name goes out in every customer email, so it cannot be blank.
  const nameIsValid = shopName.trim().length > 0
  const parsedDeposit = Number.parseInt(depositPercent, 10)
  const depositIsValid = Number.isFinite(parsedDeposit) && parsedDeposit >= 0 && parsedDeposit <= 100
  const stageChanged = capacityStage !== settings.weddingCapacityStage
  const isDirty =
    stageChanged ||
    [...blocked].sort().join() !== [...settings.blockedWeekdays].sort().join() ||
    earliest !== settings.earliestCollectionTime ||
    maxOrders !== String(settings.maxOrdersPerProductionDay) ||
    shopName !== settings.shopName ||
    shopAddress !== settings.shopAddress ||
    shopPhone !== settings.shopPhone ||
    depositPercent !== String(settings.weddingDepositPercent)

  function discard() {
    setBlocked(settings.blockedWeekdays)
    setEarliest(settings.earliestCollectionTime)
    setMaxOrders(String(settings.maxOrdersPerProductionDay))
    setShopName(settings.shopName)
    setShopAddress(settings.shopAddress)
    setShopPhone(settings.shopPhone)
    setCapacityStage(settings.weddingCapacityStage)
    setDepositPercent(String(settings.weddingDepositPercent))
  }
  const isValid = timeIsValid && maxIsValid && daysAreValid && nameIsValid && depositIsValid

  function toggleDay(day: Weekday) {
    setBlocked((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onSave({
      blockedWeekdays: [...blocked].sort((a, b) => a - b),
      earliestCollectionTime: earliest,
      maxOrdersPerProductionDay: parsedMax,
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim(),
      shopPhone: shopPhone.trim(),
      weddingCapacityStage: capacityStage,
      weddingDepositPercent: parsedDeposit,
      // Carried through unchanged: these are the client's terms, edited on the
      // shop's own screens rather than buried in the calendar rules form.
      shopEmail: settings.shopEmail,
      shopOpeningHours: settings.shopOpeningHours,
      weddingBalanceDueDaysBefore: settings.weddingBalanceDueDaysBefore,
      weddingQuoteTurnaround: settings.weddingQuoteTurnaround,
      deliveryPerMile: settings.deliveryPerMile,
      deliveryMaxMiles: settings.deliveryMaxMiles,
      deliveryMinimumOrder: settings.deliveryMinimumOrder,
      loanReturnDays: settings.loanReturnDays,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <Section
        icon={CalendarCog}
        title="Collection days"
        description="Which collection dates customers can be offered. The New Order date picker greys out anything these rule out, and an order that breaks one is refused — so a change takes effect on the very next order."
      >
        <Field>
          <FieldLabel>Open for collection</FieldLabel>
          {/* Seven fixed tracks: the week reads as a week, never 6 + 1 wrapped. */}
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((day) => {
              const isBlocked = blocked.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  role="switch"
                  aria-checked={!isBlocked}
                  aria-label={`${day.label}: ${isBlocked ? "closed" : "open"}`}
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isBlocked
                      ? "border-dashed border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                      : "border-success/40 bg-success/10 text-foreground hover:bg-success/15"
                  )}
                >
                  {day.short}
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-[0.65rem] font-normal",
                      isBlocked ? "text-muted-foreground" : "text-success"
                    )}
                  >
                    {isBlocked ? <X className="size-3" aria-hidden="true" /> : <Check className="size-3" aria-hidden="true" />}
                    {isBlocked ? "Closed" : "Open"}
                  </span>
                </button>
              )
            })}
          </div>
          <FieldDescription>
            Tap a day to open or close it.{" "}
            {blocked.length === 0
              ? "Open every day."
              : `Closed on ${WEEKDAYS.filter((d) => blocked.includes(d.value))
                  .map((d) => d.label)
                  .join(", ")}.`}
          </FieldDescription>
          {!daysAreValid && (
            <FieldDescription className="text-destructive">
              At least one day has to stay open, or nothing could ever be collected.
            </FieldDescription>
          )}
        </Field>

        <NextTwoWeeks blocked={blocked} />

        <div className="grid gap-4 @lg:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="earliest-collection">Earliest collection time</FieldLabel>
            <Input
              id="earliest-collection"
              type="time"
              value={earliest}
              onChange={(e) => setEarliest(e.target.value)}
              aria-invalid={!timeIsValid}
            />
            <FieldDescription>Stamped onto every order&apos;s collection date. 24-hour.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="max-orders">Production limit</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="max-orders"
                type="number"
                min={1}
                step={1}
                value={maxOrders}
                onChange={(e) => setMaxOrders(e.target.value)}
                aria-invalid={!maxIsValid}
                className="font-mono tabular-nums"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>orders / day</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Counted by production day, not collection day — a cake with a long lead time is made
              well before it is picked up.
            </FieldDescription>
          </Field>
        </div>
      </Section>

      <Section
        icon={HeartHandshake}
        title="Weddings"
        description="When a wedding starts holding ingredients and kitchen capacity, and what deposit is asked for."
      >
        <Field>
          <FieldLabel id="capacity-stage-label">Book the kitchen</FieldLabel>
          {/* Laid along the pipeline, because that is what the choice is: how far
              along a wedding gets before it reserves anything. */}
          <div role="radiogroup" aria-labelledby="capacity-stage-label" className="grid gap-2 @lg:grid-cols-3">
            {CAPACITY_STAGES.map(({ stage, tag }, i) => {
              const selected = capacityStage === stage
              return (
                <button
                  key={stage}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCapacityStage(stage)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                    )}
                  >
                    {selected ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{CAPACITY_STAGE_LABEL[stage]}</span>
                    <span className="text-xs text-muted-foreground">{tag}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <FieldDescription>{CAPACITY_STAGE_SUMMARY[capacityStage]}</FieldDescription>
          {stageChanged && (
            // Said before saving, not after: this decides whether existing
            // weddings gain or keep capacity, and nobody should discover
            // that from a toast.
            <div className="mt-1 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">What happens on save: </span>
              weddings already holding capacity <span className="font-medium text-foreground">keep it</span>,
              whatever this becomes — freeing ingredients the kitchen has promised would strand
              the demand silently. Weddings that now qualify are booked if the stock allows, and
              any that don&apos;t fit are named rather than skipped quietly.
            </div>
          )}
        </Field>

        <Field className="@lg:max-w-xs">
          <FieldLabel htmlFor="deposit-percent">Deposit</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="deposit-percent"
              type="number"
              min={0}
              max={100}
              step={1}
              value={depositPercent}
              onChange={(e) => setDepositPercent(e.target.value)}
              aria-invalid={!depositIsValid}
              className="font-mono tabular-nums"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>% of quote</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>
            {depositIsValid && `On a £500 quote that is ${formatMoney(Math.round(50000 * parsedDeposit / 100))}. `}
            <strong className="font-medium text-foreground">Placeholder</strong> — the client
            hasn&apos;t given us their real figure.
          </FieldDescription>
        </Field>
      </Section>

      {/* These are not scheduling rules, they are what the shop calls itself in
          the messages it sends. Here rather than hardcoded in a template so
          changing the phone number does not need a deploy. */}
      <Section
        icon={Store}
        title="Shop details"
        description="Used in the confirmation, reminder and collection emails customers receive. Nothing is sent yet — the messages are rendered and logged on each order."
      >
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="shop-name">Shop name</FieldLabel>
            <Input
              id="shop-name"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              aria-invalid={!nameIsValid}
            />
            <FieldDescription>Appears as the sender and in every message body.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="shop-phone">Phone</FieldLabel>
            <Input id="shop-phone" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
            <FieldDescription>Given to customers who need to change an order.</FieldDescription>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="shop-address">Collection address</FieldLabel>
          <Textarea
            id="shop-address"
            rows={2}
            value={shopAddress}
            onChange={(e) => setShopAddress(e.target.value)}
          />
          <FieldDescription>Where customers come to collect. Included in the ready-for-collection email.</FieldDescription>
        </Field>
      </Section>

      {/* One submit saves every section, so it sits outside all of them — and
          stays in view, since the page is longer than a screen. */}
      <div
        className={cn(
          "sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-md transition-colors",
          isDirty ? "border-primary/40 bg-card" : "border-border bg-card"
        )}
      >
        <span className={cn("text-sm", isDirty ? "font-medium text-foreground" : "text-muted-foreground")} aria-live="polite">
          {isDirty ? (isValid ? "You have unsaved changes." : "Fix the highlighted fields to save.") : "All changes saved."}
        </span>
        <div className="flex gap-2">
          {isDirty && (
            <Button type="button" variant="ghost" onClick={discard}>
              Discard
            </Button>
          )}
          <Button type="submit" disabled={!isValid || !isDirty}>
            Save settings
          </Button>
        </div>
      </div>
    </form>
  )
}

const CAPACITY_STAGES: { stage: WeddingCapacityStage; tag: string }[] = [
  { stage: "AtQuote", tag: "Earliest — safest for the kitchen" },
  { stage: "AtDeposit", tag: "Recommended — money has changed hands" },
  { stage: "AtConfirmation", tag: "Latest — risks over-promising" },
]

/** A settings section: what it is on the left, the fields on the right. */
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="grid gap-6 @3xl:grid-cols-[16rem_minmax(0,1fr)] @3xl:gap-10">
        <CardHeader className="content-start self-start px-0">
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-muted">
              <Icon className="size-4 text-muted-foreground" />
            </span>
            {title}
          </CardTitle>
          <CardDescription className="leading-relaxed">{description}</CardDescription>
        </CardHeader>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  )
}

const PREVIEW_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, day: "numeric" })
const PREVIEW_WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TIME_ZONE, weekday: "narrow" })

/**
 * The rule made concrete: the next fortnight as customers will see it. Only the
 * closed-day rule is shown — each product's lead time pushes its own earliest
 * date further out on top of this.
 */
function NextTwoWeeks({ blocked }: { blocked: Weekday[] }) {
  const today = todayShopDay()
  const days = Array.from({ length: 14 }, (_, i) => addShopDays(today, i))
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Next two weeks</span>
      <div className="grid grid-cols-7 gap-1 @lg:grid-cols-14">
        {days.map((day) => {
          const closed = blocked.includes(shopWeekdayOf(day) as Weekday)
          const moment = shopMoment(day, "12:00")
          return (
            <div
              key={day}
              className={cn(
                "flex flex-col items-center rounded-md py-1 text-center",
                closed ? "bg-muted/40 text-muted-foreground/60 line-through" : "bg-success/10 text-foreground",
                day === today && "ring-1 ring-primary"
              )}
              title={closed ? "Closed for collection" : "Open for collection"}
            >
              <span className="text-[0.6rem] uppercase">{PREVIEW_WEEKDAY.format(moment)}</span>
              <span className="font-mono text-xs tabular-nums">{PREVIEW_DAY.format(moment)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
