import { randomUUID } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts"
import { hashPassword } from "@/lib/server/session"
import {
  INGREDIENT_INFO,
  INGREDIENT_ORDER,
  INITIAL_CALENDAR_SETTINGS,
  INITIAL_STAFF,
  INITIAL_STOCK,
  PRODUCT_VARIANTS,
  WEDDING_PACKAGES,
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
    // Children before parents, all the way down, so re-seeding a populated
    // database is safe. Customers are late in the list because both orders and
    // weddings point at them — deleting them first is a foreign key violation,
    // which is the database correctly refusing to orphan a wedding.
    await tx.productionAssignment.deleteMany()
    await tx.emailMessage.deleteMany()
    await tx.paymentEvent.deleteMany()
    await tx.orderStatusEvent.deleteMany()
    await tx.orderItem.deleteMany()
    await tx.order.deleteMany()

    await tx.weddingStageEvent.deleteMany()
    await tx.equipmentLoan.deleteMany()
    await tx.quoteTier.deleteMany()
    // The wedding points at its current quote and the quote points back, so the
    // link has to be broken before either can go.
    await tx.wedding.updateMany({ data: { currentQuoteId: null } })
    await tx.quote.deleteMany()
    await tx.wedding.deleteMany()
    await tx.weddingPackage.deleteMany()

    await tx.customer.deleteMany()
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
          unitsPerBatch: variant.unitsPerBatch,
          priceAmount: variant.priceAmount,
          recipeItems: {
            create: INGREDIENT_ORDER.filter((key) => variant.requires[key]).map((key) => ({
              ingredientId: ingredientIdByKey.get(key)!,
              amountPerBatch: variant.requires[key]!,
            })),
          },
        },
      })
    }

    for (const [index, member] of INITIAL_STAFF.entries()) {
      // Credentials come from the published demo accounts, hashed here — the
      // seed never stores a plaintext password, even for a demo login whose
      // password is printed on the sign-in screen.
      const account = DEMO_ACCOUNTS.find((a) => a.email.startsWith(`${member.id}@`))
      await tx.staff.create({
        data: {
          id: member.id,
          name: member.name,
          role: member.role,
          orderCount: member.orderCount,
          sortOrder: index,
          email: account?.email ?? `${member.id}@paradiso.test`,
          passwordHash: await hashPassword(account?.password ?? randomUUID()),
          active: true,
        },
      })
    }

    for (const [index, pkg] of WEDDING_PACKAGES.entries()) {
      await tx.weddingPackage.create({
        data: {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          basePrice: pkg.basePrice,
          includes: pkg.includes,
          sortOrder: index,
        },
      })
    }

    // Pinned id: calendar_settings is a singleton, and every reader looks it up
    // by id 1 rather than taking "the first row".
    await tx.calendarSettings.create({
      data: {
        id: 1,
        blockedWeekdays: INITIAL_CALENDAR_SETTINGS.blockedWeekdays,
        earliestCollectionTime: INITIAL_CALENDAR_SETTINGS.earliestCollectionTime,
        maxOrdersPerProductionDay: INITIAL_CALENDAR_SETTINGS.maxOrdersPerProductionDay,
        shopName: INITIAL_CALENDAR_SETTINGS.shopName,
        shopAddress: INITIAL_CALENDAR_SETTINGS.shopAddress,
        shopPhone: INITIAL_CALENDAR_SETTINGS.shopPhone,
        weddingCapacityStage: INITIAL_CALENDAR_SETTINGS.weddingCapacityStage,
        weddingDepositPercent: INITIAL_CALENDAR_SETTINGS.weddingDepositPercent,
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
