# Seeker Management Portal

> **"No seeker is ever lost."**

A Progressive Web App for the Sahaja Yoga volunteer community: capture every seeker once, record attendance, and run timely follow-up across email, SMS, and WhatsApp — for volunteer coordinators, instructors, and regional coordinators. Rolling out DMV → New York and Texas → all US.

## Documents

- [Product Requirements (PRD)](docs/PRD.md) — **v0.3, canonical**: vision, problem, goals and metrics, personas, requirements R1–R15, rollout, NFRs, decisions D1–D11, open questions, document history
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) — three phases: Capture (DMV) → Communicate (+NY, TX) → Anticipate (all US)
- [Data Model](docs/DATA_MODEL.md) — **v1.1**: entities, ERDs, constraints, row-level security, derived data; DDL in [db/schema.sql](db/schema.sql), behavioral tests in [db/smoke_test.sql](db/smoke_test.sql)
- [Architecture](docs/ARCHITECTURE.md) — **proposed v0.2**: decisions AD-1…AD-12, components, key flows, security, environments, cost today and one year out, phase mapping
- [Import Template](docs/IMPORT_TEMPLATE.md) — 19 columns and rules for the ~30k-row historical seeker upload (R2); CSV in [docs/assets](docs/assets/seeker-import-template.csv)
- [Accounts & Domain](docs/SETUP_ACCOUNTS.md) — what to create under the project Google account, domain candidates, per-service prerequisites and lead times
- [Development](docs/DEVELOPMENT.md) — local setup, commands, schema-change workflow, PWA testing
- [Archive](docs/archive/PRD-v0.1-2026-09-02.md) — the original v0.1 PRD from the retired Google Doc, verbatim

## Status

**Phase 1 scaffold is in place** (2026-09-23): Next.js 16 PWA shell, Supabase auth with roles under RLS, generated Supabase migration, Inngest and Sentry plumbing, CI. Nothing is deployed yet — see [docs/SETUP_ACCOUNTS.md](docs/SETUP_ACCOUNTS.md) for the accounts and domain to create first. Next slices: seeker intake (offline-first), session roster and attendance, historical import, Eventbrite backfill, center dashboard.

## Getting started

```bash
npm install
npx supabase start          # local Postgres + Auth (Docker)
cp .env.example .env.local  # paste the anon key printed above
npx supabase db reset       # migrations + synthetic seed
npm run dev                 # http://localhost:3000
```

Full instructions, commands, and the schema-change workflow: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Structure

```
seeker-management-portal/
├── src/
│   ├── app/                 routes: (auth)/login, (portal)/dashboard, auth/*, api/health, api/inngest, serwist/[path], ~offline
│   ├── proxy.ts             session refresh + route guard (Next 16 middleware)
│   ├── lib/                 supabase clients (browser / server / service-role), auth context, normalization, env
│   ├── inngest/             client, typed sendEvent, functions
│   └── modules/             one folder per domain (seekers, programs, attendance, comms, rules, import, reporting)
├── supabase/
│   ├── migrations/          generated from db/schema.sql — do not edit by hand
│   ├── seed.sql             synthetic development data
│   └── tests/               auth stub + Supabase-flavor RLS tests
├── db/
│   ├── schema.sql           readable source of truth for the schema (27 tables, RLS, triggers)
│   └── smoke_test.sql       trigger and RLS tests, run as a non-superuser
├── scripts/                 build-supabase-migration.mjs, validate-db.sh, gen-icons.py
├── .github/workflows/ci.yml typecheck · lint · test · build · migration drift · database validation
└── docs/
    ├── PRD.md · IMPLEMENTATION_PLAN.md · DATA_MODEL.md · ARCHITECTURE.md
    ├── IMPORT_TEMPLATE.md · SETUP_ACCOUNTS.md · DEVELOPMENT.md
    ├── archive/PRD-v0.1-2026-09-02.md
    └── assets/              handwritten planning notes, import template CSV
```

## Working rules

- This is a **public** repository: no real seeker data is ever committed. Samples and fixtures are synthetic.
- `docs/` is the single source of truth; there is no external copy of the PRD to keep in sync.
