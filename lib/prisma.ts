import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

/**
 * Prisma 7 takes the connection through a driver adapter rather than a `url` in
 * schema.prisma.
 *
 * This used to resolve a SQLite file path under prisma/. A hosted deploy has no
 * durable local disk — on Vercel the filesystem is ephemeral and per-invocation,
 * so a file-backed database silently loses every write — so the connection is now
 * a Postgres URL and nothing here touches the filesystem at all.
 *
 * DATABASE_URL is required. There is deliberately no fallback: a missing variable
 * should fail loudly at startup rather than quietly connect somewhere unintended.
 */
function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at a Postgres database, e.g. postgresql://user:password@host:5432/paradiso"
    )
  }
  return url
}

function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) })
}

// Next.js dev mode re-evaluates modules on every hot reload; without caching on
// globalThis each reload would open another connection pool until the database
// runs out of connections.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
