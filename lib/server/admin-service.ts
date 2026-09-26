import { prisma } from "@/lib/prisma"
import { loadDashboardState } from "@/lib/server/state"
import type { MutationResult } from "@/lib/server/order-service"
import type { CalendarSettings, IngredientKey, ProductVariant, StaffMember } from "@/lib/types"

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Creates or updates a variant and replaces its recipe rows wholesale. */
export async function saveVariant(variant: ProductVariant): Promise<MutationResult> {
  await prisma.$transaction(async (tx) => {
    const ingredients = await tx.ingredient.findMany()
    const idByKey = new Map(ingredients.map((i) => [i.key as IngredientKey, i.id]))

    const lastVariant = await tx.productVariant.findFirst({ orderBy: { sortOrder: "desc" } })
    await tx.productVariant.upsert({
      where: { id: variant.id },
      create: {
        id: variant.id,
        name: variant.name,
        description: variant.description,
        servings: variant.servings,
        sortOrder: (lastVariant?.sortOrder ?? -1) + 1,
        leadTimeDays: variant.leadTimeDays,
        unitsPerBatch: variant.unitsPerBatch,
      },
      update: {
        name: variant.name,
        description: variant.description,
        servings: variant.servings,
        archived: false,
        leadTimeDays: variant.leadTimeDays,
        unitsPerBatch: variant.unitsPerBatch,
      },
    })

    await tx.recipeItem.deleteMany({ where: { variantId: variant.id } })
    for (const [key, amount] of Object.entries(variant.requires)) {
      const ingredientId = idByKey.get(key as IngredientKey)
      if (!ingredientId || !amount) continue
      await tx.recipeItem.create({
        data: { variantId: variant.id, ingredientId, amountPerBatch: amount },
      })
    }
  })

  return { state: await loadDashboardState(), message: `Recipe saved: ${variant.name}`, tone: "success" }
}

/**
 * Removing a recipe archives it rather than deleting the row. In-memory this was
 * a filter on an array and orders kept working because they had already frozen
 * their own ingredient snapshot; against a database a hard delete would break the
 * OrderItem foreign key of every past order that used the product.
 */
export async function deleteVariant(id: string): Promise<MutationResult> {
  await prisma.productVariant.update({ where: { id }, data: { archived: true } })
  return { state: await loadDashboardState(), message: "Recipe removed", tone: "success" }
}

export async function saveStaffMember(member: StaffMember): Promise<MutationResult> {
  await prisma.$transaction(async (tx: Tx) => {
    const existing = await tx.staff.findUnique({ where: { id: member.id } })
    if (existing) {
      await tx.staff.update({
        where: { id: member.id },
        data: { name: member.name, role: member.role, orderCount: member.orderCount },
      })
      return
    }
    const last = await tx.staff.findFirst({ orderBy: { sortOrder: "desc" } })
    await tx.staff.create({
      data: {
        id: member.id,
        name: member.name,
        role: member.role,
        orderCount: member.orderCount,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    })
  })

  return { state: await loadDashboardState(), message: `Staff saved: ${member.name}`, tone: "success" }
}

export async function deleteStaffMember(id: string): Promise<MutationResult> {
  const assignments = await prisma.productionAssignment.count({ where: { staffId: id } })
  if (assignments > 0) {
    // In-memory, removing a staff member just dropped them from an array and the
    // orders they owned kept a dangling name string. A foreign key makes that
    // impossible, which is the correct behaviour — surface it instead of failing.
    return {
      state: await loadDashboardState(),
      message: "Can't remove — this staff member has orders assigned. Reassign or cancel them first.",
      tone: "error",
    }
  }
  await prisma.staff.delete({ where: { id } })
  return { state: await loadDashboardState(), message: "Staff member removed", tone: "success" }
}

/**
 * Restores the seeded demo state. Mirrors the in-memory "Reset demo data" button,
 * but now has to actually clear persisted rows rather than re-assign React state.
 */
export async function resetDemoData(): Promise<MutationResult> {
  const { seedDatabase } = await import("@/lib/server/seed-data")
  await seedDatabase()
  return {
    state: await loadDashboardState(),
    message: "Demo data reset — orders cleared, stock, recipes and staff counts back to seed.",
    tone: "success",
  }
}

/**
 * Updates the shop's calendar rules.
 *
 * These are settings rather than constants precisely so they can change without
 * a deploy, and this is the write path the Calendar Rules screen uses. Values are
 * validated here rather than trusted from the client: the picker and the
 * scheduler both read them, so a nonsense value would not merely look wrong, it
 * would make dates unbookable.
 */
export async function saveCalendarSettings(
  settings: CalendarSettings
): Promise<MutationResult> {
  const blockedWeekdays = [...new Set(settings.blockedWeekdays)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b)

  // Every day blocked would leave no collection date selectable at all.
  if (blockedWeekdays.length >= 7) {
    return {
      state: await loadDashboardState(),
      message: "At least one weekday has to stay open for collections.",
      tone: "error",
    }
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.earliestCollectionTime)) {
    return {
      state: await loadDashboardState(),
      message: "Earliest collection time must be a 24-hour time like 10:30.",
      tone: "error",
    }
  }

  if (!Number.isInteger(settings.maxOrdersPerProductionDay) || settings.maxOrdersPerProductionDay < 1) {
    return {
      state: await loadDashboardState(),
      message: "A production day has to allow at least one order.",
      tone: "error",
    }
  }

  await prisma.calendarSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      blockedWeekdays,
      earliestCollectionTime: settings.earliestCollectionTime,
      maxOrdersPerProductionDay: settings.maxOrdersPerProductionDay,
    },
    update: {
      blockedWeekdays,
      earliestCollectionTime: settings.earliestCollectionTime,
      maxOrdersPerProductionDay: settings.maxOrdersPerProductionDay,
    },
  })

  return { state: await loadDashboardState(), message: "Calendar rules saved", tone: "success" }
}
