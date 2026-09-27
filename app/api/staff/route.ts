import { saveStaffMember } from "@/lib/server/admin-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"
import type { StaffMember } from "@/lib/types"

import { withCapability } from "@/lib/server/guard"
import { isStaffRole } from "@/lib/auth/roles"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withCapability("staff:manage")(async () => {
  const body = (await request.json().catch(() => null)) as (StaffMember & { password?: string }) | null
  if (!body?.id || !body.name) return badRequest("A staff id and name are required.")
  return mutationResponse(
    await saveStaffMember({
      id: body.id,
      name: body.name,
      // Anything unrecognised gets the least privilege, never the most.
      role: isStaffRole(body.role) ? body.role : "ShopFloor",
      orderCount: Number.isFinite(body.orderCount) ? body.orderCount : 0,
      email: typeof body.email === "string" ? body.email : "",
      active: body.active ?? true,
    },
    typeof body.password === "string" ? body.password : undefined)
  )
  })
}
