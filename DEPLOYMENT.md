# Deploying Paradiso CRM

The app is a single Next.js application — the UI and the API routes are the same
process on the same port. There is no separate backend to deploy.

## Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Postgres connection string, e.g. `postgresql://user:password@host:5432/paradiso?schema=public`. There is no fallback — the app throws on startup if it is missing, rather than quietly connecting somewhere unintended. |
| `DEMO_PASSWORD` | **Yes** | The single shared password for the demo gate, checked server-side. If unset, sign-in is **disabled** and nobody can get in — it fails closed, so a misconfigured deployment locks everyone out rather than letting everyone in. |
| `RESET_TOKEN` | No | Bearer token for `POST /api/reset` out of band (the test suite uses it). If unset, that path does not exist and only a signed-in admin can reset. |

Two optional ones exist for tooling:

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

## The demo gate

This is a gate, not an authentication system, and the difference matters if
anyone asks.

Everyone shares one password (`DEMO_PASSWORD`), checked on the server. Having
entered it you pick which of the seed staff you are, and your role comes from
that roster — so "admin" still means what it meant, it is just no longer
self-declared by the browser. The session is an httpOnly cookie signed with an
HMAC keyed on the password itself, which means there is no second secret to
configure and changing the password invalidates every existing session.

Every data route enforces this independently of the UI. Hiding the admin screens
in the sidebar is a convenience; `POST /api/settings` returns 403 to a non-admin
whether or not the screen was visible.

What it deliberately is **not**: per-user credentials, password hashing with a
work factor, rotation, lockout, or a session store. Anything real replaces this
wholesale rather than building on it. It is appropriate for a dummy-data demo on
a shared link and nothing more — do not put real customer data behind it.

`POST /api/reset` wipes the database back to seed. It takes either a signed-in
admin (which is how the sidebar button reaches it — no secret is shipped to the
browser) or `RESET_TOKEN` as a bearer token. With `RESET_TOKEN` unset the token
path returns 404 rather than falling back to "no token required".

## Notes

- `next build` type-checks. `typescript.ignoreBuildErrors` is off, so a real type
  error fails the build rather than shipping.

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
