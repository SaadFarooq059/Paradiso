import { CircleCheck, RefreshCw } from "lucide-react"

import { PreviewFrame, PreviewNote } from "@/components/dashboard/preview-frame"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const INVOICE_LINES = [
  { label: "Suprema Classico", qty: "2", unit: "£42.00", amount: "£84.00" },
  { label: "Grande Classico", qty: "2", unit: "£24.00", amount: "£48.00" },
]

export function PreviewAccountsSyncPanel() {
  return (
    <PreviewFrame note="Illustrative only. Nothing is connected to Zoho, and no invoice has been created or sent.">
      <Card>
        <CardHeader>
          <CardTitle>Invoice from a completed order</CardTitle>
          <CardDescription>
            Raised automatically when an order is marked completed, then pushed to the accounts package.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-card p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
              <div className="flex flex-col leading-tight">
                <span className="font-serif text-lg font-bold text-foreground">Paradiso</span>
                <span className="text-xs text-muted-foreground">14 Marlborough Road, London</span>
                <span className="text-xs text-muted-foreground">VAT 123 4567 89</span>
              </div>
              <div className="flex flex-col items-end leading-tight">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Invoice</span>
                <span className="font-mono text-sm tabular-nums text-foreground">INV-2026-0184</span>
                <span className="text-xs text-muted-foreground">Issued 11 June 2026</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-4 py-5">
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Billed to</span>
                <span className="text-sm text-foreground">M. Whitfield</span>
                <span className="text-xs text-muted-foreground">Collection — 11 June 2026</span>
              </div>
              <div className="flex flex-col leading-tight sm:items-end">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">From order</span>
                <span className="font-mono text-sm tabular-nums text-foreground">#A41F-2C</span>
                <span className="text-xs text-muted-foreground">Completed by Aisha</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {INVOICE_LINES.map((line) => (
                    <tr key={line.label}>
                      <td className="py-2.5 text-foreground">{line.label}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-muted-foreground">{line.qty}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-muted-foreground">{line.unit}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-foreground">{line.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col items-end gap-1 border-t border-border pt-4">
              <div className="flex w-full max-w-[16rem] justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono tabular-nums text-foreground">£132.00</span>
              </div>
              <div className="flex w-full max-w-[16rem] justify-between text-sm">
                <span className="text-muted-foreground">VAT at 20%</span>
                <span className="font-mono tabular-nums text-foreground">£26.40</span>
              </div>
              <div className="flex w-full max-w-[16rem] justify-between border-t border-border pt-2 text-sm font-semibold">
                <span className="text-foreground">Total</span>
                <span className="font-mono tabular-nums text-foreground">£158.40</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-emerald-600/50 bg-emerald-600/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CircleCheck className="size-3.5 shrink-0" />
                Synced to Zoho
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="size-3 shrink-0" />
                Example label — no integration exists yet
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <PreviewNote>
        The intent is that nobody retypes an order into the accounts package. Completing an order in this dashboard
        would be the only place the numbers are entered.
      </PreviewNote>
    </PreviewFrame>
  )
}
