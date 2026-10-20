/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deliberately NOT ignoring build errors: `tsc --noEmit` is clean, so a real
  // type error should fail the build rather than ship.
  env: {
    // Read by lib/deployment.ts. Vercel sets VERCEL=1 on every build it runs,
    // and every one of those builds talks to the shop's real database.
    PARADISO_LIVE_DATA: process.env.VERCEL === "1" ? "true" : "false",
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
