import { execFileSync } from "node:child_process"

import { expect, test } from "@playwright/test"

import { REFERENCE_TABLES } from "@/lib/reference-data"

/**
 * The check that exists because this fault has now happened three times.
 *
 * A migration creates a table; the seed fills it; the seed never runs on a
 * database that already has rows. Production therefore gets the table and not
 * the contents, and the symptom is a plausible wrong number — £0.00 prices, a
 * wedding quote of £80 instead of £860 — rather than an error anyone notices.
 *
 * The important part is WHERE this runs. Asserting against the suite's own
 * database proves nothing, because the suite seeds it. This builds a database
 * from migrations alone, which is exactly what a real deployment has, and asks
 * whether the app could work. The first time it ran it found three more empty
 * tables: ingredients, product_variants and calendar_settings.
 */

const SCRATCH_DB = "paradiso_refcheck"

function psql(database: string, sql: string) {
  return execFileSync(
    "docker",
    ["exec", "paradiso-pg", "psql", "-U", "paradiso", "-d", database, "-tAc", sql],
    { encoding: "utf8" }
  ).trim()
}

function scratchUrl(): string {
  const url = process.env.DATABASE_URL ?? ""
  return url.replace(/\/paradiso(\?|$)/, `/${SCRATCH_DB}$1`)
}

test.describe("reference data survives a migrations-only deployment", () => {
  // Building a database and running every migration takes longer than an API call.
  test.setTimeout(180_000)

  test("a database built from migrations alone has everything the app needs", () => {
    expect(process.env.DATABASE_URL, "DATABASE_URL must be set").toBeTruthy()

    psql("postgres", `DROP DATABASE IF EXISTS ${SCRATCH_DB}`)
    psql("postgres", `CREATE DATABASE ${SCRATCH_DB}`)

    try {
      const env = { ...process.env, DATABASE_URL: scratchUrl() }
      // Migrations only. Deliberately no seed — that is the whole point.
      execFileSync("npx", ["prisma", "migrate", "deploy"], { env, encoding: "utf8" })

      // Throws on a non-zero exit, which is what an empty reference table gives.
      const output = execFileSync("npx", ["tsx", "scripts/check-reference-data.ts"], {
        env,
        encoding: "utf8",
      })
      expect(output).toContain("Reference data check passed")

      // Named individually, so a failure says which table rather than just "it failed".
      for (const reference of REFERENCE_TABLES) {
        const count = Number(psql(SCRATCH_DB, `SELECT count(*) FROM "${reference.table}"`))
        expect(count, `${reference.table} is empty — ${reference.consequence}`).toBeGreaterThan(0)
      }
    } finally {
      psql("postgres", `DROP DATABASE IF EXISTS ${SCRATCH_DB}`)
    }
  })

  test("the check actually fails when a reference table is empty", () => {
    // A guard that cannot fail is not a guard. Emptying one table must break it.
    psql("postgres", `DROP DATABASE IF EXISTS ${SCRATCH_DB}`)
    psql("postgres", `CREATE DATABASE ${SCRATCH_DB}`)

    try {
      const env = { ...process.env, DATABASE_URL: scratchUrl() }
      execFileSync("npx", ["prisma", "migrate", "deploy"], { env, encoding: "utf8" })
      psql(SCRATCH_DB, `DELETE FROM "wedding_packages"`)

      let failed = false
      let message = ""
      try {
        execFileSync("npx", ["tsx", "scripts/check-reference-data.ts"], { env, encoding: "utf8" })
      } catch (error) {
        failed = true
        message = String((error as { stderr?: string }).stderr ?? "")
      }

      expect(failed, "the check should exit non-zero on an empty reference table").toBe(true)
      expect(message).toContain("wedding_packages is EMPTY")
    } finally {
      psql("postgres", `DROP DATABASE IF EXISTS ${SCRATCH_DB}`)
    }
  })
})
