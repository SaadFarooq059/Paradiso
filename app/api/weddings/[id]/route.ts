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
        const guestCount = Number.parseInt(String(body?.guestCount), 10)
        if (!Number.isFinite(guestCount) || guestCount < 1) {
          return badRequest("Guest count must be a positive whole number.")
        }

        // Hand-typed lines carry their own amount, so they are the one thing a
        // client can price. Keep them to whole pence with a real label, and drop
        // anything the browser echoed back that this endpoint prices itself.
        const adjustments: { label: string; amount: number }[] = []
        for (const raw of Array.isArray(body?.adjustments) ? body.adjustments : []) {
          if (raw?.kind) continue
          const label = typeof raw?.label === "string" ? raw.label.trim() : ""
          const amount = Number(raw?.amount)
          if (!label) return badRequest("Every adjustment needs a label.")
          if (!Number.isSafeInteger(amount)) {
            return badRequest("Adjustment amounts must be a whole number of pence.")
          }
          adjustments.push({ label, amount })
        }

        const extras: { extraId: string; quantity: number }[] = []
        for (const raw of Array.isArray(body?.extras) ? body.extras : []) {
          const extraId = typeof raw?.extraId === "string" ? raw.extraId : ""
          const quantity = Number(raw?.quantity)
          if (!extraId) return badRequest("An extra is missing its id.")
          if (!Number.isSafeInteger(quantity) || quantity < 1) {
            return badRequest("Extra quantities must be a positive whole number.")
          }
          extras.push({ extraId, quantity })
        }

        const rawMiles = body?.deliveryMiles
        let deliveryMiles: number | null = null
        if (rawMiles !== null && rawMiles !== undefined && rawMiles !== "") {
          const miles = Number(rawMiles)
          if (!Number.isFinite(miles) || miles <= 0) {
            return badRequest("Delivery distance must be a positive number of miles.")
          }
          deliveryMiles = miles
        }

        const stencil = typeof body?.stencil === "string" ? body.stencil.trim() || null : null
        return mutationResponse(
          await saveQuote(
            id,
            {
              packageId: typeof body?.packageId === "string" ? body.packageId : null,
              adjustments,
              guestCount,
              tiers,
              note: note ?? undefined,
              extras,
              deliveryMiles,
              stencil,
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
        const deposit = Number.parseInt(String(body?.depositAmount), 10)
        return mutationResponse(
          await saveLoan(
            id,
            item,
            Number.isFinite(quantity) ? quantity : 1,
            Number.isFinite(deposit) ? deposit : 0,
            member
          )
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
