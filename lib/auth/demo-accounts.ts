import type { StaffRole } from "@/lib/auth/roles"

/**
 * The demo logins, printed on the sign-in screen.
 *
 * The client is opening this and needs to switch roles to see the difference,
 * so these four are published deliberately. Be clear about what that means:
 * anyone who can read the sign-in page can sign in as any role, including
 * Admin. The live demo is therefore not access-controlled.
 *
 * That is not the same as the shared password this replaced. That was one
 * secret that let its holder *become* any user — the mechanism itself had no
 * notion of who you were. Here the mechanism is real: separate accounts,
 * separate bcrypt hashes, roles enforced per route. Only these particular
 * passwords are public, and changing them is a normal admin action rather than
 * a rewrite.
 *
 * Passwords are listed because they are already published in the seed and the
 * migration; nothing is revealed here that the demo does not intend.
 */
export interface DemoAccount {
  email: string
  password: string
  name: string
  role: StaffRole
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "aisha@paradiso.test", password: "admin-demo", name: "Aisha Bello", role: "Admin" },
  { email: "tom@paradiso.test", password: "manager-demo", name: "Tom Whitfield", role: "Manager" },
  { email: "marco@paradiso.test", password: "kitchen-demo", name: "Marco Ferrari", role: "Kitchen" },
  { email: "nadia@paradiso.test", password: "shopfloor-demo", name: "Nadia Haddad", role: "ShopFloor" },
]
