"use client"

import { useState } from "react"
import { ChevronDown, Clock, Mail, MailX, Send } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { TEMPLATE_PURPOSE } from "@/lib/emails/templates"
import { formatDateLong, formatDateTime } from "@/lib/format-date"
import type { EmailStatus, OrderEmail } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * What the customer would receive, and when.
 *
 * Nothing is sent: these are rendered from the order's real data at the moment
 * the status changed, and logged. Showing them in full is the point — the
 * behaviour is what needs agreeing before a mail provider is picked, and a
 * summary would hide exactly the wording that needs checking.
 */

const STATUS_STYLE: Record<EmailStatus, { className: string; icon: typeof Mail }> = {
  "Ready to send": { className: "border-success/40 bg-success/10 text-success", icon: Send },
  Pending: { className: "border-border bg-muted text-muted-foreground", icon: Clock },
  Suppressed: { className: "border-destructive/30 bg-destructive/10 text-destructive", icon: MailX },
}

export function OrderEmailsCard({ emails }: { emails: OrderEmail[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Mail className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">Customer messages</CardTitle>
            <CardDescription>
              Triggered by this order&apos;s status. Rendered and logged — nothing is actually sent
              yet.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {emails.length === 0 ? (
          <Empty>
            <EmptyTitle>No messages yet</EmptyTitle>
            <EmptyDescription>
              Confirming, scheduling and completing an order each produce one.
            </EmptyDescription>
          </Empty>
        ) : (
          <ol className="flex flex-col gap-2">
            {emails.map((email) => (
              <EmailRow key={email.id} email={email} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function EmailRow({ email }: { email: OrderEmail }) {
  const [open, setOpen] = useState(false)
  const style = STATUS_STYLE[email.status]
  const Icon = style.icon

  // Why this message is where it is: a date for a pending one, a reason for a
  // suppressed one, the render time for one that would go out now.
  const timing =
    email.status === "Pending" && email.sendAfter
      ? `Would send on ${formatDateLong(email.sendAfter)}`
      : email.status === "Suppressed"
        ? (email.suppressedReason ?? "Will not be sent")
        : `Would send now — rendered ${formatDateTime(email.renderedAt)}`

  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50"
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{email.subject}</span>
            <Badge variant="outline" className={cn("shrink-0", style.className)}>
              {email.status}
            </Badge>
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {email.toEmail ? `To ${email.toName} <${email.toEmail}>` : "No recipient"} · {timing}
          </span>
          <span className="text-xs text-muted-foreground">{TEMPLATE_PURPOSE[email.template]}</span>
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        // Monospace and whitespace-preserved: this is the message body exactly
        // as it would arrive, not a paraphrase of it.
        <pre className="overflow-x-auto border-t border-border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap text-foreground">
          {email.body}
        </pre>
      )}
    </li>
  )
}
