// Side-effect import, and it must stay first.
//
// ES imports are hoisted and evaluated in order, so a `loadEnv()` *call* placed
// above the other imports still runs after them — lib/prisma would be evaluated,
// and read DATABASE_URL, before dotenv had put it there. That was invisible while
// lib/prisma fell back to a local SQLite file; with Postgres there is nothing
// sensible to fall back to, so the seed simply failed to connect.
import "dotenv/config"

import { prisma } from "../lib/prisma"
import { seedDatabase } from "../lib/server/seed-data"

seedDatabase()
  .then(async (counts) => {
    console.log("Seeded:", counts)
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
