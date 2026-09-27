import { ROLE_LABEL } from "@/lib/auth/roles"
import { formatDateTime } from "@/lib/format-date"
import { INGREDIENT_INFO, INGREDIENT_ORDER, ORDER_STATUS_ORDER } from "@/lib/mock-data"
import { productionDateForOrder } from "@/lib/production-schedule"
import type {
  IngredientKey,
  Order,
  ProductVariant,
  StaffMember,
} from "@/lib/types"

import { asDate } from "./types"
import type { ExportDocument, ExportTable } from "./types"

/**
 * Turns each screen's data into tables.
 *
 * These live apart from the panels on purpose: a panel's job is to render, and
 * what a reader wants in a spreadsheet is not what the screen shows. The ring
 * and the stacked bar become the figures behind them, and columns the screen
 * infers — an order's production date, an ingredient's unit — are written out,
 * because a spreadsheet has no tooltip to explain itself.
 */

/** Ingredient measures are numbers; the unit goes in its own column so they stay numbers. */
function unitOf(key: IngredientKey): string {
  return INGREDIENT_INFO[key].unit || "count"
}

function exportedAt(now: Date): string {
  return `Exported from Paradiso CRM on ${formatDateTime(now)}.`
}

/* ------------------------------------------------------------ stock levels */

export function stockLevelsDocument(
  available: Record<IngredientKey, number>,
  capacity: Record<IngredientKey, number>,
  now = new Date()
): ExportDocument {
  const rows = INGREDIENT_ORDER.map((key) => {
    const total = capacity[key] ?? 0
    const remaining = Math.max(available[key] ?? 0, 0)
    const committed = Math.max(total - remaining, 0)
    const ratio = total > 0 ? remaining / total : 1
    return [
      INGREDIENT_INFO[key].label,
      unitOf(key),
      remaining,
      committed,
      total,
      Math.round(ratio * 100),
      // The screen's own threshold, spelled out — the colour that carries this
      // on screen cannot survive the trip into a spreadsheet.
      ratio <= 0.2 ? "Low stock" : "OK",
    ]
  })

  return {
    title: "Stock Levels",
    subtitle: exportedAt(now),
    tables: [
      {
        name: "Stock Levels",
        caption: "Available quantity vs. what is already committed to scheduled orders.",
        columns: [
          { label: "Ingredient", width: 16 },
          { label: "Unit", width: 8 },
          { label: "Available", align: "right", width: 12 },
          { label: "Committed", align: "right", width: 12 },
          { label: "Total capacity", align: "right", width: 14 },
          { label: "Remaining %", align: "right", width: 12 },
          { label: "Status", width: 12 },
        ],
        rows,
      },
    ],
  }
}

/* --------------------------------------------------------------- analytics */

export interface AnalyticsExportInput {
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  staff: StaffMember[]
  productionDemand: { amounts: Partial<Record<IngredientKey, number>>; variants: { units: number; surplusUnits: number }[] }[]
  onHand: Record<string, number>
}

export function analyticsDocument(
  { orders, variantsById, staff, productionDemand, onHand }: AnalyticsExportInput,
  now = new Date()
): ExportDocument {
  const orderedUnits = productionDemand.reduce(
    (total, day) => total + day.variants.reduce((sum, v) => sum + v.units, 0),
    0
  )
  const surplusUnits = productionDemand.reduce(
    (total, day) => total + day.variants.reduce((sum, v) => sum + v.surplusUnits, 0),
    0
  )

  const quantityByProduct = new Map<string, number>()
  for (const order of orders) {
    quantityByProduct.set(order.productId, (quantityByProduct.get(order.productId) ?? 0) + order.quantity)
  }

  const consumed: Partial<Record<IngredientKey, number>> = {}
  for (const day of productionDemand) {
    for (const key of INGREDIENT_ORDER) {
      const amount = day.amounts[key]
      if (amount) consumed[key] = (consumed[key] ?? 0) + amount
    }
  }

  const blockCounts = new Map<IngredientKey, number>()
  for (const order of orders.filter((o) => o.status === "On Hold")) {
    for (const shortage of order.shortages) {
      blockCounts.set(shortage.ingredient, (blockCounts.get(shortage.ingredient) ?? 0) + 1)
    }
  }

  const tables: ExportTable[] = [
    {
      name: "Production summary",
      caption:
        "The ovens run whole batches, so what comes out splits into units somebody ordered and spare capacity nobody has claimed.",
      columns: [
        { label: "Measure", width: 20 },
        { label: "Units", align: "right", width: 10 },
      ],
      rows: [
        ["Ordered", orderedUnits],
        ["Spare capacity", surplusUnits],
        ["Total in production", orderedUnits + surplusUnits],
      ],
    },
    {
      name: "Orders by status",
      caption: `${orders.length} order${orders.length === 1 ? "" : "s"} placed this session, by where each one has got to.`,
      columns: [
        { label: "Status", width: 18 },
        { label: "Orders", align: "right", width: 10 },
      ],
      rows: ORDER_STATUS_ORDER.map((status) => [
        status,
        orders.filter((order) => order.status === status).length,
      ]),
    },
    {
      name: "Product performance",
      caption: "Units ordered per variant, across every status.",
      columns: [
        { label: "Product", width: 22 },
        { label: "Units ordered", align: "right", width: 14 },
      ],
      rows: [...quantityByProduct.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([productId, quantity]) => [variantsById[productId]?.name ?? "Unknown", quantity]),
      emptyMessage: "No orders yet.",
    },
    {
      name: "Ingredient consumption",
      caption:
        "What the kitchen actually draws, counted in whole batches across every scheduled production day — surplus included.",
      columns: [
        { label: "Ingredient", width: 16 },
        { label: "Unit", width: 8 },
        { label: "Consumed", align: "right", width: 12 },
        { label: "On hand", align: "right", width: 12 },
      ],
      rows: INGREDIENT_ORDER.filter((key) => consumed[key]).map((key) => [
        INGREDIENT_INFO[key].label,
        unitOf(key),
        consumed[key] ?? 0,
        onHand[key] ?? 0,
      ]),
      emptyMessage: "Nothing consumed yet.",
    },
    {
      name: "Staff workload",
      caption: "Orders assigned by the round-robin, per staff member.",
      columns: [
        { label: "Staff", width: 18 },
        { label: "Role", width: 10 },
        { label: "Orders assigned", align: "right", width: 16 },
      ],
      rows: staff.map((member) => [
        member.name,
        ROLE_LABEL[member.role],
        member.orderCount,
      ]),
      emptyMessage: "No staff on record.",
    },
    {
      name: "On-hold blockers",
      caption: "Which ingredient shortage is holding orders up, and how many each is blocking.",
      columns: [
        { label: "Ingredient", width: 16 },
        { label: "Orders blocked", align: "right", width: 14 },
      ],
      rows: [...blockCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([ingredient, count]) => [INGREDIENT_INFO[ingredient].label, count]),
      emptyMessage: "Nothing is on hold.",
    },
  ]

  return { title: "Reports & Analytics", subtitle: exportedAt(now), tables }
}

/* ---------------------------------------------------------------- calendar */

export interface CalendarExportInput {
  /** The orders the filters currently leave visible — what the screen shows. */
  orders: Order[]
  variantsById: Record<string, ProductVariant>
  productionDemand: {
    date: Date
    orderCount: number
    amounts: Partial<Record<IngredientKey, number>>
    variants: { variantId: string; units: number; batches: number; surplusUnits: number }[]
  }[]
  /** Describes the active filters, so the file says what it is a view of. */
  filterSummary?: string
}

export function calendarDocument(
  { orders, variantsById, productionDemand, filterSummary }: CalendarExportInput,
  now = new Date()
): ExportDocument {
  const orderRows = [...orders]
    .sort((a, b) => a.collectionDate.getTime() - b.collectionDate.getTime())
    .map((order) => {
      const variant = variantsById[order.productId]
      const production = productionDateForOrder(order, variantsById)
      return [
        asDate(order.collectionDate),
        production ? asDate(production) : "—",
        variant?.name ?? "Unknown",
        order.quantity,
        order.status,
        order.assignedStaff ?? "Unassigned",
      ]
    })

  const demandRows = productionDemand.map((day) => [
    asDate(day.date),
    day.orderCount,
    day.variants.reduce((sum, v) => sum + v.units, 0),
    day.variants.reduce((sum, v) => sum + v.batches, 0),
    day.variants.reduce((sum, v) => sum + v.surplusUnits, 0),
    ...INGREDIENT_ORDER.map((key) => day.amounts[key] ?? 0),
  ])

  return {
    title: "Production Calendar",
    subtitle: [exportedAt(now), filterSummary].filter(Boolean).join(" "),
    tables: [
      {
        name: "Orders",
        caption:
          "Every order the calendar is currently showing. The production date is derived from each recipe's lead time, so it moves if that recipe changes.",
        columns: [
          { label: "Collection date", width: 16 },
          { label: "Production date", width: 16 },
          { label: "Product", width: 20 },
          { label: "Quantity", align: "right", width: 10 },
          { label: "Status", width: 14 },
          { label: "Assigned staff", width: 16 },
        ],
        rows: orderRows,
        emptyMessage: "No orders match the current filters.",
      },
      {
        name: "Production days",
        caption:
          "What the kitchen has to make each day, in whole batches. Ingredient columns are the real draw on the store cupboard, surplus included.",
        columns: [
          { label: "Production date", width: 16 },
          { label: "Orders", align: "right", width: 9 },
          { label: "Units", align: "right", width: 9 },
          { label: "Batches", align: "right", width: 9 },
          { label: "Surplus", align: "right", width: 9 },
          ...INGREDIENT_ORDER.map((key) => ({
            label: `${INGREDIENT_INFO[key].label} (${unitOf(key)})`,
            align: "right" as const,
            width: 14,
          })),
        ],
        rows: demandRows,
        emptyMessage: "Nothing is scheduled for production.",
      },
    ],
  }
}
