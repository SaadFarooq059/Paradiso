import { prisma } from "@/lib/prisma"
import {
  INGREDIENT_INFO,
  INGREDIENT_ORDER,
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

    for (const [index, key] of INGREDIENT_ORDER.entries()) {
      const info = INGREDIENT_INFO[key]
      const starting = INITIAL_STOCK[key]
      await tx.ingredient.create({
        data: {
          key: info.key,
          label: info.label,
          unit: info.unit,
          sortOrder: index,
          // Nothing committed yet, so capacity starts equal to available.
          stockLevel: { create: { available: starting, capacity: starting } },
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
  })

  return {
    ingredients: await prisma.ingredient.count(),
    variants: await prisma.productVariant.count(),
    recipeItems: await prisma.recipeItem.count(),
    staff: await prisma.staff.count(),
  }
}
