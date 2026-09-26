import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"

// The Prisma 7 CLI no longer reads .env on its own (Next.js still does for the
// app itself), so load it here before the config object is evaluated.
loadEnv()

// No fallback: the database is now a Postgres server rather than a file that can
// be conjured into existence, so a missing DATABASE_URL is a configuration error
// and should say so rather than be papered over with a default.
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. The Prisma CLI needs a Postgres connection string.")
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: databaseUrl },
  migrations: { seed: "tsx prisma/seed.ts" },
})
