import { prisma } from "@/lib/prisma"
import {
  INGREDIENT_INFO,
  INGREDIENT_ORDER,
  INITIAL_CALENDAR_SETTINGS,
  INITIAL_STAFF,
  INITIAL_STOCK,
  PRODUCT_VARIANTS,
} from "@/lib/mock-data"

/**
 * Writes the seed state from the very same constants the in-memory prototype
 * used — imported, not retyped, so the database cannot drift from what the app
 * shipped with and the Suprema/Grande/Mini sequence behaves identically.
 *
 * Shared by the CLI seed script and the "Reset demo data" endpoint so a demo
 * reset and a fresh database are guaranteed to produce the same starting point.
 */
export async function seedDatabase() {
  await prisma.$transaction(async (tx) => {
    // Children first so re-seeding a populated database is safe.
    await tx.productionAssignment.deleteMany()
    await tx.orderStatusEvent.deleteMany()
    await tx.orderItem.deleteMany()
    await tx.order.deleteMany()
    await tx.restockEntry.deleteMany()
    await tx.stockLevel.deleteMany()
    await tx.recipeItem.deleteMany()
    await tx.ingredient.deleteMany()
    await tx.productVariant.deleteMany()
    await tx.staff.deleteMany()
    await tx.calendarSettings.deleteMany()

    for (const [index, key] of INGREDIENT_ORDER.entries()) {
      const info = INGREDIENT_INFO[key]
      const starting = INITIAL_STOCK[key]
      await tx.ingredient.create({
        data: {
          key: info.key,
          label: info.label,
          unit: info.unit,
          sortOrder: index,
          // The ledger stores what is physically in the building; nothing is
          // committed against it until an order is scheduled.
          stockLevel: { create: { onHand: starting } },
        },
      })
    }

    const ingredientIdByKey = new Map(
      (await tx.ingredient.findMany()).map((ingredient) => [ingredient.key, ingredient.id])
    )

    for (const [index, variant] of PRODUCT_VARIANTS.entries()) {
      await tx.productVariant.create({
        data: {
          id: variant.id,
          name: variant.name,
          description: variant.description,
          servings: variant.servings,
          sortOrder: index,
          leadTimeDays: variant.leadTimeDays,
          recipeItems: {
            create: INGREDIENT_ORDER.filter((key) => variant.requires[key]).map((key) => ({
              ingredientId: ingredientIdByKey.get(key)!,
              amountPerUnit: variant.requires[key]!,
            })),
          },
        },
      })
    }

    for (const [index, member] of INITIAL_STAFF.entries()) {
      await tx.staff.create({
        data: {
          id: member.id,
          name: member.name,
          role: member.role,
          orderCount: member.orderCount,
          sortOrder: index,
        },
      })
    }

    // Pinned id: calendar_settings is a singleton, and every reader looks it up
    // by id 1 rather than taking "the first row".
    await tx.calendarSettings.create({
      data: {
        id: 1,
        blockedWeekdays: JSON.stringify(INITIAL_CALENDAR_SETTINGS.blockedWeekdays),
        earliestCollectionTime: INITIAL_CALENDAR_SETTINGS.earliestCollectionTime,
        maxOrdersPerProductionDay: INITIAL_CALENDAR_SETTINGS.maxOrdersPerProductionDay,
      },
    })
  })

  return {
    ingredients: await prisma.ingredient.count(),
    variants: await prisma.productVariant.count(),
    recipeItems: await prisma.recipeItem.count(),
    staff: await prisma.staff.count(),
    calendarSettings: await prisma.calendarSettings.count(),
  }
}
