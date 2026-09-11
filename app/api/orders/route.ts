import { createOrder } from "@/lib/server/order-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const productId = typeof body?.productId === "string" ? body.productId : null
  const quantity = Number.parseInt(String(body?.quantity), 10)
  const collectionDate = body?.collectionDate ? new Date(body.collectionDate) : null

  if (!productId) return badRequest("A product is required.")
  if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Quantity must be a positive whole number.")
  if (!collectionDate || Number.isNaN(collectionDate.getTime())) return badRequest("A valid collection date is required.")

  return mutationResponse(await createOrder(productId, quantity, collectionDate))
}
