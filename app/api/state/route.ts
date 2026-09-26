import { NextResponse } from "next/server"

import { loadDashboardState } from "@/lib/server/state"

// Always read through to SQLite: this data changes on every mutation and must
// never be served from a cached render.
import { withSession } from "@/lib/server/guard"

export const dynamic = "force-dynamic"

export async function GET() {
  return withSession(async () => NextResponse.json(await loadDashboardState()))
}
