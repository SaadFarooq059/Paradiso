import { ArrowRight, HeartHandshake } from "lucide-react"

import { FakeButton, FakeField, PreviewFrame, PreviewNote } from "@/components/dashboard/preview-frame"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const QUOTE_LINES = [
  { label: "Suprema Classico × 6", detail: "Tiered display, 8–10 servings each", amount: "£252.00" },
  { label: "Mini Classico × 20", detail: "Individual portions, gluten-free", amount: "£170.00" },
  { label: "Delivery & setup", detail: "Within 15 miles", amount: "£45.00" },
]

export function PreviewWeddingEnquiriesPanel() {
  return (
    <PreviewFrame note="A concept for how wedding work would arrive and be quoted. No form is live and no quote is real.">
      <div className="grid gap-4 @3xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartHandshake className="size-4 shrink-0 text-muted-foreground" />
              Enquiry form
            </CardTitle>
            <CardDescription>What a couple would fill in on the website.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FakeField label="Wedding date" value="Saturday 12 July 2026" />
              <FakeField label="Guest count" value="120" />
            </div>
            <FakeField label="Flavours" value="Classico, Pistachio" hint="Multiple choices allowed" />
            <FakeField
              label="Dietary needs"
              value="4 gluten-free, 2 nut allergy"
              hint="Flows through to the kitchen sheet"
            />
            <FakeField label="Venue" value="Hedingham Castle, Essex" />
            <FakeButton>Send enquiry</FakeButton>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quote &amp; deposit</CardTitle>
            <CardDescription>What the shop sends back, and what the couple pays to confirm.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col divide-y divide-border rounded-lg border border-dashed border-border">
              {QUOTE_LINES.map((line) => (
                <div key={line.label} className="flex items-start justify-between gap-3 px-3.5 py-3">
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium text-foreground">{line.label}</span>
                    <span className="text-xs text-muted-foreground">{line.detail}</span>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-foreground">{line.amount}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3.5 py-3">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">£467.00</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 px-3.5 py-3">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-foreground">Deposit to confirm (25%)</span>
                <span className="text-xs text-muted-foreground">Balance due 7 days before</span>
              </div>
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">£116.75</span>
            </div>

            <FakeButton>Pay deposit</FakeButton>
          </CardContent>
        </Card>
      </div>

      {/* Hand-off back into the real product: styled like the live Order Detail header. */}
      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            Deposit paid
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Becomes a normal tracked order from here
          </span>
          <span className="text-sm text-muted-foreground">
            — same Order Detail screen, same stock check, same staff assignment as any other order.
          </span>
        </CardContent>
      </Card>

      <PreviewNote>
        The point of this screen: weddings stop living in an inbox. Once the deposit is paid there is nothing special
        about the order any more, which is why it hands straight back to the parts of the system that already work.
      </PreviewNote>
    </PreviewFrame>
  )
}
