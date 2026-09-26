import { NextResponse } from "next/server"

import { readSession } from "@/lib/server/session"
import type { StaffMember } from "@/lib/types"

/**
 * Route guards.
 *
 * Every data route goes through one of these. Hiding the admin screens in the
 * sidebar was never protection — the API routes behind them were reachable by
 * anyone who knew the path, which is exactly what stops being acceptable on a
 * public URL.
 */
export const UNAUTHORISED = () =>
  NextResponse.json({ message: "Not signed in.", tone: "error" as const }, { status: 401 })

export const FORBIDDEN = () =>
  NextResponse.json({ message: "Admins only.", tone: "error" as const }, { status: 403 })

/** Runs `handler` only for a signed-in user. */
export async function withSession(
  handler: (member: StaffMember) => Promise<Response>
): Promise<Response> {
  const member = await readSession()
  if (!member) return UNAUTHORISED()
  return handler(member)
}

/** Runs `handler` only for a signed-in admin. */
export async function withAdmin(
  handler: (member: StaffMember) => Promise<Response>
): Promise<Response> {
  const member = await readSession()
  if (!member) return UNAUTHORISED()
  if (member.role !== "admin") return FORBIDDEN()
  return handler(member)
}
