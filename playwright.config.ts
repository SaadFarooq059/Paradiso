import { config as loadEnv } from "dotenv"
import { defineConfig } from "@playwright/test"

// The suite needs DEMO_PASSWORD to sign in and RESET_TOKEN to reset between
// specs, and it runs outside Next.js, which is what normally loads .env.
loadEnv()

// A port of the suite's own. It used to default to :3000 with
// reuseExistingServer, which silently adopts whatever app happens to own that
// port — including an unrelated project — and then reports failures against the
// wrong application. It also must not adopt the developer's own dev server,
// because that one runs in local time and the point of this config is that the
// server does not.
const port = Number(process.env.PARADISO_TEST_PORT ?? 3100)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  // One SQLite file backs every spec, and each one resets it to the seed state.
  // Run them in parallel and they clobber each other: a spec reads a committed
  // figure another spec's orders produced. Serialising is the honest fix while
  // there is a single shared database.
  workers: 1,
  fullyParallel: false,
  webServer: {
    // TZ=UTC is the load-bearing part of this file.
    //
    // Production runs on Vercel, which is UTC, while the shop, the browser and
    // this test process are all Europe/London. That mismatch is what let a
    // collection date be stored a day early: every date test passed locally
    // because client and server agreed, and the disagreement only existed in
    // production. Running the server under UTC here reproduces the production
    // shape, so anything that depends on the two zones matching now fails in
    // the suite instead of in front of a customer.
    // Next 16 allows one dev server per directory, so `npm run dev` has to be
    // stopped before running the suite — it cannot adopt that one, because it
    // would be in local time and the mismatch above is the whole point.
    command: `TZ=UTC PORT=${port} npm run dev`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: { baseURL },
})
