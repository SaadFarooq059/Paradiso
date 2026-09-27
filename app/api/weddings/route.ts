import { createEnquiry } from "@/lib/server/wedding-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"
import { withCapability } from "@/lib/server/guard"
import { isShopDay } from "@/lib/shop-time"

export const dynamic = "force-dynamic"

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Logs a wedding enquiry. The customer is the same Customer an order uses. */
export async function POST(request: Request) {
  return withCapability("weddings:manage")(async (member) => {
    const body = await request.json().catch(() => null)
    const name = typeof body?.customerName === "string" ? body.customerName.trim() : ""
    const email = typeof body?.customerEmail === "string" ? body.customerEmail.trim() : ""
    const phone = typeof body?.customerPhone === "string" ? body.customerPhone.trim() : ""
    // A shop day, for the same reason a collection date is: an instant would
    // carry the browser's timezone into the record.
    const eventDay = typeof body?.eventDay === "string" ? body.eventDay : ""
    const venue = typeof body?.venue === "string" ? body.venue.trim() : ""
    const guestCount = Number.parseInt(String(body?.guestCount), 10)

    if (!name) return badRequest("A customer name is required.")
    if (!EMAIL_SHAPE.test(email)) return badRequest("A valid customer email is required.")
    if (!isShopDay(eventDay)) return badRequest("A valid event date (yyyy-mm-dd) is required.")
    if (!venue) return badRequest("A venue is required.")
    if (!Number.isFinite(guestCount) || guestCount < 1) {
      return badRequest("Guest count must be a positive whole number.")
    }

    return mutationResponse(
      await createEnquiry(
        {
          customer: { name, email, phone: phone || null },
          eventDay,
          venue,
          guestCount,
          flavourNotes: typeof body?.flavourNotes === "string" ? body.flavourNotes : "",
          dietaryRequirements:
            typeof body?.dietaryRequirements === "string" ? body.dietaryRequirements : "",
          notes: typeof body?.notes === "string" ? body.notes : "",
        },
        member
      )
    )
  })
}
