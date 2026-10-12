/**
 * A read-only window onto the client's live Squarespace shop.
 *
 * Squarespace is still where every customer orders until the switch, so the one
 * rule here is that the portal must never change anything the shop or its staff
 * see. That is enforced in this file rather than left to whoever calls it:
 *
 * - **GET only.** There is no method parameter. Nothing built on this client can
 *   fulfil an order, change stock or send a customer an email, because it has no
 *   way to ask. Writing back (mark fulfilled, set sold-out) is a later, separate
 *   decision with its own client — not a flag on this one.
 * - **Allow-listed paths.** Only the commerce read endpoints the plan names.
 * - **Gentle.** One request at a time, at most one a second — a small fraction of
 *   Squarespace's published limit, so the shop's own admin and any other apps
 *   never feel us. A 429 is obeyed and backed off from, never retried hot.
 * - **Bounded.** Every request times out, and every listing stops at a page cap,
 *   so a bug cannot become an endless crawl of their account.
 * - **Quiet.** The key is never logged or put in an error message.
 */

const API_ROOT = "https://api.squarespace.com"

/** Squarespace asks every integration to identify itself. */
const USER_AGENT = "ParadisoPortal/0.1 (read-only order import)"

const ALLOWED_PATHS = [
  "/1.0/commerce/orders",
  "/1.0/commerce/inventory",
  "/1.0/commerce/products",
  "/1.0/commerce/transactions",
]

const MIN_GAP_MS = 1_000
const TIMEOUT_MS = 15_000
const MAX_RETRIES = 3
/** 50 per page × 20 pages: far more than a bakery's busiest week. */
export const DEFAULT_PAGE_CAP = 20

export class SquarespaceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "SquarespaceError"
  }
}

function apiKey(): string {
  const key = process.env.SQUARESPACE_API_KEY?.trim()
  if (!key) throw new SquarespaceError("SQUARESPACE_API_KEY is not set")
  return key
}

function isAllowed(path: string): boolean {
  return ALLOWED_PATHS.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Requests are chained so two callers in one process still go one at a time.
let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

async function getOnce(url: URL): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()

    let response: Response
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw new SquarespaceError(`Squarespace did not answer ${url.pathname}: ${(error as Error).name}`)
      }
      await sleep(2 ** attempt * 2_000)
      continue
    }

    if (response.ok) return response.json()

    // Too many requests or a hiccup on their side: back off, never hammer.
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("Retry-After"))
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 2 ** attempt * 5_000)
      continue
    }

    // The body can echo request details, so only the status is reported.
    const hint =
      response.status === 401
        ? " — the key is wrong or has been revoked"
        : response.status === 403
          ? " — the key lacks this permission, or the plan does not include the API"
          : ""
    throw new SquarespaceError(`Squarespace refused ${url.pathname} (${response.status})${hint}`, response.status)
  }
}

/** One GET against an allow-listed commerce endpoint. */
export function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!isAllowed(path)) throw new SquarespaceError(`${path} is not on the read-only allow-list`)
  const url = new URL(path, API_ROOT)
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)

  const result = queue.then(() => getOnce(url)) as Promise<T>
  queue = result.catch(() => undefined)
  return result
}

type Page<T> = {
  result?: T[]
  products?: T[]
  inventory?: T[]
  documents?: T[]
  pagination?: { hasNextPage?: boolean; nextPageCursor?: string | null }
}

/**
 * Every item in a cursor-paged listing, stopping at `pageCap` pages.
 *
 * Squarespace rejects a cursor sent alongside filters, so the filters go on the
 * first request only and the cursor carries them after that.
 */
export async function listAll<T>(
  path: string,
  params: Record<string, string> = {},
  pageCap = DEFAULT_PAGE_CAP,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = []
  let cursor: string | null | undefined
  for (let page = 0; page < pageCap; page++) {
    const body = await get<Page<T>>(path, cursor ? { cursor } : params)
    items.push(...(body.result ?? body.products ?? body.inventory ?? body.documents ?? []))
    if (!body.pagination?.hasNextPage || !body.pagination.nextPageCursor) return { items, truncated: false }
    cursor = body.pagination.nextPageCursor
  }
  return { items, truncated: true }
}
