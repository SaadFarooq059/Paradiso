import { NextResponse } from "next/server"

import { resetDemoData } from "@/lib/server/admin-service"
import { mutationResponse } from "@/lib/server/respond"
import { readSession } from "@/lib/server/session"

export const dynamic = "force-dynamic"

/**
 * Wipes the database back to the seed state.
 *
 * This is the most destructive thing the app can do and it used to be open to
 * anyone who knew the path — fine on a laptop, not fine on a public URL. It now
 * needs one of two things:
 *
 *  - a signed-in admin, which is how the sidebar's "Reset demo data" button
 *    reaches it (the browser sends the session cookie automatically, so no
 *    secret is ever shipped to the client); or
 *  - the RESET_TOKEN as a bearer token, for resetting out of band — the test
 *    suite and any scripted re-seed use this.
 *
 * If RESET_TOKEN is unset the token path does not exist at all, rather than
 * falling back to "no token required". A misconfigured deployment therefore
 * refuses to reset rather than allowing anyone to.
 */
function presentedToken(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim()
  return request.headers.get("x-reset-token")
}

export async function POST(request: Request) {
  const expected = process.env.RESET_TOKEN
  const presented = presentedToken(request)

  if (presented !== null) {
    if (!expected) {
      // No-op: without a configured token there is nothing to authenticate
      // against, so a token-bearing request is refused outright.
      return NextResponse.json(
        { message: "Reset is disabled on this deployment.", tone: "error" as const },
        { status: 404 }
      )
    }
    if (presented !== expected) {
      return NextResponse.json(
        { message: "Invalid reset token.", tone: "error" as const },
        { status: 401 }
      )
    }
    return mutationResponse(await resetDemoData())
  }

  const member = await readSession()
  if (!member) {
    return NextResponse.json(
      { message: "Not signed in.", tone: "error" as const },
      { status: 401 }
    )
  }
  if (member.role !== "admin") {
    return NextResponse.json(
      { message: "Admins only.", tone: "error" as const },
      { status: 403 }
    )
  }

  return mutationResponse(await resetDemoData())
}
