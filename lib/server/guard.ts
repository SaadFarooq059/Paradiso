import { NextResponse } from "next/server"

import { can, type Capability } from "@/lib/auth/roles"
import { readSession, type SignedInStaff } from "@/lib/server/session"

/**
 * Route guards.
 *
 * Every data route goes through one of these. Hiding a screen in the sidebar was
 * never protection — the route behind it is a URL anyone can POST to, and that
 * is exactly what stops being acceptable once the roles mean something.
 *
 * The capability, not the role, is what a route asks for. `role === "Admin"`
 * spread across twenty files is how a fifth role becomes a week of grep, and it
 * hides *what* is being protected behind *who* happens to be allowed today.
 */
export const UNAUTHORISED = () =>
  NextResponse.json({ message: "Not signed in.", tone: "error" as const }, { status: 401 })

export const FORBIDDEN = (capability?: Capability) =>
  NextResponse.json(
    {
      message: capability
        ? `Your role can't do that (${capability}).`
        : "Your role can't do that.",
      tone: "error" as const,
    },
    { status: 403 }
  )

/** Runs `handler` only for a signed-in user, whatever their role. */
export async function withSession(
  handler: (member: SignedInStaff) => Promise<Response>
): Promise<Response> {
  const member = await readSession()
  if (!member) return UNAUTHORISED()
  return handler(member)
}

/**
 * Runs `handler` only for a signed-in user whose role holds `capability`.
 *
 * 401 and 403 are kept distinct on purpose: "you are not signed in" and "you are
 * signed in and still may not" are different problems with different fixes, and
 * collapsing them makes the second one impossible to debug.
 */
export function withCapability(capability: Capability) {
  return async function guarded(
    handler: (member: SignedInStaff) => Promise<Response>
  ): Promise<Response> {
    const member = await readSession()
    if (!member) return UNAUTHORISED()
    if (!can(member.role, capability)) return FORBIDDEN(capability)
    return handler(member)
  }
}

/** Kept for the one route that is genuinely admin-shaped rather than capability-shaped. */
export async function withAdmin(
  handler: (member: SignedInStaff) => Promise<Response>
): Promise<Response> {
  return withCapability("staff:manage")(handler)
}
