import { prisma } from "@/lib/prisma"
import { toAppStatus } from "@/lib/server/serialize"
import { parseCollectionDate } from "@/lib/squarespace/collection-date"
import { importSquarespaceOrders, type ImportReport } from "@/lib/squarespace/import"

/**
 * When and how far back the Squarespace import runs.
 *
 * The import itself (import.ts) is safe to run any number of times; this file
 * decides how often that is worth doing, and keeps a log of each run so staff can
 * see when the shop was last checked and whether it worked.
 *
 * Three things start a run:
 *  - the daily cron (Vercel's free plan allows one a day);
 *  - any open dashboard of a role that can sync, at most every AUTO_INTERVAL —
 *    this is what makes an order placed this morning appear this morning;
 *  - "Check now" on the Squarespace screen.
 */

export type SyncTrigger = "schedule" | "staff" | "auto"

/** How stale the last check may get before an open dashboard checks again. */
export const AUTO_INTERVAL_MS = 10 * 60_000
/** Even "Check now" waits this long after another run, so a double-click is one run. */
const MIN_GAP_MS = 30_000
/** A run that has not finished after this long is assumed to have died. */
const STALE_RUN_MS = 2 * 60_000
/**
 * The first run, and any run after a long gap, reads this far back. Customers
 * order weeks ahead, so an order placed in early October for November has to
 * be found by the first run even though nothing about it has changed since.
 */
export const MAX_DAYS = 60
/** Overlap with the last good run, so an order changed at the boundary is read twice rather than never. */
const MIN_DAYS = 3

export function importEnabled(): boolean {
  return process.env.SQUARESPACE_IMPORT_ENABLED === "true" && Boolean(process.env.SQUARESPACE_API_KEY?.trim())
}

/** Days to read: since the last good run plus overlap, or everything recent if there is none. */
export function windowDays(lastGoodStart: Date | null, now: Date): number {
  if (!lastGoodStart) return MAX_DAYS
  const since = Math.ceil((now.getTime() - lastGoodStart.getTime()) / 86_400_000)
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, since + 1))
}

export type SyncOutcome =
  | { ran: true; ok: true; report: ImportReport }
  | { ran: true; ok: false; error: string }
  | { ran: false; reason: string }

export async function runSquarespaceSync(trigger: SyncTrigger, now = new Date()): Promise<SyncOutcome> {
  if (!importEnabled()) return { ran: false, reason: "The Squarespace import is switched off." }

  const recent = await prisma.squarespaceSyncRun.findFirst({ orderBy: { startedAt: "desc" } })
  if (recent) {
    const age = now.getTime() - recent.startedAt.getTime()
    const running = recent.ok === null && age < STALE_RUN_MS
    if (running) return { ran: false, reason: "Already checking Squarespace." }
    const gap = trigger === "auto" ? AUTO_INTERVAL_MS : trigger === "staff" ? MIN_GAP_MS : 0
    if (age < gap) return { ran: false, reason: "Squarespace was checked moments ago." }
  }

  const lastGood = await prisma.squarespaceSyncRun.findFirst({
    where: { ok: true },
    orderBy: { startedAt: "desc" },
  })
  const days = windowDays(lastGood?.startedAt ?? null, now)
  const run = await prisma.squarespaceSyncRun.create({ data: { trigger, days, startedAt: now } })

  try {
    const report = await importSquarespaceOrders({ days, apply: true, now })
    await prisma.squarespaceSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: true,
        ordersSeen: report.ordersSeen,
        created: report.created,
        cancelled: report.cancelled,
        flagged: report.flaggedForStaff,
      },
    })
    return { ran: true, ok: true, report }
  } catch (error) {
    // Squarespace being down must never take the portal with it: the run is
    // logged as failed, the next one tries again, and each cake is imported in
    // its own transaction so nothing is left half-written.
    const message = error instanceof Error ? error.message : "Import failed."
    await prisma.squarespaceSyncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: message.slice(0, 500) },
    })
    return { ran: true, ok: false, error: message }
  }
}

export interface SquarespaceLineView {
  lineItemId: string
  orderNumber: string
  productName: string
  options: string
  quantity: number
  collectionRaw: string | null
  /** The collection date read from collectionRaw, as a shop day; null when unreadable or absent. */
  collectionDay: string | null
  outcome: string
  portalOrderId: string | null
  /** Where the portal order this became stands now — Confirmed until someone schedules it. */
  portalStatus: string | null
  firstSeenAt: string
}

export interface SquarespaceStatus {
  enabled: boolean
  lastRun: {
    trigger: string
    startedAt: string
    finishedAt: string | null
    ok: boolean | null
    ordersSeen: number
    created: number
    cancelled: number
    flagged: number
    error: string | null
  } | null
  lastGoodAt: string | null
  /** Every line seen in the last MAX_DAYS, newest order first. Product names only — no customers. */
  lines: SquarespaceLineView[]
}

export async function squarespaceStatus(now = new Date()): Promise<SquarespaceStatus> {
  const since = new Date(now.getTime() - MAX_DAYS * 86_400_000)
  const [lastRun, lastGood, lines] = await Promise.all([
    prisma.squarespaceSyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.squarespaceSyncRun.findFirst({ where: { ok: true }, orderBy: { startedAt: "desc" } }),
    prisma.squarespaceImportLine.findMany({
      where: { lastSeenAt: { gte: since } },
      orderBy: [{ firstSeenAt: "desc" }, { orderNumber: "desc" }],
      take: 300,
      include: { portalOrder: { select: { status: true } } },
    }),
  ])

  return {
    enabled: importEnabled(),
    lastRun: lastRun && {
      trigger: lastRun.trigger,
      startedAt: lastRun.startedAt.toISOString(),
      finishedAt: lastRun.finishedAt?.toISOString() ?? null,
      ok: lastRun.ok,
      ordersSeen: lastRun.ordersSeen,
      created: lastRun.created,
      cancelled: lastRun.cancelled,
      flagged: lastRun.flagged,
      error: lastRun.error,
    },
    lastGoodAt: lastGood?.startedAt.toISOString() ?? null,
    lines: lines.map((line) => ({
      lineItemId: line.lineItemId,
      orderNumber: line.orderNumber,
      productName: line.productName,
      options: line.options,
      quantity: line.quantity,
      collectionRaw: line.collectionRaw,
      collectionDay: parseCollectionDate(line.collectionRaw),
      outcome: line.outcome,
      portalOrderId: line.portalOrderId,
      portalStatus: line.portalOrder ? toAppStatus(line.portalOrder.status) : null,
      firstSeenAt: line.firstSeenAt.toISOString(),
    })),
  }
}
