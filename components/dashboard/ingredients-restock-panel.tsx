"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { PackagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { INGREDIENT_INFO, INGREDIENT_ORDER } from "@/lib/mock-data"
import type { IngredientKey, RestockEntry } from "@/lib/types"

interface IngredientsRestockPanelProps {
  stock: Record<IngredientKey, number>
  restockLog: RestockEntry[]
  onRestock: (ingredient: IngredientKey, amount: number) => void
}

export function IngredientsRestockPanel({ stock, restockLog, onRestock }: IngredientsRestockPanelProps) {
  const [ingredient, setIngredient] = useState<IngredientKey>(INGREDIENT_ORDER[0])
  const [amount, setAmount] = useState("")

  const parsedAmount = Number.parseFloat(amount)
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onRestock(ingredient, parsedAmount)
    setAmount("")
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Restock ingredients</CardTitle>
          <CardDescription>
            Add delivered stock back into the pool. New order requests are checked against the updated
            total — this never touches ingredients already consumed by scheduled orders.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 @sm:grid-cols-[1fr_1fr_auto]">
                <Field>
                  <FieldLabel htmlFor="restock-ingredient">Ingredient</FieldLabel>
                  <Select value={ingredient} onValueChange={(value) => setIngredient(value as IngredientKey)}>
                    <SelectTrigger id="restock-ingredient" className="w-full">
                      <SelectValue placeholder="Select an ingredient">
                        {(value: string | null) =>
                          value
                            ? `${INGREDIENT_INFO[value as IngredientKey].label} · ${
                                stock[value as IngredientKey] ?? 0
                              }${INGREDIENT_INFO[value as IngredientKey].unit} available`
                            : "Select an ingredient"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {INGREDIENT_ORDER.map((key) => (
                        <SelectItem key={key} value={key}>
                          {INGREDIENT_INFO[key].label} · {stock[key] ?? 0}
                          {INGREDIENT_INFO[key].unit} available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="restock-amount">
                    Amount to add{INGREDIENT_INFO[ingredient].unit ? ` (${INGREDIENT_INFO[ingredient].unit})` : ""}
                  </FieldLabel>
                  <Input
                    id="restock-amount"
                    type="number"
                    min={0}
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={!isValid}>
              <PackagePlus data-icon="inline-start" />
              Add to stock
            </Button>
          </CardFooter>
        </form>
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
            <ul className="flex flex-col gap-2">
              {restockLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <span className="font-medium text-foreground">
                    +{entry.amount}
                    {INGREDIENT_INFO[entry.ingredient].unit} {INGREDIENT_INFO[entry.ingredient].label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(entry.at, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
