import { defineConfig } from "@playwright/test"

// Port is overridable so the suite can target an already-running dev server.
// Without this the config always pointed at :3000 with reuseExistingServer, which
// silently adopts whatever app happens to own that port — including an unrelated
// project — and then reports failures against the wrong application.
const port = Number(process.env.PARADISO_TEST_PORT ?? 3000)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  webServer: {
    command: `PORT=${port} npm run dev`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: { baseURL },
})
