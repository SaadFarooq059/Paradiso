import {
  advanceWedding,
  recordWeddingPayment,
  returnLoan,
  saveLoan,
  saveLogistics,
  saveQuote,
} from "@/lib/server/wedding-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"
import { withCapability } from "@/lib/server/guard"
import { WEDDING_STAGE_ORDER, type WeddingStage } from "@/lib/weddings"

export const dynamic = "force-dynamic"

function penceFrom(value: unknown): number | null {
  const amount = Number(value)
  return Number.isInteger(amount) && amount > 0 ? amount : null
}

// Next 16: dynamic route params arrive as a Promise and must be awaited.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withCapability("weddings:manage")(async (member) => {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const action = typeof body?.action === "string" ? body.action : null
    const note = typeof body?.note === "string" ? body.note : null

    switch (action) {
      case "quote": {
        const tiers = Array.isArray(body?.tiers) ? body.tiers : []
        const adjustments = Array.isArray(body?.adjustments) ? body.adjustments : []
        const guestCount = Number.parseInt(String(body?.guestCount), 10)
        if (!Number.isFinite(guestCount) || guestCount < 1) {
          return badRequest("Guest count must be a positive whole number.")
        }
        return mutationResponse(
          await saveQuote(
            id,
            {
              packageId: typeof body?.packageId === "string" ? body.packageId : null,
              adjustments,
              guestCount,
              tiers,
              note: note ?? undefined,
            },
            member
          )
        )
      }

      case "stage": {
        const stage = typeof body?.stage === "string" ? body.stage : ""
        if (!(WEDDING_STAGE_ORDER as string[]).includes(stage)) {
          return badRequest("Unknown wedding stage.")
        }
        return mutationResponse(await advanceWedding(id, stage as WeddingStage, member))
      }

      case "pay":
      case "refund": {
        const amount = penceFrom(body?.amount)
        if (amount === null) return badRequest("An amount in pence is required.")
        return mutationResponse(
          await recordWeddingPayment(id, amount, action === "pay" ? "Payment" : "Refund", member, note)
        )
      }

      case "logistics": {
        const staffRequired = Number.parseInt(String(body?.staffRequired), 10)
        const driversRequired = Number.parseInt(String(body?.driversRequired), 10)
        if (!Number.isFinite(staffRequired) || !Number.isFinite(driversRequired)) {
          return badRequest("Staff and driver counts must be numbers.")
        }
        return mutationResponse(await saveLogistics(id, staffRequired, driversRequired))
      }

      case "loan-out": {
        const item = typeof body?.item === "string" ? body.item : ""
        const quantity = Number.parseInt(String(body?.quantity), 10)
        return mutationResponse(
          await saveLoan(id, item, Number.isFinite(quantity) ? quantity : 1, member)
        )
      }

      case "loan-return": {
        const loanId = Number.parseInt(String(body?.loanId), 10)
        if (!Number.isFinite(loanId)) return badRequest("A loan id is required.")
        return mutationResponse(await returnLoan(loanId))
      }

      default:
        return badRequest("Unknown wedding action.")
    }
  })
}
