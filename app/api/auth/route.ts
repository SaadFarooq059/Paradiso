import { NextResponse } from "next/server"

import {
  authSecret,
  clearedSessionCookie,
  readSession,
  sessionCookie,
  verifyCredentials,
} from "@/lib/server/session"
import { capabilitiesOf } from "@/lib/auth/roles"

export const dynamic = "force-dynamic"

/** Who is signed in, and what they may do, for the client to rehydrate from. */
export async function GET() {
  const member = await readSession()
  return NextResponse.json({
    currentUser: member,
    // Sent so the UI can hide what this role cannot use. The routes enforce the
    // same matrix themselves — this is for tidiness, never for protection.
    capabilities: member ? capabilitiesOf(member.role) : [],
    // The sign-in screen says when a deployment is misconfigured rather than
    // silently refusing every attempt.
    configured: authSecret() !== null,
  })
}

/** Sign in with an email and password. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!authSecret()) {
    return NextResponse.json(
      { message: "This deployment has no AUTH_SECRET configured, so sign-in is disabled." },
      { status: 503 }
    )
  }

  const member = await verifyCredentials(email, password)
  // One message for both failure modes. Saying which half was wrong turns this
  // form into a way to find out which addresses exist.
  if (!member) {
    return NextResponse.json({ message: "Wrong email or password." }, { status: 401 })
  }

  const response = NextResponse.json({
    currentUser: member,
    capabilities: capabilitiesOf(member.role),
  })
  response.cookies.set(await sessionCookie(member.id))
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(clearedSessionCookie())
  return response
}
