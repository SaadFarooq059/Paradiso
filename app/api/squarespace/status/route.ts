import { NextResponse } from "next/server"

import { withCapability } from "@/lib/server/guard"
import { squarespaceStatus } from "@/lib/squarespace/sync"

export const dynamic = "force-dynamic"

/** What the Squarespace screen shows: when the shop was last checked, and every line it has seen. */
export async function GET() {
  return withCapability("squarespace:sync")(async () => NextResponse.json(await squarespaceStatus()))
}
