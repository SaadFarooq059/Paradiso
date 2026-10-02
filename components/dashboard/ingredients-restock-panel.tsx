"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { PackagePlus, TriangleAlert } from "lucide-react"

import { INGREDIENT_ICONS as ICONS } from "@/components/dashboard/ingredient-icons"
import { LOW_STOCK_THRESHOLD } from "@/components/dashboard/stock-levels-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { INGREDIENT_INFO, INGREDIENT_ORDER } from "@/lib/mock-data"
import type { IngredientKey, RestockEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

interface IngredientsRestockPanelProps {
  stock: Record<IngredientKey, number>
  /** Everything ever brought into the pool; the denominator for the level bars. */
  capacity: Record<IngredientKey, number>
  restockLog: RestockEntry[]
  onRestock: (ingredient: IngredientKey, amount: number) => void
  /** Preselected when arriving from Stock Levels' Restock button. */
  initialIngredient?: IngredientKey
}

/** Typical delivery sizes, so a usual restock is one tap rather than typing. */
const PRESETS: Record<IngredientKey, number[]> = {
  eggs: [12, 30, 60, 180],
  mascarpone: [500, 1000, 2500, 5000],
  savoiardi: [400, 1000, 2000, 5000],
  coffee: [250, 500, 1000, 2000],
  butter: [250, 500, 1000, 2000],
}

function level(stock: number, capacity: number) {
  const remaining = Math.max(stock, 0)
  const ratio = capacity > 0 ? remaining / capacity : 1
  return { remaining, ratio, isLow: ratio <= LOW_STOCK_THRESHOLD }
}

export function IngredientsRestockPanel({
  stock,
  capacity,
  restockLog,
  onRestock,
  initialIngredient,
}: IngredientsRestockPanelProps) {
  const [ingredient, setIngredient] = useState<IngredientKey>(initialIngredient ?? INGREDIENT_ORDER[0])
  const [amount, setAmount] = useState("")

  const parsedAmount = Number.parseFloat(amount)
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0
  const info = INGREDIENT_INFO[ingredient]
  const current = level(stock[ingredient] ?? 0, capacity[ingredient] ?? 0)
  const after = current.remaining + (isValid ? parsedAmount : 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onRestock(ingredient, parsedAmount)
    setAmount("")
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Restock ingredients</CardTitle>
          <CardDescription>
            Pick what was delivered and add it to the pool. New orders are checked against the updated
            total — this never touches ingredients already committed to scheduled orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* The tiles are the ingredient picker, so the level is in view while choosing. */}
          <div
            role="radiogroup"
            aria-label="Ingredient"
            className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))]"
          >
            {INGREDIENT_ORDER.map((key) => {
              const Icon = ICONS[key]
              const { remaining, ratio, isLow } = level(stock[key] ?? 0, capacity[key] ?? 0)
              const selected = key === ingredient
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setIngredient(key)
                    setAmount("")
                  }}
                  className={cn(
                    "flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isLow && "border-destructive/40 bg-destructive/5",
                    selected && "border-primary bg-primary/5 ring-1 ring-primary"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {INGREDIENT_INFO[key].label}
                    </span>
                    {isLow && (
                      <Badge variant="destructive" className="gap-1">
                        <TriangleAlert data-icon="inline-start" />
                        Low
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                      {remaining.toLocaleString()}
                      {INGREDIENT_INFO[key].unit}
                    </span>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", isLow ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">available</span>
                  </div>
                </button>
              )
            })}
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 @2xl:grid-cols-[1fr_auto] @2xl:items-end"
          >
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="restock-amount">Add {info.label.toLowerCase()}</FieldLabel>
                <InputGroup className="bg-card">
                  <InputGroupInput
                    id="restock-amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="font-mono tabular-nums"
                  />
                  {info.unit && (
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{info.unit}</InputGroupText>
                    </InputGroupAddon>
                  )}
                </InputGroup>
              </Field>
              <div className="flex flex-wrap gap-2" aria-label="Quick amounts">
                {PRESETS[ingredient].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={parsedAmount === preset ? "default" : "outline"}
                    onClick={() => setAmount(String(preset))}
                    className="font-mono tabular-nums"
                  >
                    +{preset.toLocaleString()}
                    {info.unit}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 @2xl:items-end">
              <p className="font-mono text-sm tabular-nums text-muted-foreground" aria-live="polite">
                {current.remaining.toLocaleString()}
                {info.unit} →{" "}
                <span className={cn(isValid && "font-semibold text-foreground")}>
                  {after.toLocaleString()}
                  {info.unit}
                </span>
              </p>
              <Button type="submit" disabled={!isValid}>
                <PackagePlus data-icon="inline-start" />
                Add to stock
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restock log</CardTitle>
          <CardDescription>Every restock added this session, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {restockLog.length === 0 ? (
            <Empty>
              <EmptyTitle>No restocks yet</EmptyTitle>
              <EmptyDescription>Restocks you add will show up here.</EmptyDescription>
            </Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {restockLog.map((entry) => {
                const Icon = ICONS[entry.ingredient]
                const entryInfo = INGREDIENT_INFO[entry.ingredient]
                return (
                  <li key={entry.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="flex-1 font-medium text-foreground">{entryInfo.label}</span>
                    <span className="font-mono tabular-nums text-foreground">
                      +{entry.amount.toLocaleString()}
                      {entryInfo.unit}
                    </span>
                    <span className="whitespace-nowrap text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(entry.at, { addSuffix: true })}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
