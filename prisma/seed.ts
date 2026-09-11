import { config as loadEnv } from "dotenv"

loadEnv()

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
