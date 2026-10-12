import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { withCapability } from "@/lib/server/guard"
import { importSquarespaceOrders } from "@/lib/squarespace/import"

export const dynamic = "force-dynamic"
// One page of orders at one request a second, plus the writes — well inside this.
export const maxDuration = 60

/**
 * Pulls new Squarespace orders into the portal.
 *
 * Off unless SQUARESPACE_IMPORT_ENABLED is "true", so deploying this code
 * changes nothing until someone deliberately switches it on — and switching it
 * off again is one environment variable, no deploy of code.
 *
 * Two ways in:
 *  - GET with `Authorization: Bearer $CRON_SECRET`, which is how a scheduler
 *    (Vercel Cron sends exactly this header) runs it every few minutes; and
 *  - POST from a signed-in Admin, to run it now.
 *
 * With CRON_SECRET unset the scheduled path does not exist, rather than falling
 * back to "no secret needed".
 *
 * The response carries order numbers and product names only — no customers.
 */

function enabled(): boolean {
  return process.env.SQUARESPACE_IMPORT_ENABLED === "true"
}

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

async function run() {
  try {
    const report = await importSquarespaceOrders({ days: 3, apply: true })
    return NextResponse.json({
      message: `${report.created} imported · ${report.cancelled} cancelled · ${report.flaggedForStaff} flagged`,
      tone: "success" as const,
      report,
    })
  } catch (error) {
    // Squarespace being down or slow must never take the portal with it: the
    // next run simply tries again, and nothing half-written is left behind
    // because each cake is imported in its own transaction.
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Import failed.", tone: "error" as const },
      { status: 502 }
    )
  }
}

export async function GET(request: Request) {
  if (!enabled()) return DISABLED()
  const secret = process.env.CRON_SECRET
  if (!secret) return DISABLED()
  if (!bearerMatches(request, secret)) {
    return NextResponse.json({ message: "Not authorised.", tone: "error" as const }, { status: 401 })
  }
  return run()
}

export async function POST() {
  if (!enabled()) return DISABLED()
  return withCapability("settings:manage")(() => run())
}
