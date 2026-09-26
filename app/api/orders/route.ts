import { createOrder } from "@/lib/server/order-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"

import { withSession } from "@/lib/server/guard"

export const dynamic = "force-dynamic"

/** Deliberately permissive — enough to catch a typo, not to police addresses. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  return withSession(async (member) => {
  const body = await request.json().catch(() => null)
  const productId = typeof body?.productId === "string" ? body.productId : null
  const quantity = Number.parseInt(String(body?.quantity), 10)
  const collectionDate = body?.collectionDate ? new Date(body.collectionDate) : null
  const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : ""
  const customerEmail = typeof body?.customerEmail === "string" ? body.customerEmail.trim() : ""
  const customerPhone = typeof body?.customerPhone === "string" ? body.customerPhone.trim() : ""

  if (!productId) return badRequest("A product is required.")
  if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Quantity must be a positive whole number.")
  if (!collectionDate || Number.isNaN(collectionDate.getTime())) return badRequest("A valid collection date is required.")
  // Required, because an order with no customer has nobody to confirm to and
  // nowhere to send the messages the status changes trigger.
  if (!customerName) return badRequest("A customer name is required.")
  if (!EMAIL_SHAPE.test(customerEmail)) return badRequest("A valid customer email is required.")

  return mutationResponse(
    await createOrder(
      productId,
      quantity,
      collectionDate,
      { name: customerName, email: customerEmail, phone: customerPhone || null },
      member
    )
  )
  })
}
