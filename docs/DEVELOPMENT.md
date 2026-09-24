# Development

## Prerequisites

- Node.js 22+ (the repo is developed on 26), npm
- Docker Desktop (for the local Supabase stack and database validation)
- No Supabase CLI install needed — the repo uses `npx supabase`

## First run

```bash
npm install
npx supabase start                 # local Postgres + Auth + Studio in Docker; prints URLs and keys
cp .env.example .env.local         # then paste the anon key from the previous command
npx supabase db reset              # applies supabase/migrations and supabase/seed.sql
npm run dev                        # http://localhost:3000
```

In a second terminal, the local Inngest dev server discovers the app's functions at `/api/inngest`:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Supabase Studio runs at `http://127.0.0.1:54323`; local magic-link emails are caught by the bundled mail catcher (Mailpit) at `http://127.0.0.1:54324`.

## Signing in and getting a role

1. Open `http://localhost:3000/login`, enter your email, and open the link from the local mail catcher.
2. The auth-user mirror trigger creates your `app_user` row. Grant yourself admin in Studio's SQL editor:
   ```sql
   insert into role_assignment (user_id, role) values ('<your auth user id>', 'admin');
   ```
   (Sign-in is restricted to existing users — `shouldCreateUser: false`. For local development, create the user first in Studio → Authentication, or temporarily allow sign-ups in `supabase/config.toml`.)

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Next.js |
| `npm run typecheck` / `npm run lint` / `npm test` | What CI runs |
| `npm run db:migration` | Regenerate `supabase/migrations/…_initial.sql` from `db/schema.sql` |
| `npm run db:validate` | Load `db/schema.sql` + smoke test, then the Supabase migration + RLS tests, against PostgreSQL 16 in Docker |
| `npm run db:types` | Generate `src/lib/supabase/database.types.ts` from the local database (requires `supabase start`) |
| `npm run icons` | Regenerate placeholder PWA icons |

## Changing the schema

`db/schema.sql` is the readable source of truth for the initial schema. Edit it, run `npm run db:migration`, then `npm run db:validate`. CI fails if the committed migration does not match the regenerated one. Once the schema is live in production, new changes go in as additional migration files instead.

## Testing the PWA

- Chrome → DevTools → Application → Service Workers shows the worker served from `/serwist/sw.js`.
- "Install" from the address bar; on iOS use Share → Add to Home Screen.
- DevTools → Network → Offline, then navigate: cached pages load, others fall back to `/~offline`.

## Layout

```
src/
  app/                 routes: (auth)/login, (portal)/dashboard, auth/*, api/*, serwist/[path], ~offline, manifest
  proxy.ts             session refresh + route guard (Next 16's middleware)
  lib/supabase/        client (browser), server (session, RLS), service (jobs/webhooks only)
  lib/auth/            getUserContext(): roles and centers for the signed-in user
  lib/normalize/       phone (E.164), country (ISO-2), US state — with tests
  inngest/             client + functions; served at /api/inngest
  modules/             one folder per domain (see modules/README.md)
supabase/              config, migrations (generated), seed (synthetic), tests (auth stub + RLS)
db/                    schema.sql, smoke_test.sql
scripts/               migration builder, db validation, icon generator
```
