import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { withCapability } from "@/lib/server/guard"
import { importEnabled, runSquarespaceSync, type SyncOutcome } from "@/lib/squarespace/sync"

export const dynamic = "force-dynamic"
// The first run reads 60 days at one request a second, plus the writes — well inside this.
export const maxDuration = 60

/**
 * Pulls new Squarespace orders into the portal.
 *
 * Off unless SQUARESPACE_IMPORT_ENABLED is "true", so deploying this code
 * changes nothing until someone deliberately switches it on — and switching it
 * off again is one environment variable, no deploy of code.
 *
 * Two ways in:
 *  - GET with `Authorization: Bearer $CRON_SECRET`, which is how Vercel Cron
 *    runs it once a day; and
 *  - POST from a signed-in Admin or Manager: `{ "mode": "auto" }` from an open
 *    dashboard (skipped if the shop was checked in the last ten minutes), or
 *    `{ "mode": "now" }` from the Check now button.
 *
 * With CRON_SECRET unset the scheduled path does not exist, rather than falling
 * back to "no secret needed".
 *
 * The response carries order numbers and product names only — no customers.
 */

const DISABLED = () =>
  NextResponse.json(
    { message: "The Squarespace import is switched off on this deployment.", tone: "error" as const },
    { status: 404 }
  )

function bearerMatches(request: Request, expected: string): boolean {
  const header = request.headers.get("authorization") ?? ""
  if (!header.toLowerCase().startsWith("bearer ")) return false
  const presented = Buffer.from(header.slice(7).trim())
  const wanted = Buffer.from(expected)
  return presented.length === wanted.length && timingSafeEqual(presented, wanted)
}

function respond(outcome: SyncOutcome) {
  if (!outcome.ran) {
    return NextResponse.json({ ran: false, message: outcome.reason, tone: "warning" as const })
  }
  if (!outcome.ok) {
    return NextResponse.json(
      { ran: true, message: `Couldn't reach Squarespace: ${outcome.error}`, tone: "error" as const },
      { status: 502 }
    )
  }
  const { report } = outcome
  return NextResponse.json({
    ran: true,
    message: `${report.created} imported · ${report.cancelled} cancelled · ${report.flaggedForStaff} flagged`,
    tone: "success" as const,
    report,
  })
}

export async function GET(request: Request) {
  if (!importEnabled()) return DISABLED()
  const secret = process.env.CRON_SECRET
  if (!secret) return DISABLED()
  if (!bearerMatches(request, secret)) {
    return NextResponse.json({ message: "Not authorised.", tone: "error" as const }, { status: 401 })
  }
  return respond(await runSquarespaceSync("schedule"))
}

export async function POST(request: Request) {
  if (!importEnabled()) return DISABLED()
  return withCapability("squarespace:sync")(async () => {
    const body = (await request.json().catch(() => ({}))) as { mode?: string }
    return respond(await runSquarespaceSync(body.mode === "now" ? "staff" : "auto"))
  })
}
