"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ProductArt } from "@/components/dashboard/product-art"
import { INGREDIENT_INFO, INGREDIENT_ORDER } from "@/lib/mock-data"
import type { IngredientKey, ProductVariant } from "@/lib/types"
import { slugify } from "@/lib/utils"

interface ProductsRecipesPanelProps {
  variants: ProductVariant[]
  onSave: (variant: ProductVariant) => void
  onDelete: (variantId: string) => void
}

type FormState = {
  id: string
  name: string
  description: string
  servings: string
  amounts: Record<IngredientKey, string>
}

function emptyAmounts(): Record<IngredientKey, string> {
  return Object.fromEntries(INGREDIENT_ORDER.map((key) => [key, ""])) as Record<IngredientKey, string>
}

function toFormState(variant: ProductVariant | null): FormState {
  if (!variant) {
    return { id: "", name: "", description: "", servings: "", amounts: emptyAmounts() }
  }
  const amounts = emptyAmounts()
  for (const key of INGREDIENT_ORDER) {
    const amount = variant.requires[key]
    if (amount) amounts[key] = String(amount)
  }
  return {
    id: variant.id,
    name: variant.name,
    description: variant.description,
    servings: variant.servings,
    amounts,
  }
}

export function ProductsRecipesPanel({ variants, onSave, onDelete }: ProductsRecipesPanelProps) {
  const [editing, setEditing] = useState<FormState | null>(null)

  function startEdit(variant: ProductVariant | null) {
    setEditing(toFormState(variant))
  }

  function handleSave() {
    if (!editing || !editing.name.trim()) return

    let id = editing.id
    if (!id) {
      const base = slugify(editing.name) || "variant"
      id = base
      let suffix = 2
      while (variants.some((v) => v.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }

    const requires: ProductVariant["requires"] = {}
    for (const key of INGREDIENT_ORDER) {
      const parsed = Number.parseFloat(editing.amounts[key])
      if (Number.isFinite(parsed) && parsed > 0) requires[key] = parsed
    }

    onSave({
      id,
      name: editing.name.trim(),
      description: editing.description.trim(),
      servings: editing.servings.trim(),
      requires,
    })
    setEditing(null)
  }

  return (
    <div className="max-w-3xl space-y-4">
      {!editing && (
        <Button onClick={() => startEdit(null)}>
          <Plus data-icon="inline-start" />
          Add new recipe
        </Button>
      )}

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>{editing.id ? "Edit recipe" : "New recipe"}</CardTitle>
            <CardDescription>
              Changes apply to orders placed from now on. Orders already scheduled keep the ingredient
              amounts they were created with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 @sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="variant-name">Name</FieldLabel>
                  <Input
                    id="variant-name"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="variant-servings">Servings</FieldLabel>
                  <Input
                    id="variant-servings"
                    placeholder="e.g. Serves 4–6"
                    value={editing.servings}
                    onChange={(e) => setEditing({ ...editing, servings: e.target.value })}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="variant-description">Description</FieldLabel>
                <Input
                  id="variant-description"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>Recipe (per unit)</FieldLabel>
                <div className="grid gap-3 @sm:grid-cols-3">
                  {INGREDIENT_ORDER.map((key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label htmlFor={`amount-${key}`} className="text-xs text-muted-foreground">
                        {INGREDIENT_INFO[key].label}
                        {INGREDIENT_INFO[key].unit ? ` (${INGREDIENT_INFO[key].unit})` : ""}
                      </label>
                      <Input
                        id={`amount-${key}`}
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={editing.amounts[key]}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            amounts: { ...editing.amounts, [key]: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleSave} disabled={!editing.name.trim()}>
              Save recipe
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              <X data-icon="inline-start" />
              Cancel
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-3 @sm:grid-cols-2">
        {variants.map((variant) => (
          <Card key={variant.id}>
            <CardContent className="flex gap-3 pt-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-muted to-muted/30">
                <ProductArt productId={variant.id} className="size-11" />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{variant.name}</p>
                    <p className="text-xs text-muted-foreground">{variant.servings}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(variant)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDelete(variant.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {INGREDIENT_ORDER.filter((key) => variant.requires[key]).map((key) => (
                    <Badge key={key} variant="secondary" className="font-normal">
                      {variant.requires[key]}
                      {INGREDIENT_INFO[key].unit} {INGREDIENT_INFO[key].label.toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
