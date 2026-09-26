import { cn } from "@/lib/utils"

/**
 * Part-to-whole as one horizontal bar plus a legend.
 *
 * Replaces a column of six separate bars, each scaled to the largest, where the
 * reader had to add them up themselves to see the shape of the whole.
 *
 * The legend is never optional. These segments are order statuses, and adjacent
 * ones share a hue family by design (Scheduled and Completed are both the
 * success hue, soft and solid), so colour alone cannot carry identity — the
 * legend names every segment and reports its count whether or not the segment is
 * wide enough to be seen.
 */
export interface StackedSegment {
  label: string
  value: number
  /** Tailwind background class for the segment and its legend swatch. */
  className: string
}

export function StackedBar({
  segments,
  emptyMessage = "Nothing to show yet.",
  className,
}: {
  segments: StackedSegment[]
  emptyMessage?: string
  className?: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const present = segments.filter((segment) => segment.value > 0)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {total === 0 ? (
        <div className="h-3 w-full rounded-full bg-muted" aria-hidden="true" />
      ) : (
        // gap-0.5 is the 2px surface gap between fills: segments are separated by
        // the card showing through, not by borders drawn around them.
        <div
          className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
          role="img"
          aria-label={present.map((s) => `${s.label}: ${s.value}`).join(", ")}
        >
          {present.map((segment) => (
            <div
              key={segment.label}
              className={cn("h-full rounded-full transition-[width] duration-500", segment.className)}
              style={{ width: `${(segment.value / total) * 100}%` }}
              title={`${segment.label}: ${segment.value} of ${total}`}
            />
          ))}
        </div>
      )}

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 @sm:grid-cols-3">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  // A segment with nothing in it keeps its place in the legend but
                  // stops claiming a colour.
                  segment.value > 0 ? segment.className : "bg-muted-foreground/25"
                )}
              />
              <span
                className={cn(
                  "truncate text-xs",
                  segment.value > 0 ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {segment.label}
              </span>
              <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                {segment.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
