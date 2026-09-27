/**
 * Tables that must never be empty for the app to work.
 *
 * "Reference data" here means rows the application assumes exist: recipes to
 * order, ingredients to draw down, packages to quote from, a settings row to
 * read rules out of. They are not user content — nobody creates an ingredient
 * in the course of a day's work — so if one of these is empty, something went
 * wrong at deploy time rather than a user simply not having got round to it.
 *
 * This list exists because the same fault has now happened twice. A migration
 * creates a table empty, the seed fills it, and the seed never runs on a
 * database that already has rows — so production gets the table and not the
 * contents. It cost placeholder prices of £0.00 and then a wedding quote of £80
 * instead of £860, and nothing said a word either time.
 *
 * The rule this encodes: **every table a migration creates empty is a table the
 * seed will never fill on live.** Either the migration seeds it, or it belongs
 * here so the omission is loud.
 */

export interface ReferenceTable {
  /** Prisma model accessor, e.g. `prisma.ingredient`. */
  model: string
  /** Table name, for the message a human reads. */
  table: string
  /** What breaks when it is empty — the point of the check, not decoration. */
  consequence: string
}

export const REFERENCE_TABLES: ReferenceTable[] = [
  {
    model: "ingredient",
    table: "ingredients",
    consequence: "Stock levels and every recipe's draw are empty; nothing can be costed.",
  },
  {
    model: "productVariant",
    table: "product_variants",
    consequence: "There is nothing to order and no recipe to bake.",
  },
  {
    model: "staff",
    table: "staff",
    consequence: "Nobody can sign in and no order can be assigned.",
  },
  {
    model: "calendarSettings",
    table: "calendar_settings",
    consequence:
      "Collection rules, shop details and the wedding capacity stage all fall back to defaults that were never agreed.",
  },
  {
    model: "weddingPackage",
    table: "wedding_packages",
    consequence:
      "Every wedding quote silently loses its base price — this is exactly how a £860 quote came out at £80.",
  },
  {
    model: "weddingExtra",
    table: "wedding_extras",
    consequence:
      "Pots, cannoli and delivery disappear from the quote builder, so those figures get typed in by hand instead of coming from the client's published prices.",
  },
]
