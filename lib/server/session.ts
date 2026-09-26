import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

import { INITIAL_STAFF } from "@/lib/mock-data"
import type { StaffMember } from "@/lib/types"

/**
 * A demo gate, not an authentication system.
 *
 * The app is going on a public URL with dummy data in it, and the point of this
 * layer is only that a passer-by cannot read or change that data. It is one
 * shared password checked server-side, not per-user accounts: everyone who knows
 * the password picks who they are signing in as from the seed roster, exactly as
 * before. Roles still come from that roster, so "admin" continues to mean what it
 * meant — it is just no longer self-declared by the browser.
 *
 * What it deliberately is NOT: per-user credentials, password hashing with a
 * work factor, rotation, lockout, or a session store. Anything real replaces
 * this wholesale rather than building on it.
 *
 * The session cookie is `staffId.signature`, signed with an HMAC keyed on the
 * shared password itself. That means no second secret to configure, and it means
 * changing the password invalidates every existing session for free. The cookie
 * is httpOnly so page scripts cannot read it, and it is signed so it cannot be
 * forged by simply typing one into devtools — which is what made the old
 * sessionStorage version decorative.
 */

const COOKIE_NAME = "paradiso_session"
/** Eight hours: long enough for a working day, short enough to not linger. */
const MAX_AGE_SECONDS = 60 * 60 * 8

export function demoPassword(): string | null {
  const value = process.env.DEMO_PASSWORD
  return value && value.length > 0 ? value : null
}

function sign(staffId: string, password: string): string {
  return createHmac("sha256", password).update(staffId).digest("hex")
}

/** Constant-time compare, so a wrong value cannot be narrowed down by timing. */
function matches(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function verifyPassword(candidate: string): boolean {
  const expected = demoPassword()
  if (!expected) return false
  return matches(candidate, expected)
}

/** The seed roster is the list of people who may sign in. */
export function findStaff(staffId: string): StaffMember | null {
  return INITIAL_STAFF.find((member) => member.id === staffId) ?? null
}

export function sessionCookie(staffId: string, password: string) {
  return {
    name: COOKIE_NAME,
    value: `${staffId}.${sign(staffId, password)}`,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  }
}

export function clearedSessionCookie() {
  return { name: COOKIE_NAME, value: "", httpOnly: true, path: "/", maxAge: 0 }
}

/**
 * The signed-in staff member, or null.
 *
 * Returns null when DEMO_PASSWORD is unset: without a password there is nothing
 * to sign a cookie with, so no session can be valid. Failing closed means a
 * misconfigured deployment locks everyone out rather than letting everyone in.
 */
export async function readSession(): Promise<StaffMember | null> {
  const password = demoPassword()
  if (!password) return null

  const raw = (await cookies()).get(COOKIE_NAME)?.value
  if (!raw) return null

  const separator = raw.lastIndexOf(".")
  if (separator <= 0) return null

  const staffId = raw.slice(0, separator)
  const signature = raw.slice(separator + 1)
  if (!matches(signature, sign(staffId, password))) return null

  return findStaff(staffId)
}

export async function requireSession(): Promise<StaffMember | null> {
  return readSession()
}

export async function requireAdmin(): Promise<StaffMember | null> {
  const member = await readSession()
  return member?.role === "admin" ? member : null
}
