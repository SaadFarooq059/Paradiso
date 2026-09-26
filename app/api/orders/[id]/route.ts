import { advanceOrder, cancelOrder, recheckOrder } from "@/lib/server/order-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"

import { withSession } from "@/lib/server/guard"

export const dynamic = "force-dynamic"

// Next 16: dynamic route params arrive as a Promise and must be awaited.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withSession(async () => {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const action = typeof body?.action === "string" ? body.action : null

  switch (action) {
    case "cancel":
      return mutationResponse(await cancelOrder(id))
    case "recheck":
      return mutationResponse(await recheckOrder(id))
    case "start":
    case "ready":
    case "complete":
      return mutationResponse(await advanceOrder(id, action))
    default:
      return badRequest("Unknown order action.")
  }
  })
}
