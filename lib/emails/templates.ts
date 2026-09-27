import { formatDateLong, formatTime } from "@/lib/format-date"
import { formatMoney } from "@/lib/payments"

/**
 * The four customer messages, rendered from real order data.
 *
 * Pure functions on purpose: nothing here reads the database, sends anything or
 * knows what a mail provider is. That choice is deliberately still open — the
 * behaviour is what needs agreeing first, so these produce exactly the text a
 * customer would receive and the caller decides what to do with it.
 *
 * Dates are UK format throughout, from lib/format-date, so "03/10" is never
 * read as the third of October in one place and the tenth of March in another.
 */

export type TemplateKey = "Confirmation" | "Reminder" | "Ready for collection" | "Follow-up"

export interface TemplateContext {
  customerName: string
  productName: string
  /** The variant's size wording, e.g. "Serves 8–10". */
  servings: string
  quantity: number
  collectionDate: Date
  /** Order total in pence. */
  totalAmount: number
  amountPaid: number
  shopName: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
  shopOpeningHours: string
}

export interface RenderedEmail {
  subject: string
  body: string
}

/** "2 x Suprema Classico (Serves 8–10)" — the line every message opens with. */
function orderLine(c: TemplateContext): string {
  const unit = `${c.productName} (${c.servings})`
  return c.quantity === 1 ? unit : `${c.quantity} × ${unit}`
}

function collectionLine(c: TemplateContext): string {
  return `${formatDateLong(c.collectionDate)} from ${formatTime(c.collectionDate)}`
}

function signOff(c: TemplateContext): string {
  const lines = [`— ${c.shopName}`]
  if (c.shopAddress) lines.push(c.shopAddress)
  // Phone and email on one line, so the sign-off stays three or four lines
  // rather than becoming a wall.
  const contact = [c.shopPhone, c.shopEmail].filter(Boolean).join(" · ")
  if (contact) lines.push(contact)
  if (c.shopOpeningHours) lines.push(c.shopOpeningHours)
  return lines.join("\n")
}

function confirmation(c: TemplateContext): RenderedEmail {
  const outstanding = Math.max(c.totalAmount - c.amountPaid, 0)
  const money =
    outstanding > 0
      ? `Your total is ${formatMoney(c.totalAmount)}${
          c.amountPaid > 0 ? `, of which ${formatMoney(c.amountPaid)} has been paid` : ""
        }. The balance of ${formatMoney(outstanding)} is due on collection.`
      : `Your total is ${formatMoney(c.totalAmount)}, paid in full — thank you.`

  return {
    subject: `Your ${c.shopName} order is confirmed`,
    body: [
      `Hello ${c.customerName},`,
      ``,
      `Thank you — we have your order and it is confirmed:`,
      ``,
      `  ${orderLine(c)}`,
      `  Collection: ${collectionLine(c)}`,
      ``,
      money,
      ``,
      `We will be in touch closer to the day, and again as soon as it is ready to collect.`,
      ``,
      signOff(c),
    ].join("\n"),
  }
}

function reminder(c: TemplateContext): RenderedEmail {
  return {
    subject: `Your ${c.shopName} order is ready tomorrow`,
    body: [
      `Hello ${c.customerName},`,
      ``,
      `A quick reminder that your order is due for collection tomorrow:`,
      ``,
      `  ${orderLine(c)}`,
      `  Collection: ${collectionLine(c)}`,
      ``,
      c.shopAddress ? `You will find us at ${c.shopAddress}.` : `See you then.`,
      c.shopPhone ? `If the timing no longer works, call us on ${c.shopPhone}.` : ``,
      ``,
      signOff(c),
    ]
      .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
      .join("\n"),
  }
}

function readyForCollection(c: TemplateContext): RenderedEmail {
  const outstanding = Math.max(c.totalAmount - c.amountPaid, 0)
  return {
    subject: `Your ${c.shopName} order is ready to collect`,
    body: [
      `Hello ${c.customerName},`,
      ``,
      `Good news — your order is finished and waiting for you:`,
      ``,
      `  ${orderLine(c)}`,
      `  Ready from: ${collectionLine(c)}`,
      c.shopAddress ? `  Collect from: ${c.shopAddress}` : ``,
      ``,
      outstanding > 0
        ? `There is ${formatMoney(outstanding)} left to pay when you collect.`
        : `Nothing left to pay — it is all settled.`,
      ``,
      signOff(c),
    ]
      .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
      .join("\n"),
  }
}

function followUp(c: TemplateContext): RenderedEmail {
  return {
    subject: `Thank you from ${c.shopName}`,
    body: [
      `Hello ${c.customerName},`,
      ``,
      `Thank you for collecting your ${c.productName} — we hope it was enjoyed.`,
      ``,
      `If you would like the same again, or something for a date already in the diary, just reply`,
      `to this message${c.shopPhone ? ` or call us on ${c.shopPhone}` : ""} and we will get it booked in.`,
      ``,
      signOff(c),
    ].join("\n"),
  }
}

const TEMPLATES: Record<TemplateKey, (c: TemplateContext) => RenderedEmail> = {
  Confirmation: confirmation,
  Reminder: reminder,
  "Ready for collection": readyForCollection,
  "Follow-up": followUp,
}

export function renderEmail(template: TemplateKey, context: TemplateContext): RenderedEmail {
  return TEMPLATES[template](context)
}

/** One line describing what each message is for, shown beside it in the UI. */
export const TEMPLATE_PURPOSE: Record<TemplateKey, string> = {
  Confirmation: "Sent as soon as the order is confirmed.",
  Reminder: "Sent the day before collection.",
  "Ready for collection": "Sent when the order is marked ready.",
  "Follow-up": "Sent after the order has been collected.",
}
