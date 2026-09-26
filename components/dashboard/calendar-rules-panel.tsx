"use client"

import { useEffect, useState } from "react"
import { CalendarCog } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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

  // Adopt whatever the server last confirmed, so a save (or another admin's
  // change arriving with a refresh) is reflected rather than silently overwritten
  // by a stale form.
  useEffect(() => {
    setBlocked(settings.blockedWeekdays)
    setEarliest(settings.earliestCollectionTime)
    setMaxOrders(String(settings.maxOrdersPerProductionDay))
  }, [settings])

  const parsedMax = Number.parseInt(maxOrders, 10)
  const timeIsValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(earliest)
  const maxIsValid = Number.isFinite(parsedMax) && parsedMax >= 1
  // Blocking every day would leave no collection date selectable anywhere.
  const daysAreValid = blocked.length < 7
  const isValid = timeIsValid && maxIsValid && daysAreValid

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
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
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
          <FieldGroup>
            <Field>
              <FieldLabel>Days closed for collection</FieldLabel>
              <div className="flex flex-wrap gap-2">
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

            <div className="grid gap-4 @sm:grid-cols-2">
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

        <CardFooter>
          <Button type="submit" disabled={!isValid}>
            Save calendar rules
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
