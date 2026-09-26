"use client"

import { useState } from "react"
import { Banknote, Undo2, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/format-date"
import { formatMoney, parseMoney } from "@/lib/payments"
import type { Order, PaymentState } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The money side of an order.
 *
 * Separate from the lifecycle card because it is a separate dimension: paying
 * for an order does not move it along, and refunding one does not un-make it.
 * The two only meet in "Cancel and refund", which records both events rather
 * than one action pretending to be both.
 */

const STATE_CLASS: Record<PaymentState, string> = {
  Unpaid: "border-border bg-muted text-muted-foreground",
  "Payment received": "border-success/40 bg-success/10 text-success",
  "Partially refunded": "border-destructive/30 bg-destructive/10 text-destructive",
  Refunded: "border-destructive/40 bg-destructive text-destructive-foreground",
}

export function OrderPaymentCard({
  order,
  canCancel,
  onAction,
}: {
  order: Order
  canCancel: boolean
  onAction: (action: string, payload?: Record<string, unknown>) => void
}) {
  const { total, paid, refunded, state, events } = order.payment
  const outstanding = Math.max(total - paid, 0)
  const refundable = Math.max(paid - refunded, 0)

  const [amount, setAmount] = useState("")
  const pence = parseMoney(amount)
  const amountIsValid = pence !== null && pence > 0

  function submit(action: string, ceiling: number) {
    if (!amountIsValid || pence === null) return
    if (pence > ceiling) return
    onAction(action, { amount: pence })
    setAmount("")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Payment</CardTitle>
            <CardDescription>Recorded against this order, in pounds.</CardDescription>
          </div>
          <Badge variant="outline" className={cn("shrink-0", STATE_CLASS[state])}>
            {state}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm @sm:grid-cols-4">
          <Figure label="Total" value={formatMoney(total)} />
          <Figure label="Paid" value={formatMoney(paid)} />
          <Figure label="Refunded" value={formatMoney(refunded)} />
          <Figure
            label={refunded > 0 ? "Net" : "Outstanding"}
            value={formatMoney(refunded > 0 ? paid - refunded : outstanding)}
            emphasis={outstanding > 0 && refunded === 0}
          />
        </dl>

        <div className="flex flex-wrap items-end gap-2">
          <Field className="w-32">
            <FieldLabel htmlFor="payment-amount">Amount</FieldLabel>
            <Input
              id="payment-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={amount.trim() !== "" && !amountIsValid}
            />
          </Field>

          <Button
            variant="outline"
            disabled={!amountIsValid || outstanding === 0 || (pence ?? 0) > outstanding}
            onClick={() => submit("pay", outstanding)}
          >
            <Banknote data-icon="inline-start" />
            Record payment
          </Button>

          <Button
            variant="outline"
            disabled={!amountIsValid || refundable === 0 || (pence ?? 0) > refundable}
            onClick={() => submit("refund", refundable)}
          >
            <Undo2 data-icon="inline-start" />
            Record refund
          </Button>

          {/* The common case as one click. It records two events, because the
              cancel is what frees the ingredients and the refund only moves
              money — collapsing them into one would lose that distinction. */}
          {canCancel && (
            <Button
              variant="destructive"
              disabled={!amountIsValid || refundable === 0 || (pence ?? 0) > refundable}
              onClick={() => submit("cancel-and-refund", refundable)}
            >
              <XCircle data-icon="inline-start" />
              Cancel and refund
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          A refund never releases ingredients on its own. If the cake is not to be made either,
          cancel the order — that is what frees the kitchen.
        </p>

        {events.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Ledger</h3>
            <ol className="space-y-1.5">
              {events.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        event.kind === "Refund" ? "text-destructive" : "text-success"
                      )}
                    >
                      {event.kind === "Refund" ? "−" : "+"}
                      {formatMoney(event.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(event.at)} · {event.actorName ?? "author unknown"}
                    </span>
                  </span>
                  {event.note && (
                    <span className="truncate text-xs text-muted-foreground">{event.note}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Figure({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-sm tabular-nums",
          emphasis ? "font-semibold text-foreground" : "text-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
