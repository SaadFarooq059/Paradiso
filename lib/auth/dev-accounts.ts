import type { StaffRole } from "@/lib/auth/roles"

/**
 * Local sign-ins for development and the test suite. NOT the client's accounts.
 *
 * These exist so `prisma/seed.ts` can produce a database someone can actually
 * sign in to, and so the Playwright suite has a credential per role. They are
 * written by the seed, which refuses to run against a database that has rows,
 * so they never reach production — live passwords are set once by migration and
 * are not in this repository.
 *
 * Nothing renders these. The sign-in screen used to list them, which meant
 * anyone with the URL was one click from Admin; once real people had accounts
 * that made the role enforcement decorative, so the list is gone.
 */
export interface DevAccount {
  email: string
  password: string
  name: string
  role: StaffRole
}

export const DEV_ACCOUNTS: DevAccount[] = [
  { email: "mattia@paradiso.test", password: "admin-dev", name: "Mattia Paradiso", role: "Admin" },
  { email: "marco-paradiso@paradiso.test", password: "manager-dev", name: "Marco Paradiso", role: "Manager" },
  { email: "kitchen@paradiso.test", password: "kitchen-dev", name: "Kitchen", role: "Kitchen" },
  { email: "shopfloor@paradiso.test", password: "shopfloor-dev", name: "Shop floor", role: "ShopFloor" },
]
