import { saveStaffMember } from "@/lib/server/admin-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"
import type { StaffMember } from "@/lib/types"

import { withAdmin } from "@/lib/server/guard"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withAdmin(async () => {
  const body = (await request.json().catch(() => null)) as StaffMember | null
  if (!body?.id || !body.name) return badRequest("A staff id and name are required.")
  return mutationResponse(
    await saveStaffMember({
      id: body.id,
      name: body.name,
      role: body.role === "admin" ? "admin" : "staff",
      orderCount: Number.isFinite(body.orderCount) ? body.orderCount : 0,
    })
  )
  })
}
