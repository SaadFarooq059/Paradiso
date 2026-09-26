import { cn } from "@/lib/utils"

/**
 * A single ratio against a limit.
 *
 * This is the right form when each row has its own denominator — five
 * ingredients measured in eggs, grams and millilitres cannot share one axis, but
 * each can be shown against its own stock. Putting them on a shared maximum
 * instead compares quantities that have no common unit, which is what this
 * replaced.
 */
export interface MeterProps {
  label: string
  /** Right-aligned figure, pre-formatted with its unit. */
  valueLabel: string
  /** 0–1. Values above 1 render as over-committed. */
  ratio: number
  /** Sits under the label — the denominator, usually. */
  sublabel?: string
  leading?: React.ReactNode
  /** Tailwind background class for the fill. Defaults to the primary hue. */
  fillClass?: string
  className?: string
}

export function Meter({
  label,
  valueLabel,
  ratio,
  sublabel,
  leading,
  fillClass = "bg-primary",
  className,
}: MeterProps) {
  const over = ratio > 1
  const width = Math.min(Math.max(ratio, 0), 1) * 100
  const percent = Math.round(ratio * 100)

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {leading}
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {/* Text wears text tokens, never the fill colour — the bar carries identity. */}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{valueLabel}</span>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label={label}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`${label}: ${valueLabel}${sublabel ? ` (${sublabel})` : ""}`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              over ? "bg-destructive" : fillClass
            )}
            style={{ width: `${over ? 100 : width}%` }}
          />
        </div>

        {sublabel && (
          <span className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
