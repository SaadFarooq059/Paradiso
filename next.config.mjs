/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deliberately NOT ignoring build errors: `tsc --noEmit` is clean, so a real
  // type error should fail the build rather than ship.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
