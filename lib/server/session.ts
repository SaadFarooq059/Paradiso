import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { isStaffRole, type StaffRole } from "@/lib/auth/roles"
import type { StaffMember } from "@/lib/types"

/**
 * Per-user accounts.
 *
 * This replaces a single shared DEMO_PASSWORD under which everyone picked who
 * they wanted to be from a roster. That was fine while the roles were cosmetic
 * and is not fine now that they are enforced: one shared secret that lets its
 * holder become any user, including an Admin, is a master key. It cannot coexist
 * with role enforcement — any boundary is one sign-in away from being bypassed —
 * so it is gone rather than kept as a fallback.
 *
 * Passwords are bcrypt at cost 12, which is chosen to be slow. Verifying is the
 * only thing that can be done with a stored hash; there is no path back to the
 * password, here or anywhere else.
 *
 * The cookie is `staffId.issuedAt.signature`, signed with AUTH_SECRET. The
 * signature covers a fingerprint of the account's current password hash, so
 * changing a password — or suspending the account — invalidates every session
 * that account already had, without needing a session table to sweep.
 */

const COOKIE_NAME = "paradiso_session"
/** Eight hours: a working day, and no longer. */
const MAX_AGE_SECONDS = 60 * 60 * 8
const BCRYPT_COST = 12

export function authSecret(): string | null {
  const value = process.env.AUTH_SECRET
  // A short secret is worse than an obviously missing one, because it looks
  // configured. Refuse it and fail closed.
  return value && value.length >= 32 ? value : null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

/** Constant-time compare, so a wrong value cannot be narrowed down by timing. */
function matches(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Ties a session to the credential that created it. Only a fingerprint: the
 * cookie never carries the hash itself, and the hash never leaves the server.
 */
function credentialFingerprint(passwordHash: string, active: boolean): string {
  return createHash("sha256").update(`${passwordHash}:${active}`).digest("hex").slice(0, 16)
}

function sign(staffId: string, issuedAt: number, fingerprint: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${staffId}.${issuedAt}.${fingerprint}`)
    .digest("hex")
}

export interface SignedInStaff extends StaffMember {
  email: string
}

function toMember(row: {
  id: string
  name: string
  role: string
  orderCount: number
  email: string
}): SignedInStaff {
  return {
    id: row.id,
    name: row.name,
    // A row whose role the app does not recognise gets the least privilege
    // rather than the benefit of the doubt.
    role: isStaffRole(row.role) ? (row.role as StaffRole) : "ShopFloor",
    orderCount: row.orderCount,
    email: row.email,
  }
}

/**
 * Checks an email and password against the database.
 *
 * Deliberately gives the same answer for "no such account" and "wrong password".
 * Distinguishing them turns the sign-in form into a way to discover which
 * addresses are real. A hash is compared even when no account matched, so the
 * two paths take about the same time.
 */
const ABSENT_ACCOUNT_HASH = "$2b$12$.invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin"

export async function verifyCredentials(
  email: string,
  password: string
): Promise<SignedInStaff | null> {
  const row = await prisma.staff.findUnique({ where: { email: email.trim().toLowerCase() } })
  const ok = await bcrypt.compare(password, row?.passwordHash ?? ABSENT_ACCOUNT_HASH)
  if (!row || !ok || !row.active) return null
  await prisma.staff.update({ where: { id: row.id }, data: { lastSignInAt: new Date() } })
  return toMember(row)
}

export async function sessionCookie(staffId: string) {
  const secret = authSecret()
  const row = await prisma.staff.findUnique({ where: { id: staffId } })
  if (!secret || !row) throw new Error("Cannot issue a session without AUTH_SECRET and an account.")
  const issuedAt = Date.now()
  const fingerprint = credentialFingerprint(row.passwordHash, row.active)
  return {
    name: COOKIE_NAME,
    value: `${staffId}.${issuedAt}.${sign(staffId, issuedAt, fingerprint, secret)}`,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  }
}

export function clearedSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  }
}

/**
 * The signed-in user, or null.
 *
 * Reads the account from the database every time rather than trusting what the
 * cookie says about it. The cookie proves *who*; it is not allowed to assert a
 * role, because a role is exactly the thing worth forging.
 */
export async function readSession(): Promise<SignedInStaff | null> {
  const secret = authSecret()
  if (!secret) return null

  const raw = (await cookies()).get(COOKIE_NAME)?.value
  if (!raw) return null

  const parts = raw.split(".")
  if (parts.length !== 3) return null
  const [staffId, issuedAtRaw, signature] = parts

  const issuedAt = Number(issuedAtRaw)
  if (!Number.isFinite(issuedAt)) return null
  if (Date.now() - issuedAt > MAX_AGE_SECONDS * 1000) return null

  const row = await prisma.staff.findUnique({ where: { id: staffId } })
  if (!row || !row.active) return null

  const expected = sign(staffId, issuedAt, credentialFingerprint(row.passwordHash, row.active), secret)
  if (!matches(signature, expected)) return null

  return toMember(row)
}

export async function requireSession(): Promise<SignedInStaff | null> {
  return readSession()
}
