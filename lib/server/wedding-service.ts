import { prisma } from "@/lib/prisma"
import { loadDashboardState, readCalendarSettings } from "@/lib/server/state"
import { asJson, type DashboardState } from "@/lib/server/serialize"
import {
  productionLinesFromWeddings,
  productionLinesFrom,
  shortagesAfterAddingAll,
  type BatchableVariant,
  type ProductionLine,
  type ProjectableWedding,
  type StockRecord,
} from "@/lib/stock-projection"
import { productionDateFor } from "@/lib/production-schedule"
import { shopDayOf, shopMoment, type ShopDay } from "@/lib/shop-time"
import { formatMoney } from "@/lib/payments"
import {
  CAPACITY_THRESHOLD,
  DEAD_STAGES,
  depositAmount,
  qualifiesForCapacity,
  quoteTotal,
  WEDDING_PROGRESSION,
  type QuoteAdjustment,
  type WeddingCapacityStage,
  type WeddingStage,
} from "@/lib/weddings"
import type { IngredientKey, ShortageReason, StaffMember } from "@/lib/types"
import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

export interface MutationResult {
  state: DashboardState
  message: string
  tone: "success" | "error" | "warning"
  weddingId?: string
  /** Set when a booking or amendment was refused for want of ingredients. */
  shortages?: ShortageReason[]
}

/* ------------------------------------------------------------- reading */

/** Everything the projection needs about weddings, in one read. */
async function readWeddings(tx: Tx): Promise<ProjectableWedding[]> {
  const rows = await tx.wedding.findMany({
    include: { currentQuote: { include: { tiers: true } } },
  })
  return rows.map((row) => ({
    id: row.id,
    stage: row.stage,
    capacityBookedAt: row.capacityBookedAt,
    eventDate: row.eventDate,
    tiers: row.currentQuote?.tiers.map((t) => ({ variantId: t.variantId, quantity: t.quantity })) ?? [],
  }))
}

async function readOnHand(tx: Tx): Promise<StockRecord> {
  const ingredients = await tx.ingredient.findMany({ include: { stockLevel: true } })
  const stock = {} as StockRecord
  for (const ingredient of ingredients) {
    stock[ingredient.key as IngredientKey] = ingredient.stockLevel?.onHand ?? 0
  }
  return stock
}

/**
 * Every line currently booked into the kitchen, from both sources.
 *
 * `exceptWeddingId` leaves one wedding out, so an amendment can be judged
 * against the world without its own current booking in it — otherwise its
 * existing tiers would be counted twice and every amendment would look short.
 */
async function bookedLines(tx: Tx, exceptWeddingId?: string) {
  const [orders, variants, weddings] = await Promise.all([
    tx.order.findMany({ include: { items: true } }),
    tx.productVariant.findMany({ include: { recipeItems: { include: { ingredient: true } } } }),
    readWeddings(tx),
  ])

  const leadTimes = Object.fromEntries(
    variants.map((v) => [v.id, { leadTimeDays: v.leadTimeDays }])
  )
  const batchable: Record<string, BatchableVariant> = Object.fromEntries(
    variants.map((v) => [
      v.id,
      {
        unitsPerBatch: v.unitsPerBatch,
        requires: Object.fromEntries(
          v.recipeItems.map((i) => [i.ingredient.key as IngredientKey, i.amountPerBatch])
        ),
      },
    ])
  )

  const orderLines = productionLinesFrom(
    orders.map((o) => ({
      collectionDate: o.collectionDate,
      productId: o.items[0]?.variantId ?? "",
      status: o.status as never,
      quantity: o.items[0]?.quantity ?? 0,
    })),
    leadTimes
  )
  const weddingLines = productionLinesFromWeddings(
    weddings.filter((w) => w.id !== exceptWeddingId),
    leadTimes
  )

  return { lines: [...orderLines, ...weddingLines], batchable, leadTimes }
}

/** The lines a set of tiers would add, on the event's lead-time-adjusted days. */
function candidateLines(
  eventDate: Date,
  tiers: { variantId: string; quantity: number }[],
  leadTimes: Record<string, { leadTimeDays: number }>
): ProductionLine[] {
  const lines: ProductionLine[] = []
  for (const tier of tiers) {
    const variant = leadTimes[tier.variantId]
    if (!variant) continue
    lines.push({
      variantId: tier.variantId,
      units: tier.quantity,
      productionDate: productionDateFor(eventDate, variant.leadTimeDays),
    })
  }
  return lines
}

/* --------------------------------------------------------------- enquiry */

export interface EnquiryInput {
  customer: { name: string; email: string; phone?: string | null }
  eventDay: ShopDay
  venue: string
  guestCount: number
  flavourNotes?: string
  dietaryRequirements?: string
  notes?: string
}

/** Next reference in the year, e.g. W-2026-004. */
async function nextReference(tx: Tx, eventDate: Date): Promise<string> {
  const year = Number(shopDayOf(eventDate).slice(0, 4))
  const count = await tx.wedding.count({ where: { reference: { startsWith: `W-${year}-` } } })
  return `W-${year}-${String(count + 1).padStart(3, "0")}`
}

export async function createEnquiry(
  input: EnquiryInput,
  actor: StaffMember | null = null
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const settings = await readCalendarSettings(tx)
    // The event day is a shop day, like a collection date, for the same reason:
    // an instant would carry the browser's timezone into the record.
    const eventDate = shopMoment(input.eventDay, settings.earliestCollectionTime)

    const email = input.customer.email.trim().toLowerCase()
    const existing = await tx.customer.findFirst({ where: { email } })
    const customer = existing
      ? await tx.customer.update({
          where: { id: existing.id },
          data: { name: input.customer.name.trim(), phone: input.customer.phone?.trim() || null },
        })
      : await tx.customer.create({
          data: { name: input.customer.name.trim(), email, phone: input.customer.phone?.trim() || null },
        })

    const wedding = await tx.wedding.create({
      data: {
        reference: await nextReference(tx, eventDate),
        stage: "Enquiry",
        customerId: customer.id,
        eventDate,
        venue: input.venue.trim(),
        guestCount: input.guestCount,
        flavourNotes: input.flavourNotes?.trim() ?? "",
        dietaryRequirements: input.dietaryRequirements?.trim() ?? "",
        notes: input.notes?.trim() ?? "",
        stageHistory: { create: { stage: "Enquiry", actorId: actor?.id ?? null } },
      },
    })

    return { message: `Enquiry ${wedding.reference} logged`, tone: "success" as const, weddingId: wedding.id }
  })

  return { ...result, state: await loadDashboardState() }
}

/* ---------------------------------------------------------------- quoting */

export interface QuoteInput {
  packageId: string | null
  adjustments: QuoteAdjustment[]
  guestCount: number
  tiers: { variantId: string; quantity: number; label?: string }[]
  note?: string
}

/**
 * Writes a new quote version.
 *
 * Never updates the one in force. An amendment is a new version with the old one
 * superseded, so "what did we agree in March" stays answerable — which is the
 * whole reason the tiers hang off the quote rather than the wedding.
 *
 * If the wedding already holds capacity, the new tiers are checked against the
 * kitchen first and the amendment is refused if they do not fit. Booking
 * capacity that does not exist is the failure this is here to prevent.
 */
export async function saveQuote(
  weddingId: string,
  input: QuoteInput,
  actor: StaffMember | null = null
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const wedding = await tx.wedding.findUnique({
      where: { id: weddingId },
      include: { currentQuote: true },
    })
    if (!wedding) return { message: "Unknown wedding.", tone: "error" as const }
    if (DEAD_STAGES.includes(wedding.stage as WeddingStage)) {
      return { message: "That wedding is closed.", tone: "error" as const }
    }
    if (input.tiers.length === 0) {
      return { message: "A quote needs at least one tier.", tone: "error" as const }
    }

    const pkg = input.packageId
      ? await tx.weddingPackage.findUnique({ where: { id: input.packageId } })
      : null
    const basePrice = pkg?.basePrice ?? 0
    const total = quoteTotal(basePrice, input.adjustments)

    // Only re-check the kitchen if this wedding is already holding capacity —
    // an unbooked wedding is not competing for anything yet.
    if (wedding.capacityBookedAt) {
      const { lines, batchable, leadTimes } = await bookedLines(tx, weddingId)
      const candidates = candidateLines(wedding.eventDate, input.tiers, leadTimes)
      const shortages = shortagesAfterAddingAll(await readOnHand(tx), lines, batchable, candidates)
      if (shortages.length > 0) {
        return {
          message:
            "That amendment doesn't fit the kitchen — the new tiers would run the ingredients short.",
          tone: "error" as const,
          shortages,
        }
      }
    }

    const previous = wedding.currentQuote
    const version = (previous?.version ?? 0) + 1
    if (previous) {
      await tx.quote.update({ where: { id: previous.id }, data: { supersededAt: new Date() } })
    }

    const quote = await tx.quote.create({
      data: {
        weddingId,
        version,
        packageId: pkg?.id ?? null,
        basePrice,
        adjustments: asJson(input.adjustments),
        total,
        guestCount: input.guestCount,
        note: input.note?.trim() || null,
        actorId: actor?.id ?? null,
        tiers: {
          create: input.tiers.map((t) => ({
            variantId: t.variantId,
            quantity: t.quantity,
            label: t.label?.trim() ?? "",
          })),
        },
      },
    })

    await tx.wedding.update({
      where: { id: weddingId },
      data: { currentQuoteId: quote.id, guestCount: input.guestCount },
    })

    // A first quote moves Enquiry along; later versions leave the stage alone.
    if (wedding.stage === "Enquiry") {
      await moveStage(tx, weddingId, "Quoted", actor, "First quote sent")
    }

    const delta = previous ? total - previous.total : 0
    return {
      message: previous
        ? `Quote v${version} saved — ${delta === 0 ? "no change to the total" : `${delta > 0 ? "up" : "down"} ${formatMoney(Math.abs(delta))} to ${formatMoney(total)}`}`
        : `Quote saved — ${formatMoney(total)}`,
      tone: "success" as const,
    }
  })

  return { ...result, state: await loadDashboardState() }
}

/* ----------------------------------------------------------------- stages */

/**
 * Moves a wedding's stage and books capacity if this is the moment for it.
 *
 * Booking is recorded as a stored fact the first time the wedding reaches the
 * configured threshold. It is never recomputed from (stage, setting) afterwards.
 */
async function moveStage(
  tx: Tx,
  weddingId: string,
  stage: WeddingStage,
  actor: StaffMember | null,
  note?: string
) {
  await tx.wedding.update({
    where: { id: weddingId },
    data: {
      stage,
      stageHistory: { create: { stage, actorId: actor?.id ?? null, note: note ?? null } },
      // Cancelling or losing a wedding hands its ingredients back.
      ...(DEAD_STAGES.includes(stage) ? { capacityBookedAt: null } : {}),
    },
  })
}

export async function advanceWedding(
  weddingId: string,
  stage: WeddingStage,
  actor: StaffMember | null = null
): Promise<MutationResult> {
  const result = await prisma.$transaction(async (tx) => {
    const wedding = await tx.wedding.findUnique({
      where: { id: weddingId },
      include: { currentQuote: { include: { tiers: true } } },
    })
    if (!wedding) return { message: "Unknown wedding.", tone: "error" as const }

    const settings = await readCalendarSettings(tx)
    const capacityStage = settings.weddingCapacityStage as WeddingCapacityStage

    const shouldBook =
      !wedding.capacityBookedAt &&
      !DEAD_STAGES.includes(stage) &&
      qualifiesForCapacity(stage, capacityStage)

    if (shouldBook) {
      const tiers = wedding.currentQuote?.tiers ?? []
      if (tiers.length === 0) {
        return {
          message: "This wedding needs a quote with tiers before it can book the kitchen.",
          tone: "error" as const,
        }
      }
      const { lines, batchable, leadTimes } = await bookedLines(tx, weddingId)
      const candidates = candidateLines(wedding.eventDate, tiers, leadTimes)
      const shortages = shortagesAfterAddingAll(await readOnHand(tx), lines, batchable, candidates)
      if (shortages.length > 0) {
        return {
          message: "Can't book the kitchen — the ingredients would run short.",
          tone: "error" as const,
          shortages,
        }
      }
    }

    await moveStage(tx, weddingId, stage, actor)
    if (shouldBook) {
      await tx.wedding.update({ where: { id: weddingId }, data: { capacityBookedAt: new Date() } })
    }

    return {
      message: shouldBook
        ? `Moved to ${stage} — kitchen capacity booked`
        : `Moved to ${stage}`,
      tone: "success" as const,
    }
  })

  return { ...result, state: await loadDashboardState() }
}

/* ------------------------------------------------- capacity setting change */

/**
 * Applies a change to weddingCapacityStage across weddings that already exist.
 *
 * Tightening (deposit -> confirmation) never un-books anything. A wedding that
 * has already committed stays committed: freeing ingredients the kitchen has
 * promised would strand demand silently and the shortage would only surface on
 * the day. That is what `capacityBookedAt` being stored buys.
 *
 * Loosening (deposit -> quote) books weddings that now qualify, each checked
 * against the kitchen. Any that do not fit are reported by name rather than
 * skipped quietly, so the change is never half-applied without saying so.
 */
export async function applyCapacityStageChange(
  setting: WeddingCapacityStage,
  actor: StaffMember | null = null
): Promise<{ booked: string[]; refused: { reference: string; shortages: ShortageReason[] }[] }> {
  const booked: string[] = []
  const refused: { reference: string; shortages: ShortageReason[] }[] = []

  await prisma.$transaction(async (tx) => {
    const weddings = await tx.wedding.findMany({
      where: { capacityBookedAt: null },
      include: { currentQuote: { include: { tiers: true } } },
    })

    for (const wedding of weddings) {
      if (!qualifiesForCapacity(wedding.stage as WeddingStage, setting)) continue
      const tiers = wedding.currentQuote?.tiers ?? []
      if (tiers.length === 0) continue

      const { lines, batchable, leadTimes } = await bookedLines(tx, wedding.id)
      const candidates = candidateLines(wedding.eventDate, tiers, leadTimes)
      const shortages = shortagesAfterAddingAll(await readOnHand(tx), lines, batchable, candidates)
      if (shortages.length > 0) {
        refused.push({ reference: wedding.reference, shortages })
        continue
      }
      await tx.wedding.update({
        where: { id: wedding.id },
        data: {
          capacityBookedAt: new Date(),
          stageHistory: {
            create: {
              stage: wedding.stage,
              actorId: actor?.id ?? null,
              note: `Booked capacity — policy changed to ${CAPACITY_THRESHOLD[setting]}`,
            },
          },
        },
      })
      booked.push(wedding.reference)
    }
  })

  return { booked, refused }
}

/* ------------------------------------------------------------------ money */

/** The same ledger orders use. One table, one set of rules, one place to report from. */
async function recordMoney(
  tx: Tx,
  weddingId: string,
  kind: "Payment" | "Refund",
  amount: number,
  actor: StaffMember | null,
  note?: string | null
) {
  await tx.paymentEvent.create({
    data: { weddingId, kind, amount, actorId: actor?.id ?? null, note: note?.trim() || null },
  })
}

export async function recordWeddingPayment(
  weddingId: string,
  amount: number,
  kind: "Payment" | "Refund",
  actor: StaffMember | null = null,
  note?: string | null
): Promise<MutationResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { state: await loadDashboardState(), message: "Amount must be whole pence, above zero.", tone: "error" }
  }

  const result = await prisma.$transaction(async (tx) => {
    const wedding = await tx.wedding.findUnique({
      where: { id: weddingId },
      include: { currentQuote: true, payments: true },
    })
    if (!wedding) return { message: "Unknown wedding.", tone: "error" as const }

    const paid = wedding.payments.filter((p) => p.kind === "Payment").reduce((s, p) => s + p.amount, 0)
    const refunded = wedding.payments.filter((p) => p.kind === "Refund").reduce((s, p) => s + p.amount, 0)
    const total = wedding.currentQuote?.total ?? 0

    if (kind === "Payment" && paid + amount > total) {
      return { message: "That would take the wedding over its quoted total.", tone: "error" as const }
    }
    if (kind === "Refund" && refunded + amount > paid) {
      return { message: "That's more than has been paid on this wedding.", tone: "error" as const }
    }

    await recordMoney(tx, weddingId, kind, amount, actor, note)

    // Paying the deposit is a pipeline event, not just a ledger one.
    const settings = await readCalendarSettings(tx)
    const deposit = depositAmount(total, settings.weddingDepositPercent)
    const nowPaid = kind === "Payment" ? paid + amount : paid
    if (kind === "Payment" && wedding.stage === "Quoted" && total > 0 && nowPaid >= deposit) {
      // Routed through advanceWedding's rules rather than set directly, so the
      // capacity check runs exactly as it would on a manual move.
      return {
        message: `${formatMoney(amount)} recorded — deposit met`,
        tone: "success" as const,
        autoAdvance: "DepositPaid" as WeddingStage,
      }
    }

    return { message: `${formatMoney(amount)} recorded`, tone: "success" as const }
  })

  if ("autoAdvance" in result && result.autoAdvance) {
    return advanceWedding(weddingId, result.autoAdvance, actor)
  }
  return { ...result, state: await loadDashboardState() }
}

/* -------------------------------------------------------------- logistics */

export async function saveLoan(
  weddingId: string,
  item: string,
  quantity: number,
  actor: StaffMember | null = null
): Promise<MutationResult> {
  if (!item.trim()) {
    return { state: await loadDashboardState(), message: "Name the item being lent.", tone: "error" }
  }
  await prisma.equipmentLoan.create({
    data: { weddingId, item: item.trim(), quantity: Math.max(1, quantity), outAt: new Date() },
  })
  return { state: await loadDashboardState(), message: `${item.trim()} marked out on loan`, tone: "success" }
}

export async function returnLoan(loanId: number): Promise<MutationResult> {
  const loan = await prisma.equipmentLoan.findUnique({ where: { id: loanId } })
  if (!loan) {
    return { state: await loadDashboardState(), message: "No such loan.", tone: "error" }
  }
  await prisma.equipmentLoan.update({
    where: { id: loanId },
    data: { returned: true, returnedAt: new Date() },
  })
  return { state: await loadDashboardState(), message: `${loan.item} marked returned`, tone: "success" }
}

export async function saveLogistics(
  weddingId: string,
  staffRequired: number,
  driversRequired: number
): Promise<MutationResult> {
  await prisma.wedding.update({
    where: { id: weddingId },
    data: {
      staffRequired: Math.max(0, staffRequired),
      driversRequired: Math.max(0, driversRequired),
    },
  })
  return { state: await loadDashboardState(), message: "Logistics saved", tone: "success" }
}

export { WEDDING_PROGRESSION }
