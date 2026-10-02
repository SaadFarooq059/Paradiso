"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { CalendarIcon, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ProductArt } from "@/components/dashboard/product-art"
import { INGREDIENT_INFO, INGREDIENT_ORDER } from "@/lib/mock-data"
import { formatMoney } from "@/lib/payments"
import { formatDateLong, UK_LOCALE } from "@/lib/format-date"
import { isCollectionDateSelectable } from "@/lib/production-schedule"
import type { CalendarSettings, Order, ProductVariant } from "@/lib/types"
import { cn } from "@/lib/utils"

interface NewOrderFormProps {
  variants: ProductVariant[]
  /** Existing orders — needed to know which production days are already full. */
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  settings: CalendarSettings
  /** Collection date pre-chosen elsewhere (picking a day on the calendar). */
  initialDate?: Date | null
  /** Called once the initial date has been taken, so it is applied only once. */
  onInitialDateApplied?: () => void
  onSubmit: (
    productId: string,
    quantity: number,
    collectionDate: Date,
    customer: { name: string; email: string; phone: string }
  ) => void
}

/** Permissive on purpose — catches a typo, does not try to police addresses. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function NewOrderForm({
  variants,
  orders,
  variantsById,
  settings,
  initialDate,
  onInitialDateApplied,
  onSubmit,
}: NewOrderFormProps) {
  const quantityId = useId()
  const [productId, setProductId] = useState<string>(variants[0]?.id ?? "")
  const [quantity, setQuantity] = useState("1")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")

  // Recipes can be added/edited/removed from the Recipes screen while this form is mounted —
  // fall back to the first available variant if the selected one disappears.
  useEffect(() => {
    if (!variants.some((variant) => variant.id === productId)) {
      setProductId(variants[0]?.id ?? "")
    }
  }, [variants, productId])

  const parsedQuantity = Number.parseInt(quantity, 10)
  const selectedVariant = variants.find((variant) => variant.id === productId)

  // The same rules the server enforces, applied here so unavailable days are
  // visibly greyed out rather than accepted and then rejected.
  const availability = useMemo(
    () =>
      selectedVariant
        ? { variant: selectedVariant, settings, orders, variantsById }
        : null,
    [selectedVariant, settings, orders, variantsById]
  )

  const isDayUnavailable = useCallback(
    (day: Date) => (availability ? !isCollectionDateSelectable(day, availability) : true),
    [availability]
  )

  // A date picked on the calendar is only a shortcut: adopt it, then let the
  // rules below judge it exactly as if it had been chosen here. If the selected
  // product can't be made for that day it is cleared like any other illegal date.
  useEffect(() => {
    if (!initialDate) return
    setDate(initialDate)
    onInitialDateApplied?.()
  }, [initialDate, onInitialDateApplied])

  // Lead times differ per product, so a date that was fine for Grande can be
  // inside Suprema's lead time. Switching product must not silently leave an
  // illegal date selected.
  useEffect(() => {
    if (date && availability && !isCollectionDateSelectable(date, availability)) {
      setDate(undefined)
    }
  }, [date, availability])

  // The customer is required: a confirmed order with nobody attached has nowhere
  // to send the confirmation, and every message downstream is addressed from here.
  const emailIsValid = EMAIL_SHAPE.test(customerEmail.trim())
  const isValid =
    productId &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    !!date &&
    customerName.trim().length > 0 &&
    emailIsValid

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !date) return
    onSubmit(productId, parsedQuantity, date, {
      name: customerName.trim(),
      email: customerEmail.trim(),
      phone: customerPhone.trim(),
    })
    setQuantity("1")
    setDate(undefined)
    setCustomerName("")
    setCustomerEmail("")
    setCustomerPhone("")
  }

  if (variants.length === 0) {
    return (
      <Card className="w-full">
        <CardContent>
          <Empty>
            <EmptyTitle>No product recipes yet</EmptyTitle>
            <EmptyDescription>Add a product in Recipes before scheduling an order.</EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>New Order</CardTitle>
        <CardDescription>
          Takes the order and confirms it with the customer. It does not book the kitchen yet —
          stock is checked when you schedule it from the order&apos;s detail screen, so a confirmed
          order holds no ingredients until then.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup className="@3xl:grid @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @3xl:items-start @3xl:gap-8 @6xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)]">
            <Field className="@3xl:col-start-1 @3xl:row-span-2 @6xl:row-span-1">
              <FieldLabel>Product variant</FieldLabel>
              <div role="radiogroup" aria-label="Product variant" className="grid gap-3 @sm:grid-cols-3">
                {variants.map((variant) => {
                  const selected = variant.id === productId
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setProductId(variant.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all",
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/30 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex size-20 items-center justify-center rounded-lg bg-gradient-to-b from-muted to-muted/30">
                        <ProductArt productId={variant.id} className="size-16" />
                      </div>
                      <span className="text-sm leading-tight font-medium text-foreground">
                        {variant.name}
                      </span>
                      <span className="text-xs leading-tight text-muted-foreground">
                        {variant.servings}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid gap-4 @sm:grid-cols-2 @3xl:col-start-2 @3xl:row-start-1 @3xl:grid-cols-1">
              <Field className="@sm:col-span-2 @3xl:col-span-1">
                <FieldLabel htmlFor="customer-name">Customer name</FieldLabel>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  autoComplete="off"
                />
              </Field>

              <Field className="@sm:col-span-2 @3xl:col-span-1">
                <FieldLabel htmlFor="customer-email">Customer email</FieldLabel>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  aria-invalid={customerEmail.trim() !== "" && !emailIsValid}
                  autoComplete="off"
                />
                <FieldDescription>
                  Where the confirmation and collection messages go. Nothing is sent yet — each
                  message is rendered and logged on the order.
                </FieldDescription>
              </Field>

              <Field className="@sm:col-span-2 @3xl:col-span-1">
                <FieldLabel htmlFor="customer-phone">Phone (optional)</FieldLabel>
                <Input
                  id="customer-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  autoComplete="off"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor={quantityId}>Quantity</FieldLabel>
                <Input
                  id={quantityId}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="collection-date">Collection date</FieldLabel>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        id="collection-date"
                        type="button"
                        variant="outline"
                        className="w-full justify-start font-normal"
                      >
                        <CalendarIcon data-icon="inline-start" />
                        {date ? formatDateLong(date) : "Pick a collection date"}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      locale={UK_LOCALE}
                      selected={date}
                      onSelect={(value) => {
                        setDate(value)
                        setCalendarOpen(false)
                      }}
                      disabled={isDayUnavailable}
                    />
                  </PopoverContent>
                </Popover>
                {selectedVariant && (
                  <FieldDescription>
                    {selectedVariant.name} needs {selectedVariant.leadTimeDays}{" "}
                    {selectedVariant.leadTimeDays === 1 ? "day" : "days"} in production, so earlier
                    dates are greyed out. Collection from {settings.earliestCollectionTime}.
                  </FieldDescription>
                )}
              </Field>
            </div>

            {selectedVariant && (
              <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-4 @3xl:col-start-2 @3xl:row-start-2 @6xl:col-start-3 @6xl:row-start-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{selectedVariant.name}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatMoney(selectedVariant.priceAmount)}
                  </span>
                </div>
                {selectedVariant.priceEstimated && (
                  // The order total is worked out from this and frozen when the
                  // order is taken, so the one moment that matters is before it
                  // is agreed — not on a screen nobody opens mid-call.
                  <p className="text-xs font-medium text-warning">
                    Estimated price, pending the client&apos;s confirmation. Check before quoting
                    it.
                  </p>
                )}
                <FieldDescription>
                  {selectedVariant.description} One batch makes {selectedVariant.unitsPerBatch}{" "}
                  {selectedVariant.unitsPerBatch === 1 ? "cake" : "cakes"} and draws:
                </FieldDescription>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {INGREDIENT_ORDER.filter((key) => selectedVariant.requires[key]).map((key) => (
                    <Badge key={key} variant="secondary" className="font-normal">
                      {selectedVariant.requires[key]}
                      {INGREDIENT_INFO[key].unit} {INGREDIENT_INFO[key].label.toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="@3xl:justify-end">
          <Button type="submit" disabled={!isValid} className="w-full @3xl:w-auto @3xl:px-8">
            <Send data-icon="inline-start" />
            Confirm order
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
