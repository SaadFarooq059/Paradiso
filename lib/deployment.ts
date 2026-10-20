/**
 * Whether this build runs against the shop's real data.
 *
 * Every Vercel deployment does — Production and Preview share one database (see
 * DEPLOYMENT.md) — so "on Vercel" is the test, not "is Production". Anything that
 * only makes sense on a laptop or in the test suite asks this first.
 *
 * Inlined at build time through next.config.mjs, so the browser and the server
 * read the same answer.
 */
export const isLiveData = process.env.PARADISO_LIVE_DATA === "true"
