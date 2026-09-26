import { NextResponse } from "next/server"

import {
  clearedSessionCookie,
  demoPassword,
  findStaff,
  readSession,
  sessionCookie,
  verifyPassword,
} from "@/lib/server/session"

export const dynamic = "force-dynamic"

/** Who is signed in, for the client to rehydrate from. */
export async function GET() {
  const member = await readSession()
  return NextResponse.json({
    currentUser: member,
    // The sign-in screen tells the user when the deployment has no password
    // configured, rather than silently refusing every attempt.
    configured: demoPassword() !== null,
  })
}

/** Sign in with the shared demo password, as one of the seed staff. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const staffId = typeof body?.staffId === "string" ? body.staffId : null
  const password = typeof body?.password === "string" ? body.password : ""

  if (!demoPassword()) {
    return NextResponse.json(
      { message: "This deployment has no password configured, so sign-in is disabled." },
      { status: 503 }
    )
  }

  const member = staffId ? findStaff(staffId) : null
  // One message for both failure modes: distinguishing them would tell an
  // attacker which half they got right.
  if (!member || !verifyPassword(password)) {
    return NextResponse.json({ message: "Wrong password." }, { status: 401 })
  }

  const response = NextResponse.json({ currentUser: member })
  response.cookies.set(sessionCookie(member.id, password))
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(clearedSessionCookie())
  return response
}
