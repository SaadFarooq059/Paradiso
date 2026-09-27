import { prisma } from "@/lib/prisma"
import { applyCapacityStageChange } from "@/lib/server/wedding-service"
import { hashPassword } from "@/lib/server/session"
import { loadDashboardState, readCalendarSettings } from "@/lib/server/state"
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
        priceAmount: variant.priceAmount,
        priceEstimated: variant.priceEstimated ?? false,
      },
      update: {
        name: variant.name,
        description: variant.description,
        servings: variant.servings,
        archived: false,
        leadTimeDays: variant.leadTimeDays,
        unitsPerBatch: variant.unitsPerBatch,
        priceAmount: variant.priceAmount,
        priceEstimated: variant.priceEstimated ?? false,
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
  // A recipe that is not there is a bad request, not a crash. Prisma throws on
  // update-not-found, which surfaced as a 500 for what is an ordinary mistake.
  const existing = await prisma.productVariant.findUnique({ where: { id } })
  if (!existing) {
    return { state: await loadDashboardState(), message: "No such recipe.", tone: "error" }
  }
  await prisma.productVariant.update({ where: { id }, data: { archived: true } })
  return { state: await loadDashboardState(), message: "Recipe removed", tone: "success" }
}

/**
 * Creates or updates a staff account.
 *
 * A password is required to create one and optional afterwards: an admin should
 * not have to retype it to rename someone, and leaving it blank on an edit means
 * "leave the password alone" rather than "clear it". It is hashed here and never
 * held anywhere in plaintext, not even for the length of this function.
 */
export async function saveStaffMember(
  member: StaffMember,
  password?: string
): Promise<MutationResult> {
  const email = member.email?.trim().toLowerCase() ?? ""
  if (!email) {
    return { state: await loadDashboardState(), message: "An email is required.", tone: "error" }
  }

  // Unique per account, because it is the sign-in identity and two people
  // sharing one would make "who did this" unanswerable.
  const clash = await prisma.staff.findFirst({ where: { email, NOT: { id: member.id } } })
  if (clash) {
    return {
      state: await loadDashboardState(),
      message: `${email} is already used by ${clash.name}.`,
      tone: "error",
    }
  }

  const existing = await prisma.staff.findUnique({ where: { id: member.id } })
  if (!existing && (!password || password.length < 8)) {
    return {
      state: await loadDashboardState(),
      message: "A new account needs a password of at least 8 characters.",
      tone: "error",
    }
  }
  if (password && password.length > 0 && password.length < 8) {
    return {
      state: await loadDashboardState(),
      message: "A password must be at least 8 characters.",
      tone: "error",
    }
  }

  const passwordHash = password && password.length > 0 ? await hashPassword(password) : null

  await prisma.$transaction(async (tx: Tx) => {
    if (existing) {
      await tx.staff.update({
        where: { id: member.id },
        data: {
          name: member.name,
          role: member.role,
          orderCount: member.orderCount,
          email,
          active: member.active ?? true,
          // Changing the hash also invalidates that account's existing sessions,
          // because the session signature covers a fingerprint of it.
          ...(passwordHash ? { passwordHash } : {}),
        },
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
        email,
        active: member.active ?? true,
        passwordHash: passwordHash!,
      },
    })
  })

  return { state: await loadDashboardState(), message: `Staff saved: ${member.name}`, tone: "success" }
}

export async function deleteStaffMember(id: string): Promise<MutationResult> {
  const existing = await prisma.staff.findUnique({ where: { id } })
  if (!existing) {
    return { state: await loadDashboardState(), message: "No such staff member.", tone: "error" }
  }
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
  settings: CalendarSettings,
  actor: StaffMember | null = null
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

  // The shop's name goes out in every customer message, so a blank one is
  // refused here as well as in the form.
  const shopName = settings.shopName.trim()
  if (!shopName) {
    return {
      state: await loadDashboardState(),
      message: "A shop name is required — it appears in every customer email.",
      tone: "error",
    }
  }

  if (settings.weddingDepositPercent < 0 || settings.weddingDepositPercent > 100) {
    return {
      state: await loadDashboardState(),
      message: "The deposit percentage has to be between 0 and 100.",
      tone: "error",
    }
  }

  const shopFields = {
    blockedWeekdays,
    earliestCollectionTime: settings.earliestCollectionTime,
    maxOrdersPerProductionDay: settings.maxOrdersPerProductionDay,
    shopName,
    shopAddress: settings.shopAddress.trim(),
    shopPhone: settings.shopPhone.trim(),
    weddingCapacityStage: settings.weddingCapacityStage,
    weddingDepositPercent: settings.weddingDepositPercent,
    shopEmail: settings.shopEmail.trim(),
    shopOpeningHours: settings.shopOpeningHours.trim(),
    weddingBalanceDueDaysBefore: settings.weddingBalanceDueDaysBefore,
    weddingQuoteTurnaround: settings.weddingQuoteTurnaround.trim(),
    deliveryPerMile: settings.deliveryPerMile,
    deliveryMaxMiles: settings.deliveryMaxMiles,
    deliveryMinimumOrder: settings.deliveryMinimumOrder,
    loanReturnDays: settings.loanReturnDays,
  }

  const before = await readCalendarSettings()

  await prisma.calendarSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...shopFields },
    update: shopFields,
  })

  // Changing when weddings book capacity has to be applied to the ones that
  // already exist, or the setting is a lie for everything booked before it.
  // Tightening never un-books; loosening books what fits and reports what does
  // not, so the change is never half-applied in silence.
  let capacityNote = ""
  if (before.weddingCapacityStage !== settings.weddingCapacityStage) {
    const { booked, refused } = await applyCapacityStageChange(settings.weddingCapacityStage, actor)
    const parts: string[] = []
    if (booked.length) parts.push(`${booked.length} wedding${booked.length === 1 ? "" : "s"} now holding capacity`)
    if (refused.length) {
      parts.push(
        `${refused.length} could not be booked (${refused.map((r) => r.reference).join(", ")}) — not enough stock`
      )
    }
    // Weddings booked before the change keep their capacity whatever the new
    // setting says; that is what stops demand being stranded.
    if (parts.length) capacityNote = ` — ${parts.join("; ")}`
    if (refused.length) {
      return {
        state: await loadDashboardState(),
        message: `Settings saved${capacityNote}`,
        tone: "warning",
      }
    }
  }

  return { state: await loadDashboardState(), message: `Settings saved${capacityNote}`, tone: "success" }
}
