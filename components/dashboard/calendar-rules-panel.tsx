"use client"

import { useEffect, useState } from "react"
import { CalendarCog, HeartHandshake, Store } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CAPACITY_STAGE_LABEL,
  CAPACITY_STAGE_SUMMARY,
  type WeddingCapacityStage,
} from "@/lib/weddings"
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
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full @4xl:max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCog className="size-4 shrink-0 text-muted-foreground" />
            Calendar rules
          </CardTitle>
          <CardDescription>
            These decide which collection dates customers can be offered. The New Order date picker
            greys out anything they rule out, and an order is refused if it breaks one — so a change
            here takes effect on the very next order.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup className="@3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @3xl:items-start @3xl:gap-8">
            <Field>
              <FieldLabel>Days closed for collection</FieldLabel>
              {/* Seven fixed tracks: the week reads as a week, never 6 + 1 wrapped. */}
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((day) => {
                  const isBlocked = blocked.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      role="switch"
                      aria-checked={isBlocked}
                      aria-label={day.label}
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        "min-w-16 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        isBlocked
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:bg-muted/40"
                      )}
                    >
                      {day.short}
                    </button>
                  )
                })}
              </div>
              <FieldDescription>
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

            <div className="grid gap-4 @sm:grid-cols-2 @3xl:grid-cols-1">
              <Field>
                <FieldLabel htmlFor="earliest-collection">Earliest collection time</FieldLabel>
                <Input
                  id="earliest-collection"
                  type="time"
                  value={earliest}
                  onChange={(e) => setEarliest(e.target.value)}
                  aria-invalid={!timeIsValid}
                />
                <FieldDescription>
                  Stamped onto every order&apos;s collection date. 24-hour, e.g. 10:30.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="max-orders">Max orders per production day</FieldLabel>
                <Input
                  id="max-orders"
                  type="number"
                  min={1}
                  step={1}
                  value={maxOrders}
                  onChange={(e) => setMaxOrders(e.target.value)}
                  aria-invalid={!maxIsValid}
                />
                <FieldDescription>
                  Counted by production day, not collection day — a cake with a long lead time is
                  made well before it is picked up.
                </FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>

      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="size-4 shrink-0 text-muted-foreground" />
            Weddings and bespoke orders
          </CardTitle>
          <CardDescription>
            When a wedding starts holding ingredients and production capacity, and what deposit is
            asked for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="@3xl:grid @3xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @3xl:items-start @3xl:gap-8">
            <Field>
              <FieldLabel htmlFor="capacity-stage">Books the kitchen</FieldLabel>
              <Select
                value={capacityStage}
                onValueChange={(value) => setCapacityStage(value as WeddingCapacityStage)}
              >
                <SelectTrigger id="capacity-stage" className="w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      value ? CAPACITY_STAGE_LABEL[value as WeddingCapacityStage] : "Choose a stage"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CAPACITY_STAGE_LABEL) as WeddingCapacityStage[]).map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {CAPACITY_STAGE_LABEL[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <Field>
              <FieldLabel htmlFor="deposit-percent">Deposit</FieldLabel>
              <Input
                id="deposit-percent"
                type="number"
                min={0}
                max={100}
                step={1}
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                aria-invalid={!depositIsValid}
              />
              <FieldDescription>
                Percentage of the quoted total.{" "}
                <strong className="font-medium text-foreground">Placeholder</strong> — the client
                hasn&apos;t given us their real figure.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Separate card: these are not scheduling rules, they are what the shop
          calls itself in the messages it sends. Here rather than hardcoded in a
          template so changing the phone number does not need a deploy. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-4 shrink-0 text-muted-foreground" />
            Shop details
          </CardTitle>
          <CardDescription>
            Used in the confirmation, reminder and collection emails customers receive. Nothing is
            sent yet — the messages are rendered and logged on each order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="@3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @3xl:items-start @3xl:gap-8">
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
              <Input
                id="shop-phone"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
              />
              <FieldDescription>Given to customers who need to change an order.</FieldDescription>
            </Field>

            <Field className="@3xl:col-span-2">
              <FieldLabel htmlFor="shop-address">Collection address</FieldLabel>
              <Textarea
                id="shop-address"
                rows={2}
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
              />
              <FieldDescription>
                Where customers come to collect. Included in the ready-for-collection email.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Below both cards, because one submit saves both. Inside the first one
          it read as though it only applied to the calendar rules. */}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={!isValid}>
          Save settings
        </Button>
      </div>
    </form>
  )
}
