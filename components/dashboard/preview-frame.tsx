import type { ReactNode } from "react"
import { Construction } from "lucide-react"

/**
 * Wrapper for the "Coming Soon" demo mockups.
 *
 * Everything inside is a static visual — no state, no handlers, no data from the
 * real app. The dashed border, amber banner and muted ground exist so that nobody
 * watching the demo can mistake one of these screens for a built feature; keep that
 * treatment if you edit this, it is the whole point of the component.
 */
export function PreviewFrame({
  children,
  note,
}: {
  children: ReactNode
  note?: string
}) {
  return (
    <section className="rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/[0.04] p-3 sm:p-5">
      <div className="flex flex-col gap-2 border-b border-dashed border-amber-500/40 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-amber-500/60 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-400">
          <Construction className="size-3.5 shrink-0" />
          Preview — Coming Soon
        </span>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-right">
          {note ?? "Not built yet. A look at the direction only — nothing here is real data and no control works."}
        </p>
      </div>
      <div className="mt-4 sm:mt-5">{children}</div>
    </section>
  )
}

/** Muted caption used under a mock to explain what the finished thing would do. */
export function PreviewNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * A non-functional stand-in for a button. Deliberately not a <button>: these
 * mockups should not present clickable affordances to assistive tech, and it
 * keeps preview controls out of any role-based test query.
 */
export function FakeButton({
  children,
  variant = "solid",
  className = "",
}: {
  children: ReactNode
  variant?: "solid" | "outline"
  className?: string
}) {
  const base =
    "inline-flex h-9 w-fit items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium select-none"
  const look =
    variant === "solid"
      ? "bg-primary/70 text-primary-foreground"
      : "border border-dashed border-border bg-card text-muted-foreground"
  return <span className={`${base} ${look} ${className}`}>{children}</span>
}

/** A non-functional stand-in for a form field showing an example value. */
export function FakeField({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex h-9 items-center rounded-lg border border-dashed border-border bg-card px-3 text-sm text-foreground select-none">
        {value}
      </span>
      {hint && <span className="text-[0.7rem] text-muted-foreground">{hint}</span>}
    </div>
  )
}
