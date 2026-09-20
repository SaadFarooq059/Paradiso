import { resetDemoData } from "@/lib/server/admin-service"
import { mutationResponse } from "@/lib/server/respond"

export const dynamic = "force-dynamic"

export async function POST() {
  return mutationResponse(await resetDemoData())
}
