import { NextResponse } from "next/server"

import type { MutationResult } from "@/lib/server/order-service"

/**
 * Every mutation replies with the full dashboard state alongside its message, so
 * the client never has to guess what changed or issue a follow-up read — the same
 * guarantee the single React state tree gave before.
 */
export function mutationResponse(result: MutationResult) {
  return NextResponse.json(result, { status: result.tone === "error" ? 400 : 200 })
}

export function badRequest(message: string) {
  return NextResponse.json({ message, tone: "error" as const }, { status: 400 })
}
