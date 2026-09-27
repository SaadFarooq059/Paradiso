import { deleteVariant } from "@/lib/server/admin-service"
import { mutationResponse } from "@/lib/server/respond"

import { withCapability } from "@/lib/server/guard"

export const dynamic = "force-dynamic"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withCapability("recipes:manage")(async () => {
    const { id } = await params
    return mutationResponse(await deleteVariant(id))
  })
}
