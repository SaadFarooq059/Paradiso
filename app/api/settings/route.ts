import { saveCalendarSettings } from "@/lib/server/admin-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"
import type { Weekday } from "@/lib/types"

import { withCapability } from "@/lib/server/guard"
import { CAPACITY_THRESHOLD, type WeddingCapacityStage } from "@/lib/weddings"

function isCapacityStage(value: unknown): value is WeddingCapacityStage {
  return typeof value === "string" && value in CAPACITY_THRESHOLD
}

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withCapability("settings:manage")(async (member) => {
  const body = await request.json().catch(() => null)
  if (!body) return badRequest("A settings body is required.")

  const blockedWeekdays = Array.isArray(body.blockedWeekdays)
    ? (body.blockedWeekdays.filter(
        (day: unknown) => Number.isInteger(day) && (day as number) >= 0 && (day as number) <= 6
      ) as Weekday[])
    : null
  const earliestCollectionTime =
    typeof body.earliestCollectionTime === "string" ? body.earliestCollectionTime : null
  const maxOrdersPerProductionDay = Number.parseInt(String(body.maxOrdersPerProductionDay), 10)
  const shopName = typeof body.shopName === "string" ? body.shopName.trim() : ""
  const shopAddress = typeof body.shopAddress === "string" ? body.shopAddress.trim() : ""
  const shopPhone = typeof body.shopPhone === "string" ? body.shopPhone.trim() : ""
  const weddingCapacityStage = isCapacityStage(body.weddingCapacityStage)
    ? body.weddingCapacityStage
    : null
  const weddingDepositPercent = Number.parseInt(String(body.weddingDepositPercent), 10)

  if (!blockedWeekdays) return badRequest("Blocked weekdays must be a list.")
  if (!earliestCollectionTime) return badRequest("An earliest collection time is required.")
  if (!Number.isFinite(maxOrdersPerProductionDay)) {
    return badRequest("Max orders per production day must be a number.")
  }
  // The shop's name appears in every customer email, so it cannot be blank.
  if (!shopName) return badRequest("A shop name is required.")
  if (!weddingCapacityStage) return badRequest("An unknown wedding capacity stage was given.")
  if (!Number.isFinite(weddingDepositPercent)) {
    return badRequest("The deposit percentage must be a number.")
  }

  return mutationResponse(
    await saveCalendarSettings({
      blockedWeekdays,
      earliestCollectionTime,
      maxOrdersPerProductionDay,
      shopName,
      shopAddress,
      shopPhone,
      weddingCapacityStage,
      weddingDepositPercent,
    }, member)
  )
  })
}
