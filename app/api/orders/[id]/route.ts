import {
  advanceOrder,
  cancelAndRefundOrder,
  cancelOrder,
  queryOrder,
  recheckOrder,
  recordPayment,
  recordRefund,
  resolveOrderQuery,
  scheduleOrder,
} from "@/lib/server/order-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"

import { FORBIDDEN, withSession } from "@/lib/server/guard"
import { can, ORDER_ACTION_CAPABILITY } from "@/lib/auth/roles"

export const dynamic = "force-dynamic"

/** Amounts cross the wire as integer pence, never as pounds. */
function penceFrom(value: unknown): number | null {
  const amount = Number(value)
  return Number.isInteger(amount) && amount > 0 ? amount : null
}

// Next 16: dynamic route params arrive as a Promise and must be awaited.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withSession(async (member) => {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const action = typeof body?.action === "string" ? body.action : null
    const note = typeof body?.note === "string" ? body.note : null

    // Every action names the capability it needs, and an action that names none
    // is refused. Failing closed matters more here than anywhere else in the
    // app: a new action added without a matching entry would otherwise be
    // available to every role the moment it shipped.
    const required = action ? ORDER_ACTION_CAPABILITY[action] : undefined
    if (!action || !required) return badRequest("Unknown order action.")
    if (!can(member.role, required)) return FORBIDDEN(required)

    switch (action) {
      // --- lifecycle ---------------------------------------------------------
      case "schedule":
        return mutationResponse(await scheduleOrder(id, member))
      case "start":
      case "ready":
      case "complete":
        return mutationResponse(await advanceOrder(id, action, member))
      case "recheck":
        return mutationResponse(await recheckOrder(id, member))
      case "query":
        return mutationResponse(await queryOrder(id, note, member))
      case "resolve":
        return mutationResponse(await resolveOrderQuery(id, member))
      case "cancel":
        return mutationResponse(await cancelOrder(id, member))

      // --- money -------------------------------------------------------------
      case "pay": {
        const amount = penceFrom(body?.amount)
        if (amount === null) return badRequest("A payment amount in pence is required.")
        return mutationResponse(await recordPayment(id, amount, member, note))
      }
      case "refund": {
        const amount = penceFrom(body?.amount)
        if (amount === null) return badRequest("A refund amount in pence is required.")
        return mutationResponse(await recordRefund(id, amount, member, note))
      }
      case "cancel-and-refund": {
        const amount = penceFrom(body?.amount)
        if (amount === null) return badRequest("A refund amount in pence is required.")
        return mutationResponse(await cancelAndRefundOrder(id, amount, member, note))
      }

      default:
        return badRequest("Unknown order action.")
    }
  })
}
