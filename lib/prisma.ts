import path from "node:path"

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "@prisma/client"

/**
 * Prisma 7 takes the connection through a driver adapter rather than a `url` in
 * schema.prisma. The SQLite file path is resolved against the project root so the
 * app, the Prisma CLI and the seed script all open the same database no matter
 * which directory they were started from.
 */
/** The SQLite file always lives in prisma/ next to the schema and migrations. */
const DATABASE_DIR = "prisma"

function resolveDatabaseFile(): string {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db"
  const relative = url.startsWith("file:") ? url.slice("file:".length) : url
  // Joined against a literal subfolder rather than resolved from a fully dynamic
  // string: Turbopack statically analyses this call, and an unscoped path makes it
  // trace the entire project (public folder included) into the server bundle.
  return path.join(process.cwd(), DATABASE_DIR, path.basename(relative))
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: resolveDatabaseFile() }),
  })
}

// Next.js dev mode re-evaluates modules on every hot reload; without caching on
// globalThis each reload would open another SQLite connection until the process
// runs out of handles.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
