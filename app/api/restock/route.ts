import { restockIngredient } from "@/lib/server/order-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"

import { withAdmin } from "@/lib/server/guard"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withAdmin(async () => {
  const body = await request.json().catch(() => null)
  const ingredient = typeof body?.ingredient === "string" ? body.ingredient : null
  const amount = Number.parseFloat(String(body?.amount))

  if (!ingredient) return badRequest("An ingredient is required.")
  if (!Number.isFinite(amount) || amount <= 0) return badRequest("Amount must be greater than zero.")

  return mutationResponse(await restockIngredient(ingredient, amount))
  })
}
