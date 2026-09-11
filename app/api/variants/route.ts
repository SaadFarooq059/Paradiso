import { saveVariant } from "@/lib/server/admin-service"
import { badRequest, mutationResponse } from "@/lib/server/respond"
import type { ProductVariant } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProductVariant | null
  if (!body?.id || !body.name) return badRequest("A product id and name are required.")
  return mutationResponse(await saveVariant({ ...body, requires: body.requires ?? {} }))
}
