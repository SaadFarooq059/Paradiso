import { renderEmail, type TemplateKey } from "@/lib/emails/templates"
import {
  addShopDays,
  compareShopDays,
  shopDayOf,
  shopMoment,
  todayShopDay,
} from "@/lib/shop-time"
import { readCalendarSettings } from "@/lib/server/state"
import type { OrderStatus } from "@/lib/types"
import type { $Enums, Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

/**
 * Renders the customer messages a status change triggers, and logs them.
 *
 * Nothing is sent. Each row records exactly what the customer would receive and
 * when, so the behaviour can be agreed before a mail provider is chosen — the
 * choice is deliberately still open, and nothing here assumes one.
 *
 * Called inside the same transaction as the status change it follows, so an
 * order can never end up moved without its message, or messaged about a move
 * that then rolled back.
 */

/**
 * Same gap as OrderStatus: the enum *label* keeps the human wording but a Prisma
 * enum *member* has to be an identifier. Mapped here, at the one boundary.
 */
const TEMPLATE_TO_DB: Record<TemplateKey, $Enums.EmailTemplate> = {
  Confirmation: "Confirmation",
  Reminder: "Reminder",
  "Ready for collection": "ReadyForCollection",
  "Follow-up": "FollowUp",
}

export const TEMPLATE_FROM_DB: Record<$Enums.EmailTemplate, TemplateKey> = {
  Confirmation: "Confirmation",
  Reminder: "Reminder",
  ReadyForCollection: "Ready for collection",
  FollowUp: "Follow-up",
}

/** Which message each status triggers. Statuses absent from this map send none. */
const TRIGGERS: Partial<Record<OrderStatus, TemplateKey>> = {
  Confirmed: "Confirmation",
  // Scheduled produces the reminder, which is date-triggered rather than
  // status-triggered: it is written now, dated, and left Pending.
  Scheduled: "Reminder",
  "Ready for collection": "Ready for collection",
  "Collected or delivered": "Follow-up",
}

export async function renderEmailsForStatus(
  tx: Tx,
  orderId: string,
  status: OrderStatus,
  triggeredByEventId?: number
): Promise<void> {
  // A cancelled order should not go on to be reminded about.
  if (status === "Cancelled") {
    await tx.emailMessage.updateMany({
      where: { orderId, status: "Pending" },
      data: { status: "Suppressed", suppressedReason: "Order was cancelled" },
    })
    return
  }

  const template = TRIGGERS[status]
  if (!template) return

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { customer: true, items: { include: { variant: true } } },
  })
  if (!order) return

  const item = order.items[0]
  const settings = await readCalendarSettings(tx)

  // The reminder is the only message with a future send date: the day before
  // collection. If that day has already passed there is nothing to remind about,
  // so it is suppressed rather than logged as due in the past.
  // The day before collection, counted in shop days and turned back into a
  // moment here. Subtracting 24 hours from the stored instant would drift by an
  // hour across a clocks-change and could land on the wrong calendar day.
  const collectionDay = shopDayOf(order.collectionDate)
  const reminderDay = template === "Reminder" ? addShopDays(collectionDay, -1) : null
  const sendAfter = reminderDay ? shopMoment(reminderDay) : null
  const reminderHasPassed =
    reminderDay !== null && compareShopDays(reminderDay, todayShopDay()) < 0

  const rendered = renderEmail(template, {
    customerName: order.customer?.name ?? "there",
    productName: item?.variant.name ?? "your order",
    servings: item?.variant.servings ?? "",
    quantity: item?.quantity ?? 1,
    collectionDate: order.collectionDate,
    totalAmount: order.totalAmount,
    amountPaid: order.amountPaid,
    shopName: settings.shopName,
    shopAddress: settings.shopAddress,
    shopPhone: settings.shopPhone,
    shopEmail: settings.shopEmail,
    shopOpeningHours: settings.shopOpeningHours,
  })

  // An order with no customer has nowhere to send to. Recorded as suppressed
  // rather than skipped, so the demo shows the message that would have gone and
  // says plainly why it did not.
  const noAddress = !order.customer?.email

  await tx.emailMessage.create({
    data: {
      orderId,
      template: TEMPLATE_TO_DB[template],
      status: noAddress
        ? "Suppressed"
        : reminderHasPassed
          ? "Suppressed"
          : sendAfter
            ? "Pending"
            : "ReadyToSend",
      suppressedReason: noAddress
        ? "No customer email on this order"
        : reminderHasPassed
          ? "Collection is too soon for a day-before reminder"
          : null,
      toName: order.customer?.name ?? "",
      toEmail: order.customer?.email ?? "",
      subject: rendered.subject,
      body: rendered.body,
      sendAfter,
      triggeredByEventId: triggeredByEventId ?? null,
    },
  })
}
