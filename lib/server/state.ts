import { prisma } from "@/lib/prisma"
import type { $Enums } from "@prisma/client"
import {
  demandByProductionDay,
  productionLinesFrom,
  productionLinesFromWeddings,
  totalCommitted,
  type BatchableVariant,
  type StockRecord,
} from "@/lib/stock-projection"
import { INITIAL_CALENDAR_SETTINGS } from "@/lib/mock-data"
import { isStaffRole } from "@/lib/auth/roles"
import { paymentStateOf } from "@/lib/payments"
import { depositAmount, outstandingAmount } from "@/lib/weddings"
import { TEMPLATE_FROM_DB } from "@/lib/server/email-service"

/** Enum member to the label the app displays, same boundary as OrderStatus. */
const EMAIL_STATUS_FROM_DB: Record<$Enums.EmailStatus, EmailStatus> = {
  ReadyToSend: "Ready to send",
  Pending: "Pending",
  Suppressed: "Suppressed",
}
import type {
  EmailStatus,
  PaymentEventKind,
  CalendarSettings,
  IngredientKey,
  Order,
  ProductVariant,
  StaffMember,
  Wedding,
} from "@/lib/types"
import {
  type DashboardState,
  parseConsumed,
  parseShortages,
  type SerializedOrder,
  type SerializedWedding,
  toAppStatus,
} from "@/lib/server/serialize"

/** Any Prisma client or interactive-transaction client. */
export type Db = Pick<
  typeof prisma,
  | "ingredient"
  | "productVariant"
  | "staff"
  | "order"
  | "restockEntry"
  | "calendarSettings"
  | "wedding"
  | "weddingPackage"
>

/**
 * Reads the singleton calendar settings row, falling back to the seed values if
 * it is somehow missing — the app must still render rather than 500 on a
 * half-seeded database.
 */
export async function readCalendarSettings(db: Db = prisma): Promise<CalendarSettings> {
  const row = await db.calendarSettings.findUnique({ where: { id: 1 } })
  if (!row) return INITIAL_CALENDAR_SETTINGS
  return {
    // A real Int[] column now, so there is nothing to parse.
    blockedWeekdays: row.blockedWeekdays as CalendarSettings["blockedWeekdays"],
    earliestCollectionTime: row.earliestCollectionTime,
    maxOrdersPerProductionDay: row.maxOrdersPerProductionDay,
    shopName: row.shopName,
    shopAddress: row.shopAddress,
    shopPhone: row.shopPhone,
    weddingCapacityStage: row.weddingCapacityStage as CalendarSettings["weddingCapacityStage"],
    weddingDepositPercent: row.weddingDepositPercent,
  }
}

/**
 * Loads the whole dashboard in one pass and shapes it exactly like the state
 * CrmDashboard used to hold locally. One round trip keeps every screen
 * consistent with every other: before, all screens read the same React state, so
 * they could never disagree; served piecemeal they could.
 */
export async function loadDashboardState(db: Db = prisma): Promise<DashboardState> {
  const [ingredients, variants, staff, orders, restocks, weddings, weddingPackages, calendarSettings] =
    await Promise.all([
    db.ingredient.findMany({ orderBy: { sortOrder: "asc" }, include: { stockLevel: true } }),
    db.productVariant.findMany({
      where: { archived: false },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { recipeItems: { include: { ingredient: true } } },
    }),
    // sortOrder is the explicit tie-break the in-memory array got for free.
    db.staff.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        customer: true,
        statusHistory: { orderBy: { at: "asc" }, include: { actor: true } },
        payments: { orderBy: { at: "asc" }, include: { actor: true } },
        emails: { orderBy: { renderedAt: "asc" } },
        assignment: { include: { staff: true } },
      },
    }),
    db.restockEntry.findMany({ orderBy: { at: "desc" }, include: { ingredient: true } }),
    db.wedding.findMany({
      orderBy: { eventDate: "asc" },
      include: {
        customer: true,
        payments: { orderBy: { at: "asc" }, include: { actor: true } },
        loans: { orderBy: { id: "asc" } },
        stageHistory: { orderBy: { at: "asc" }, include: { actor: true } },
        quotes: {
          orderBy: { version: "desc" },
          include: { tiers: true, actor: true },
        },
      },
    }),
    db.weddingPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    readCalendarSettings(db),
  ])

  const onHand = {} as StockRecord
  for (const ingredient of ingredients) {
    onHand[ingredient.key as IngredientKey] = ingredient.stockLevel?.onHand ?? 0
  }

  const serializedVariants: ProductVariant[] = variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    description: variant.description,
    servings: variant.servings,
    requires: Object.fromEntries(
      variant.recipeItems.map((item) => [item.ingredient.key as IngredientKey, item.amountPerBatch])
    ),
    unitsPerBatch: variant.unitsPerBatch,
    leadTimeDays: variant.leadTimeDays,
    priceAmount: variant.priceAmount,
  }))

  const serializedStaff: StaffMember[] = staff.map((member) => ({
    id: member.id,
    name: member.name,
    role: isStaffRole(member.role) ? member.role : "ShopFloor",
    email: member.email,
    active: member.active,
    orderCount: member.orderCount,
  }))

  const serializedOrders: SerializedOrder[] = orders.map((order) => {
    const line = order.items[0]
    return {
      id: order.id,
      productId: line?.variantId ?? "",
      quantity: line?.quantity ?? 0,
      collectionDate: order.collectionDate.toISOString(),
      status: toAppStatus(order.status),
      // The assignment row is kept after cancellation as a historical record, so
      // Order Detail still shows who had the order; only the workload counter
      // is released.
      assignedStaff: order.assignment?.staff.name ?? null,
      shortages: parseShortages(order.shortages),
      consumedIngredients: parseConsumed(order.consumedIngredients),
      statusHistory: order.statusHistory.map((event) => ({
        status: toAppStatus(event.status),
        at: event.at.getTime(),
        note: event.note ?? undefined,
        // Null rather than a placeholder name: a change made before actors were
        // tracked has an unknown author, and saying so is the honest reading.
        actorId: event.actorId,
        actorName: event.actor?.name ?? null,
      })),
      createdAt: order.createdAt.getTime(),
      customer: order.customer
        ? {
            id: order.customer.id,
            name: order.customer.name,
            email: order.customer.email,
            phone: order.customer.phone,
          }
        : null,
      emails: order.emails.map((email) => ({
        id: email.id,
        template: TEMPLATE_FROM_DB[email.template],
        status: EMAIL_STATUS_FROM_DB[email.status],
        toName: email.toName,
        toEmail: email.toEmail,
        subject: email.subject,
        body: email.body,
        renderedAt: email.renderedAt.getTime(),
        sendAfter: email.sendAfter?.getTime() ?? null,
        suppressedReason: email.suppressedReason,
      })),
      payment: {
        total: order.totalAmount,
        paid: order.amountPaid,
        refunded: order.amountRefunded,
        state: paymentStateOf(order.totalAmount, order.amountPaid, order.amountRefunded),
        events: order.payments.map((event) => ({
          id: event.id,
          kind: event.kind as PaymentEventKind,
          amount: event.amount,
          at: event.at.getTime(),
          actorId: event.actorId,
          actorName: event.actor?.name ?? null,
          note: event.note ?? undefined,
        })),
      },
    } satisfies SerializedOrder
  })

  const serializeQuote = (q: {
    id: string; version: number; packageId: string | null; basePrice: number
    adjustments: unknown; total: number; guestCount: number; note: string | null
    createdAt: Date; supersededAt: Date | null
    actor: { name: string } | null
    tiers: { variantId: string; quantity: number; label: string }[]
  }) => ({
    id: q.id,
    version: q.version,
    packageId: q.packageId,
    basePrice: q.basePrice,
    adjustments: Array.isArray(q.adjustments)
      ? (q.adjustments as { label: string; amount: number }[])
      : [],
    total: q.total,
    guestCount: q.guestCount,
    note: q.note,
    createdAt: q.createdAt.getTime(),
    actorName: q.actor?.name ?? null,
    supersededAt: q.supersededAt?.getTime() ?? null,
    tiers: q.tiers.map((t) => ({ variantId: t.variantId, quantity: t.quantity, label: t.label })),
  })

  const serializedWeddings: SerializedWedding[] = weddings.map((wedding) => {
    const paid = wedding.payments.filter((p) => p.kind === "Payment").reduce((s, p) => s + p.amount, 0)
    const refunded = wedding.payments.filter((p) => p.kind === "Refund").reduce((s, p) => s + p.amount, 0)
    const current = wedding.quotes.find((q) => q.id === wedding.currentQuoteId) ?? null
    const total = current?.total ?? 0
    return {
      id: wedding.id,
      reference: wedding.reference,
      stage: wedding.stage,
      customer: wedding.customer
        ? {
            id: wedding.customer.id,
            name: wedding.customer.name,
            email: wedding.customer.email,
            phone: wedding.customer.phone,
          }
        : null,
      eventDate: wedding.eventDate.toISOString(),
      venue: wedding.venue,
      guestCount: wedding.guestCount,
      flavourNotes: wedding.flavourNotes,
      dietaryRequirements: wedding.dietaryRequirements,
      notes: wedding.notes,
      staffRequired: wedding.staffRequired,
      driversRequired: wedding.driversRequired,
      capacityBookedAt: wedding.capacityBookedAt?.getTime() ?? null,
      currentQuote: current ? serializeQuote(current) : null,
      quotes: wedding.quotes.map(serializeQuote),
      payment: {
        total,
        paid,
        refunded,
        state: paymentStateOf(total, paid, refunded),
        events: wedding.payments.map((e) => ({
          id: e.id,
          kind: e.kind as PaymentEventKind,
          amount: e.amount,
          at: e.at.getTime(),
          actorId: e.actorId,
          actorName: e.actor?.name ?? null,
          note: e.note ?? undefined,
        })),
      },
      loans: wedding.loans.map((l) => ({
        id: l.id,
        item: l.item,
        quantity: l.quantity,
        outAt: l.outAt?.getTime() ?? null,
        returned: l.returned,
        returnedAt: l.returnedAt?.getTime() ?? null,
      })),
      stageHistory: wedding.stageHistory.map((e) => ({
        stage: e.stage,
        at: e.at.getTime(),
        note: e.note ?? undefined,
        actorName: e.actor?.name ?? null,
      })),
      depositDue: depositAmount(total, calendarSettings.weddingDepositPercent),
      outstanding: outstandingAmount(total, paid, refunded),
    }
  })

  // Demand per production day, derived from the live orders' frozen snapshots.
  // Everything the Stock Levels screen shows now comes from here rather than from
  // two stored columns: "committed" is what live orders still owe, and the
  // headline figure is what is left uncommitted.
  const variantLeadTimes = Object.fromEntries(
    variants.map((variant) => [variant.id, { leadTimeDays: variant.leadTimeDays }])
  )
  const batchable: Record<string, BatchableVariant> = Object.fromEntries(
    serializedVariants.map((variant) => [
      variant.id,
      { requires: variant.requires, unitsPerBatch: variant.unitsPerBatch },
    ])
  )
  // Orders and weddings become the same currency here — ProductionLine — and
  // the projection cannot tell them apart. This is what "weddings feed the
  // existing calendar rather than a parallel system" actually means: one list,
  // one batching pass, one forecast.
  const demand = demandByProductionDay(
    [
      ...productionLinesFrom(
        serializedOrders.map((order) => ({
          collectionDate: new Date(order.collectionDate),
          productId: order.productId,
          status: order.status,
          quantity: order.quantity,
        })),
        variantLeadTimes
      ),
      ...productionLinesFromWeddings(
        weddings.map((wedding) => ({
          id: wedding.id,
          stage: wedding.stage,
          capacityBookedAt: wedding.capacityBookedAt,
          eventDate: wedding.eventDate,
          tiers:
            wedding.quotes
              .find((q) => q.id === wedding.currentQuoteId)
              ?.tiers.map((t) => ({ variantId: t.variantId, quantity: t.quantity })) ?? [],
        })),
        variantLeadTimes
      ),
    ],
    batchable
  )
  const committed = totalCommitted(demand)
  const uncommitted = {} as StockRecord
  for (const ingredient of ingredients) {
    const key = ingredient.key as IngredientKey
    uncommitted[key] = (onHand[key] ?? 0) - (committed[key] ?? 0)
  }

  return {
    variants: serializedVariants,
    ingredients: ingredients.map((ingredient) => ({
      key: ingredient.key as IngredientKey,
      label: ingredient.label,
      unit: ingredient.unit,
    })),
    stock: uncommitted,
    capacity: onHand,
    productionDemand: demand.map((day) => ({
      day: day.day,
      date: day.date.toISOString(),
      amounts: day.amounts,
      orderCount: day.orderCount,
      variants: day.variants,
    })),
    staff: serializedStaff,
    orders: serializedOrders,
    restockLog: restocks.map((entry) => ({
      id: entry.id,
      ingredient: entry.ingredient.key as IngredientKey,
      amount: entry.amount,
      at: entry.at.getTime(),
    })),
    calendarSettings,
    weddings: serializedWeddings,
    weddingPackages: weddingPackages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      basePrice: p.basePrice,
      includes: p.includes,
    })),
  }
}

/** Re-hydrates a wire order back into the client-side Order shape. */
export function reviveOrder(order: SerializedOrder): Order {
  return { ...order, collectionDate: new Date(order.collectionDate) }
}

/** Same, for a wedding: the event date comes over as an ISO string. */
export function reviveWedding(wedding: SerializedWedding): Wedding {
  return { ...wedding, eventDate: new Date(wedding.eventDate) }
}
