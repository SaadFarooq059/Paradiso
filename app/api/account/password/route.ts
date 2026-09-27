import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { hashPassword, readSession, sessionCookie, verifyCredentials } from "@/lib/server/session"

export const dynamic = "force-dynamic"

/** The shortest password this will accept. */
const MINIMUM_LENGTH = 12

/**
 * Changes the signed-in user's own password.
 *
 * Every role can reach this, deliberately: the four live accounts were handed
 * out with generated passwords, and someone who cannot change theirs will keep
 * using the one that was emailed to them.
 *
 * The current password is required even though the session already proves who
 * this is. A session is a cookie on a machine that may be unattended; a password
 * is the person. Without this, anyone who sat down at an unlocked till could
 * lock the account's owner out of it.
 *
 * Changing the hash invalidates every existing session for the account, because
 * the cookie is signed over a fingerprint of it — so a fresh cookie is issued
 * here, which quietly means "signed out everywhere else".
 */
export async function POST(request: Request) {
  const member = await readSession()
  if (!member) return NextResponse.json({ message: "Not signed in." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

  if (newPassword.length < MINIMUM_LENGTH) {
    return NextResponse.json(
      { message: `A password needs at least ${MINIMUM_LENGTH} characters.` },
      { status: 400 }
    )
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { message: "That is the password you are already using." },
      { status: 400 }
    )
  }

  // Re-checked against the account rather than trusted from the session.
  const confirmed = await verifyCredentials(member.email, currentPassword)
  if (!confirmed || confirmed.id !== member.id) {
    return NextResponse.json({ message: "That is not your current password." }, { status: 403 })
  }

  await prisma.staff.update({
    where: { id: member.id },
    data: { passwordHash: await hashPassword(newPassword) },
  })

  const response = NextResponse.json({
    message: "Password changed. Any other device you were signed in on has been signed out.",
    tone: "success",
  })
  response.cookies.set(await sessionCookie(member.id))
  return response
}
