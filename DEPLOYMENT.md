# Deploying Paradiso CRM

The app is a single Next.js application — the UI and the API routes are the same
process on the same port. There is no separate backend to deploy.

## Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Postgres connection string, e.g. `postgresql://user:password@host:5432/paradiso?schema=public`. There is no fallback — the app throws on startup if it is missing, rather than quietly connecting somewhere unintended. |

That is the only one the application needs. Two optional ones exist for tooling:

| Variable | Used by | Default |
| --- | --- | --- |
| `PARADISO_TEST_PORT` | the Playwright suite | `3000` |
| `PORT` | `next dev` / `next start` | `3000` |

If the host requires a pooled connection (most serverless Postgres does), point
`DATABASE_URL` at the **pooled** endpoint. If migrations then fail — poolers
usually cannot run DDL — give the migration step the **direct** endpoint instead,
which is what `db:deploy` below wants.

## First deploy

```bash
npm run build      # runs `prisma generate` first — the client is generated code
                   # and will not exist in a clean checkout without it
npm run db:deploy  # applies migrations to the target database
npm run db:seed    # optional: loads the demo roster, recipes and stock
npm run start
```

`db:seed` is destructive by design — it clears the tables it owns and rewrites
them from `lib/mock-data.ts`, so a fresh database always comes up with the same
dummy data. Do not run it against a database holding real orders.

## Before this is shared with the client

Three things are fine for a local demo and are **not** fine on a URL other people
can reach. None of them are Postgres-related; the move to Postgres just makes
them reachable.

- **`POST /api/reset` wipes the database and has no authentication.** Anyone who
  knows the URL can erase everything. It needs a guard, or removing, before the
  app is shared.
- **Authentication is a stub.** Signing in means picking a name from a dropdown;
  the password field is not checked at all, and the session is a staff id in
  `sessionStorage`. There is no real access control — the admin-only screens are
  hidden, not protected.
- **`next.config.mjs` sets `typescript.ignoreBuildErrors: true`**, so a type
  error will not fail the build. `tsc --noEmit` is currently clean, so this can
  be turned off safely whenever you want the build to start catching them.

## Notes

- Migration history was recreated for Postgres. The previous migrations were
  SQLite-only SQL (`PRAGMA`, `AUTOINCREMENT`, `REAL`) and could not run here, so
  they were replaced by a single `init`. Anyone still holding a local
  `prisma/dev.db` should treat it as gone — it was demo data rebuilt from
  constants anyway.
- A local Postgres for development:

  ```bash
  docker run -d --name paradiso-pg \
    -e POSTGRES_USER=paradiso -e POSTGRES_PASSWORD=paradiso -e POSTGRES_DB=paradiso \
    -p 55432:5432 postgres:17-alpine
  ```

  then put the matching `DATABASE_URL` in `.env` (gitignored).
