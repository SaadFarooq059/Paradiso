import path from "node:path"

import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"

// The Prisma 7 CLI no longer reads .env on its own (Next.js still does for the
// app itself), so load it here before the config object is evaluated.
loadEnv()

// SQLite path is resolved against the project root rather than the schema
// directory so the CLI, the seed script and the running app all open the same
// file regardless of which of them is invoking Prisma.
const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db"

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})
