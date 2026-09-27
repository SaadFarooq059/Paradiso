"use client"

import { useState } from "react"
import { CalendarIcon, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { formatDateLong, UK_LOCALE } from "@/lib/format-date"
import { shopDayOf } from "@/lib/shop-time"

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Everything the client's Google Form asked for, in one place.
 *
 * The event date is sent as a plain shop day, not an instant — the same reason
 * a collection date is: an instant carries the browser's timezone to a server
 * that is not in it.
 */
export function WeddingEnquiryForm({
  onSubmit,
}: {
  onSubmit: (input: Record<string, unknown>) => void
}) {
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined)
  const [venue, setVenue] = useState("")
  const [guestCount, setGuestCount] = useState("")
  const [flavourNotes, setFlavourNotes] = useState("")
  const [dietaryRequirements, setDietaryRequirements] = useState("")
  const [notes, setNotes] = useState("")
  const [calendarOpen, setCalendarOpen] = useState(false)

  const guests = Number.parseInt(guestCount, 10)
  const isValid =
    customerName.trim().length > 0 &&
    EMAIL_SHAPE.test(customerEmail.trim()) &&
    !!eventDate &&
    venue.trim().length > 0 &&
    Number.isFinite(guests) &&
    guests > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !eventDate) return
    onSubmit({
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      eventDay: shopDayOf(eventDate),
      venue: venue.trim(),
      guestCount: guests,
      flavourNotes: flavourNotes.trim(),
      dietaryRequirements: dietaryRequirements.trim(),
      notes: notes.trim(),
    })
  }

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>New wedding enquiry</CardTitle>
        <CardDescription>
          Logging an enquiry holds nothing in the kitchen. It starts booking capacity at whatever
          stage Calendar Rules says — by default, once the deposit is paid.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup className="@3xl:grid @3xl:grid-cols-2 @3xl:items-start @3xl:gap-x-8">
            <Field>
              <FieldLabel htmlFor="w-name">Customer name</FieldLabel>
              <Input id="w-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="w-email">Email</FieldLabel>
              <Input
                id="w-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                aria-invalid={customerEmail.trim() !== "" && !EMAIL_SHAPE.test(customerEmail.trim())}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="w-phone">Phone (optional)</FieldLabel>
              <Input id="w-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="w-date">Event date</FieldLabel>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  render={
                    <Button id="w-date" type="button" variant="outline" className="w-full justify-start font-normal">
                      <CalendarIcon data-icon="inline-start" />
                      {eventDate ? formatDateLong(eventDate) : "Pick the event date"}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={UK_LOCALE}
                    selected={eventDate}
                    onSelect={(value) => {
                      setEventDate(value)
                      setCalendarOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
              <FieldDescription>
                Weddings are booked well ahead, so the usual lead-time rules aren&apos;t applied here —
                the kitchen check happens when it books capacity.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="w-venue">Venue</FieldLabel>
              <Input id="w-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="w-guests">Guest count</FieldLabel>
              <Input
                id="w-guests"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
              />
            </Field>

            <Field className="@3xl:col-span-2">
              <FieldLabel htmlFor="w-flavours">Flavours</FieldLabel>
              <Textarea
                id="w-flavours"
                rows={2}
                value={flavourNotes}
                onChange={(e) => setFlavourNotes(e.target.value)}
              />
            </Field>

            <Field className="@3xl:col-span-2">
              <FieldLabel htmlFor="w-dietary">Dietary requirements</FieldLabel>
              <Textarea
                id="w-dietary"
                rows={2}
                value={dietaryRequirements}
                onChange={(e) => setDietaryRequirements(e.target.value)}
              />
              <FieldDescription>
                Allergies and intolerances. Carried through to the kitchen with the order.
              </FieldDescription>
            </Field>

            <Field className="@3xl:col-span-2">
              <FieldLabel htmlFor="w-notes">Notes</FieldLabel>
              <Textarea id="w-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="@3xl:justify-end">
          <Button type="submit" disabled={!isValid} className="w-full @3xl:w-auto @3xl:px-8">
            <Send data-icon="inline-start" />
            Log enquiry
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
