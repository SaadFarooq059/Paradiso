import { deleteVariant } from "@/lib/server/admin-service"
import { mutationResponse } from "@/lib/server/respond"

export const dynamic = "force-dynamic"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return mutationResponse(await deleteVariant(id))
}
