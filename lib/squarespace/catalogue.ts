/**
 * Which Squarespace products are which portal recipes.
 *
 * Deliberately narrow. The shop sells far more than the portal has recipes for —
 * pots, dishes, Number-misù, cannoli, seasonal flavours, merch — and a product
 * that is matched to the wrong recipe books the wrong ingredients on the wrong
 * day without anyone noticing. So a product is matched only when both its
 * flavour and its size are certain; everything else is reported, not guessed.
 *
 * Squarespace names the size option three different ways across products
 * ("Tiramisù Cake Size", "Tiramisù cake sizes", "Size"), so the size is read
 * from the option's *value*, which is consistent: it starts with the portal's
 * own size name.
 */

export type CatalogueMatch =
  | { kind: "recipe"; variantId: string; note: string | null }
  | { kind: "no-recipe"; reason: string }
  | { kind: "needs-mapping"; reason: string }

type Option = { optionName?: string; value?: string }

const SIZES = ["mini", "grande", "suprema"] as const
type Size = (typeof SIZES)[number]

/** Product names (and what they mean) for the cakes the portal has recipes for. */
const CAKES: { name: RegExp; flavour: string; note?: (options: Option[]) => string | null }[] = [
  { name: /^classico tiramis[uù] cake/i, flavour: "classico" },
  {
    name: /^halloween classico tiramis[uù] cake/i,
    flavour: "classico",
    // Same cake, decorated. The kitchen needs to know which decoration.
    note: (options) => {
      const decoration = options.find((o) => /halloween/i.test(o.optionName ?? ""))?.value
      return `Halloween decoration${decoration ? `: ${decoration}` : ""}`
    },
  },
  { name: /^pistacchio and nutella tiramis[uù] cake/i, flavour: "pistacchio-nutella" },
  { name: /^biscoff tiramis[uù] cake/i, flavour: "biscoff" },
  { name: /^oreo & white chocolate-mis[uù] cake/i, flavour: "oreo-white-chocolate" },
]

/** "Mini-misù Cake (6")" carries its flavour as an option instead of in its name. */
const MINI_BY_FLAVOUR_OPTION: [RegExp, string][] = [
  [/^classico/i, "classico"],
  [/^biscoff/i, "biscoff"],
  [/^pistach?io/i, "pistacchio-nutella"],
]

/**
 * Sold as one size on Squarespace, at a price that matches none of the portal's
 * sizes, so which recipe they are cannot be inferred. Needs the shop to say.
 */
const UNSIZED = /^(vegan classico|gf classico)$/i

function sizeOf(options: Option[]): Size | null {
  for (const option of options) {
    const match = /^(mini|grande|suprema)-mis/i.exec(option.value?.trim() ?? "")
    if (match) return match[1].toLowerCase() as Size
  }
  return null
}

export function matchProduct(productName: string, options: Option[] = []): CatalogueMatch {
  const name = productName.trim()

  if (UNSIZED.test(name)) {
    return { kind: "needs-mapping", reason: "sold as one size on Squarespace — which portal size is it?" }
  }

  if (/^mini-mis[uù] cake/i.test(name)) {
    const flavourValue = options.find((o) => !/^(mini|grande|suprema)-mis/i.test(o.value ?? ""))?.value ?? ""
    const flavour = MINI_BY_FLAVOUR_OPTION.find(([pattern]) => pattern.test(flavourValue))?.[1]
    if (!flavour) return { kind: "needs-mapping", reason: `unknown Mini-misù flavour "${flavourValue}"` }
    return { kind: "recipe", variantId: `mini-${flavour}`, note: null }
  }

  const cake = CAKES.find((candidate) => candidate.name.test(name))
  if (!cake) return { kind: "no-recipe", reason: "no portal recipe for this product yet" }

  const size = sizeOf(options)
  if (!size) return { kind: "needs-mapping", reason: "no Mini/Grande/Suprema size on the order" }

  return { kind: "recipe", variantId: `${size}-${cake.flavour}`, note: cake.note?.(options) ?? null }
}
