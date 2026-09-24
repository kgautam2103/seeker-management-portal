@AGENTS.md

# Seeker Management Portal — project notes for agents

- Read `docs/PRD.md`, `docs/ARCHITECTURE.md`, and `docs/DATA_MODEL.md` before changing behavior. Requirements are R1–R15; decisions are D1–D11 and AD-1…AD-12.
- **Public repository.** Never commit real seeker data, secrets, or `.env*` files. Fixtures are synthetic.
- **RLS is the authority.** User-facing code uses the session client (`src/lib/supabase/server.ts`). The service-role client (`src/lib/supabase/service.ts`) is for Inngest functions and webhooks only, and every write it makes sets `center_id` explicitly.
- Schema changes: edit `db/schema.sql` (readable source of truth), run `npm run db:migration` to regenerate the Supabase migration, and `npm run db:validate` to load both against PostgreSQL 16 with the smoke tests.
- Next 16 conventions: `src/proxy.ts` (not middleware), server actions in `actions.ts` files, Turbopack; the service worker is served by `src/app/serwist/[path]/route.ts`.
- Commit as `Kumar Gautam <22.gautam@gmail.com>` (repo-local git config).
