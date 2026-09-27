import { NextResponse } from "next/server"

import { loadDashboardState } from "@/lib/server/state"

// Always read through to SQLite: this data changes on every mutation and must
// never be served from a cached render.
import { withSession } from "@/lib/server/guard"
import { redactStateFor } from "@/lib/server/redact"

export const dynamic = "force-dynamic"

export async function GET() {
  // Redacted per role on the way out, not hidden on the way in. The Kitchen
  // screen is never sent a customer's phone number in the first place.
  return withSession(async (member) =>
    NextResponse.json(redactStateFor(member.role, await loadDashboardState()))
  )
}
