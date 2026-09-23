# Architecture — Seeker Management Portal

**Status:** Proposed v0.2 — for KG's review · **Date:** 2026-09-23 · Incorporates the answers to the PRD's open questions (PRD D4–D11) · **Inputs:** [PRD.md](PRD.md) (R1–R15, NFRs), [DATA_MODEL.md](DATA_MODEL.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

Decisions marked **AD-n** are proposals. Section 12 lists the ones that need an explicit yes before implementation starts.

-----

## 1. What the architecture must optimize for

Taken from the PRD's non-functional requirements, in priority order:

1. **Near-zero operations.** Volunteer-run, no IT staff. Every component is a managed service with a free tier; nothing self-hosted; nothing that needs patching.
2. **One codebase, installable on any phone.** PWA only. Instructor and volunteer flows must work offline and sync later.
3. **Privacy by construction.** Center-scoped access enforced in the database (RLS), not only in application code; suppression enforced by trigger; personal data minimized; remarks never leave the portal.
4. **Cheap at small scale, no rewrite at larger scale.** Free tiers today; the same architecture on paid tiers if the community grows.
5. **Replaceable edges.** Email, messaging, LLM, and Eventbrite sit behind thin interfaces so a provider can change without touching domain logic.
6. **US-first, region by region.** DMV pilot, then New York and Texas, then all US; ~30,000 historical seekers on day one. Sized for tens of thousands of seekers and hundreds of centers without re-architecture.

-----

## 2. System context

```mermaid
flowchart LR
  subgraph Users
    VC[Volunteer coordinator]
    IN[Instructor]
    RC[Regional coordinator]
    SK[Seeker]
  end
  subgraph Portal["Seeker Management Portal"]
    PWA["PWA — Next.js app<br/>service worker, offline outbox"]
    API["Server actions & API routes<br/>webhooks, signed public links"]
    JOBS["Background jobs — Inngest<br/>sync, sends, rules, nightly recompute"]
    DB[("Supabase Postgres<br/>RLS · Auth · Storage")]
  end
  EB[Eventbrite]
  EM["Email — Resend"]
  MS["Messaging — Twilio<br/>SMS / WhatsApp"]
  LLM["Claude API"]
  WP["Web Push"]
  VC & IN & RC --> PWA
  SK -- "signed links: testimonial, unsubscribe" --> API
  PWA --> API --> DB
  JOBS --> DB
  EB -- webhook --> API
  JOBS -- "sync every 15 min" --> EB
  JOBS --> EM & MS & LLM & WP
  EM & MS -- "delivery events" --> API
```

Seekers never log in. They reach the portal only through signed, expiring links in messages (submit a testimonial, manage preferences, unsubscribe).

-----

## 3. Architecture decisions

| ID | Decision | Rationale | Alternative considered |
|---|---|---|---|
| **AD-1** | **Next.js (App Router, TypeScript) as the single application** — UI, server actions, API routes, and webhook endpoints in one deployable. | One codebase for PWA and backend; server-rendered dashboards; mature PWA tooling (Serwist); Vercel free tier for non-commercial use. | Separate SPA + API service — two deployables, more ops, no benefit at this scale. |
| **AD-2** | **Supabase** for Postgres, Auth, Storage. | The data model's RLS design maps directly to `auth.uid()`; magic-link and Google sign-in are built in; managed backups; free tier. `db/schema.sql` becomes the first Supabase migration. | Neon + Auth.js — equally good Postgres, but auth and storage become two more things to run. |
| **AD-3** | **All user-initiated data access goes through the user's session; RLS is the authority.** Server actions use a Supabase client carrying the user's JWT. The service-role key is used only inside background jobs and webhook handlers, and every such write sets `center_id` explicitly. | Access control cannot be bypassed by a forgotten `where` clause. Matches DATA_MODEL §5. | App-layer authorization only — a single missed check leaks another center's seekers. |
| **AD-4** | **Inngest** for background jobs, crons, and event-driven workflows. | Durable step functions with retries and a dashboard; crons for Eventbrite sync, nightly stage recompute, rule evaluation, retention; free tier; no queue infrastructure to run. | Supabase `pg_cron` + Edge Functions — zero extra vendors, but weaker retries/observability and harder multi-step flows. Keep as the fallback if a vendor must be cut. |
| **AD-5** | **Resend** for email, with React Email for templates. | Delivery-event webhooks (sent, delivered, opened, clicked, bounced, complained) feed R12 directly; free tier covers initial volume; one-click unsubscribe headers supported. | Postmark — stronger deliverability reputation at volume; revisit if bounce/complaint rates or volume warrant it. |
| **AD-6** | **Twilio** for both SMS and WhatsApp (both channels confirmed 2026-09-23), behind a `MessagingProvider` interface. | One vendor for both channels; STOP handling and delivery callbacks are standard. Prerequisites with lead time — A2P 10DLC brand/campaign registration for US SMS and WhatsApp Business template approval — start at the beginning of Phase 2. | Meta WhatsApp Cloud API directly — cheaper per message, WhatsApp-only, more integration work. |
| **AD-7** | **Claude API** for follow-up drafting, server-side only, inside guardrails. | Drafts are generated from an approved `template` plus a minimal seeker context (first name, program, last attendance, stage); never remarks, never other seekers. Review policy (2026-09-23): a draft from an approved template is stored `not_required` and sends; a draft from a new or changed template is stored `pending` until an admin approves the template. `generation_meta` records model and prompt version. | Rule-only templated text — simpler, but the PRD explicitly asks for dynamic content. The review queue keeps humans in control either way. |
| **AD-8** | **Offline-first instructor flows** via a service worker (Serwist) plus an IndexedDB outbox (Dexie). | Intake, attendance, and remarks write locally first with client-generated UUIDs and a `client_mutation_id`; a sync worker replays the outbox when online. Background Sync where the browser supports it (Android Chrome); retry-on-open elsewhere (iOS Safari). | Online-only forms — fails the PRD's "< 60 s on a phone, including with no connectivity". |
| **AD-9** | **Web Push (VAPID)** for instructor reminders, with email/message fallback. | Standard `web-push`; subscriptions stored in `push_subscription`. iOS requires the PWA installed to the Home Screen — part of onboarding, and the reminder job falls back to email/message when no subscription exists. | Native push — needs native apps, which are out of scope. |
| **AD-10** | **Vercel** for hosting, **Sentry** for error tracking, Inngest dashboard for job visibility, `audit_log` for domain events. | All free tiers; deploy previews per pull request; no servers. | Fly.io / Render containers — more control, more ops. |
| **AD-11** | **Signed public links** (HMAC tokens with purpose, seeker id, expiry) for seeker-facing actions. | No seeker accounts (PRD out of scope) yet secure per-seeker actions; tokens are single-purpose and expire. | Magic-link accounts for seekers — heavier, and a future option only. |
| **AD-12** | **Secrets and third-party tokens** live in Vercel environment variables; the single Eventbrite private API key (which grants access to several organizations) is a server environment variable, never stored in the database or exposed to the browser; every inbound webhook verifies the provider's signature. | Protects the highest-value secrets; webhook forgery cannot create or alter data. | Plaintext tokens in the database — unacceptable for a public-facing volunteer system. |

-----

## 4. Components

```mermaid
flowchart TB
  subgraph Client["PWA (browser / installed)"]
    UI["UI routes<br/>dashboard · seekers · sessions · campaigns · review queue · reports"]
    SW["Service worker<br/>app-shell cache · background sync"]
    OB["Offline outbox (IndexedDB)<br/>intake · attendance · remarks"]
  end
  subgraph Server["Next.js server (Vercel)"]
    SA["Server actions<br/>user JWT → RLS"]
    WH["Webhook routes<br/>/api/webhooks/eventbrite · resend · twilio"]
    PL["Public link routes<br/>/t/[token] testimonial · /p/[token] preferences"]
    DM["Domain modules<br/>seekers · programs · attendance · comms · rules · import · reporting"]
  end
  subgraph Jobs["Inngest functions"]
    J1["eventbrite/backfill — once, all organizations · eventbrite/sync — cron 15 min + webhook"]
    J2["messages/dispatch — on message.queued"]
    J3["rules/evaluate — nightly + on attendance, registration, stage change"]
    J4["seekers/recompute-stage — nightly"]
    J5["reminders/schedule — hourly"]
    J6["retention/anonymize — monthly"]
    J7["import/run — chunked import from Google Sheet or file"]
  end
  subgraph Data["Supabase"]
    PG[("Postgres + RLS<br/>db/schema.sql")]
    AU["Auth — magic link, Google"]
    ST["Storage — import files"]
  end
  UI --> SA --> DM --> PG
  OB --> SW --> SA
  WH --> DM
  PL --> DM
  DM -- "emit events" --> Jobs
  Jobs --> DM
  SA -.-> AU
  DM --> ST
```

### 4.1 Domain modules (one folder each)

| Module | Owns | Key rules |
|---|---|---|
| `seekers` | seeker, consent, duplicate candidates, merge, anonymize | Dedupe on every write path (intake, import, Eventbrite); merge preserves history; anonymize rewrites contact fields and message addresses |
| `programs` | region, center, program, session, registration, Eventbrite organizations and events | Session is the unit an Eventbrite event maps to; `eventbrite_org` gives each organization a default center |
| `attendance` | attendance, remark, roster | Marks are idempotent by `(session_id, seeker_id)` and `client_mutation_id`; a mark emits `attendance.recorded` |
| `comms` | template, campaign, message, message_event, suppression, preferences, testimonials (text or YouTube link) | Every send passes through one `enqueueMessage()`; the DB trigger is the last line of defense, this function is the first |
| `rules` | rule, rule_run, follow_up_task, AI drafting | `evaluate(trigger, seeker)` → checks cooldown and suppression → creates a message (draft or queued) or a task; one `rule_run` per `(rule, seeker, trigger_key)` |
| `import` | import_batch, import_row, Google Sheets reader, template validation, normalization (E.164, ISO-2, US state) | Chunked background job (500 rows per step) for the ~30k historical rows; never auto-merges ambiguous rows; outcomes per IMPORT_TEMPLATE.md |
| `reporting` | center dashboard, regional rollup, deliverability — SQL views | Regional reports read views only, never raw seeker rows |

### 4.2 Application layout (proposed)

```
src/
  app/
    (portal)/            authenticated UI: dashboard, seekers, sessions, campaigns, review, reports, admin
    (public)/t/[token]   testimonial form
    (public)/p/[token]   preferences / unsubscribe
    api/webhooks/{eventbrite,resend,twilio}/route.ts
    api/inngest/route.ts
  modules/{seekers,programs,attendance,comms,rules,import,reporting}/
    schema.ts            zod schemas (shared by forms, actions, importer)
    queries.ts           reads (RLS-scoped client)
    actions.ts           server actions (writes)
    events.ts            Inngest events this module emits
  jobs/                  Inngest functions (one file per function)
  lib/
    supabase/            browser client, server client, service-role client (jobs only)
    providers/           EmailProvider (Resend), MessagingProvider (Twilio SMS + WhatsApp), LlmProvider (Claude), PushProvider, EventbriteClient
    sheets/              Google Sheets reader (service account, read-only) for imports
    crypto/              token signing, Eventbrite token encryption
    normalize/           phone (E.164), country (ISO-2), US state
  offline/
    db.ts                Dexie schema: outbox, cached rosters
    outbox.ts            enqueue / replay with idempotency keys
    sync.ts              online detection, background sync registration
supabase/
  migrations/            generated from db/schema.sql, then incremental
  seed.sql               synthetic dev data only
db/                      schema.sql, smoke_test.sql (kept as the readable source of truth)
```

-----

## 5. Key flows

### 5.1 Offline intake and attendance (R1, R5)

```mermaid
sequenceDiagram
  participant V as Volunteer (PWA)
  participant OB as Outbox (IndexedDB)
  participant SA as Server action
  participant PG as Postgres (RLS)
  V->>OB: save seeker {id: uuid(), client_mutation_id}
  Note over V,OB: instant confirmation, works offline
  OB-->>SA: replay when online (Background Sync or app open)
  SA->>PG: insert … on conflict (client_mutation_id) do nothing
  PG-->>SA: created | already applied
  SA->>SA: run duplicate check → duplicate_candidate if needed
  SA-->>OB: ack → remove from outbox
```

Conflicts are last-write-wins on `updated_at`; every write is in `audit_log`, so a clobbered edit is recoverable.

### 5.2 Eventbrite backfill and sync (R3)

**Backfill (once, Phase 1):** an Inngest function walks every organization the private API key can access → every event, past and upcoming, paginated → every attendee. For each event it creates a `session` (and a public `program` under the organization's default center if none matches); for each attendee it dedupes by email/phone, upserts a `seeker` (source `eventbrite`, home center = the organization's default center), inserts a `registration` with `session_id` and `external_id` = attendee id, and records `consent` (source `eventbrite`). Progress is checkpointed per organization in `eventbrite_org.last_synced_at`, so the job is resumable and respects Eventbrite rate limits.

**Ongoing:** webhook `order.placed` → verify signature → the same per-attendee path → emit `registration.created`. The 15-minute cron reconciles missed webhooks by listing attendees changed since `last_synced_at`.

### 5.3 Sending anything (R8, R9, R6, R7)

`comms.enqueueMessage({recipient, channel, template, variables})` → render → check latest `consent` and `suppression` → insert `message` (`queued`, or `suppressed` — the DB trigger also enforces this) → emit `message.queued` → Inngest `messages/dispatch` calls the provider → stores `provider_message_id` → provider webhooks append `message_event` rows → `bounced`/`complained` events insert a `suppression` row, which cascades to `consent` by trigger.

### 5.4 Rule → AI draft → review → send (R13)

```mermaid
sequenceDiagram
  participant T as Trigger (attendance.recorded, nightly cron)
  participant R as rules/evaluate
  participant L as Claude API
  participant Q as Review queue (UI)
  participant C as comms.enqueueMessage
  T->>R: seeker, trigger, trigger_key
  R->>R: match enabled rules; skip if cooldown or suppressed → rule_run
  alt action = task
    R->>R: follow_up_task → assignee = mentor ?? center coordinator
  else action = message, template approved
    R->>L: template + minimal seeker context (no remarks)
    L-->>R: draft body
    R->>C: message {generated_by: llm, review_status: pending | not_required}
    C-->>Q: appears in review queue when pending
    Q->>C: approve → status queued → dispatch
  end
```

### 5.5 Unsubscribe (R11)

Every email carries `List-Unsubscribe` headers and a `/p/[token]` link; every message supports STOP. Both paths insert into `suppression`; the trigger records withdrawn consent. Nothing else has to remember.

### 5.6 Historical import from the Google Sheet (R2)

The steward shares the sheet with the importer's service account as Viewer, or uploads a CSV/XLSX export to Storage. `import/run` reads rows in chunks of 500 per Inngest step, normalizes (E.164, ISO-2, US state), dedupes against existing seekers, and writes an `import_row` outcome per row; the batch view shows progress and the review queue. Thirty thousand rows complete in minutes, and a re-run is safe because matched rows only fill blanks.

-----

## 6. Security and privacy

- **Authentication:** Supabase Auth — magic link and Google sign-in for admins, coordinators, instructors. `app_user.id` = auth user id. Seekers have no accounts.
- **Authorization:** `role_assignment` + RLS policies (DATA_MODEL §5). Server actions never use the service-role key. Jobs and webhooks do, and set `center_id` explicitly on every row they write.
- **Public links:** HMAC-signed tokens `{purpose, seeker_id, exp}`; single purpose; 30-day expiry for testimonials, long-lived for preferences (revocable by rotating the key). Rate-limited.
- **Webhooks:** signature verification for Eventbrite, Resend, and Twilio; idempotent handlers keyed on provider ids.
- **Secrets:** Vercel env vars; Eventbrite tokens encrypted at rest; no secrets in the repository (`.env.example` only).
- **PII minimization:** no health data, IDs, DOB, or street address anywhere in the schema; remarks are internal and excluded from LLM prompts and exports by default.
- **Auditability:** `audit_log` for exports, merges, anonymizations, bulk sends, role changes.
- **Consent posture:** no written statement at intake for now (PRD D7); `consent.text_version` stays null; opt-out via unsubscribe and STOP is unconditional. US SMS needs a lightweight opt-in for TCPA and 10DLC — built into Phase 2.
- **Browser hardening:** strict CSP, HTTPS only, secure cookies, no third-party scripts beyond Sentry.

-----

## 7. Environments and delivery

| Environment | Where | Data |
|---|---|---|
| Local | Next.js dev server + Supabase CLI local stack (Docker) + Inngest dev server | `supabase/seed.sql` — synthetic only |
| Preview | Vercel preview deployment per pull request | Shared dev Supabase project, synthetic data |
| Production | Vercel production + Supabase production project | Real data; access limited to the steward and one backup admin |

**CI (GitHub Actions) on every pull request:** typecheck, lint, unit tests; load `db/schema.sql` into a Postgres service container and run `db/smoke_test.sql` (already written); Playwright smoke test of intake and attendance including the offline path.

**Migrations:** `db/schema.sql` remains the readable source of truth for the initial schema; Supabase CLI generates `supabase/migrations/0001_initial.sql` from it, and later changes are incremental migration files reviewed in pull requests.

-----

## 8. Observability

- **Errors:** Sentry (browser + server), free tier, PII scrubbing on.
- **Jobs:** Inngest dashboard — every run, step, retry, and failure with payloads.
- **Deliverability:** `message_event` → the R12 dashboard (views in `reporting`).
- **Domain audit:** `audit_log`.
- **Uptime:** a free external ping (e.g., UptimeRobot) on `/api/health`, which also keeps the free-tier database from pausing (see §9).

-----

## 9. Cost today and one year out

Funded personally by KG (PRD D6). Assumptions are stated so the numbers can be redone as actuals arrive. Prices are public list prices as of writing — confirm at signup.

### Today — Phase 1, DMV pilot

Usage: ~30,000 seekers stored, a few hundred active per week, no outbound campaigns yet.

| Service | Plan | Monthly | Notes |
|---|---|---|---|
| Vercel | Hobby (non-commercial) | $0 | |
| Supabase | Free | $0 | Free projects pause after about a week idle; the health ping and sync cron keep it awake. Move to Pro when Phase 2 traffic starts, or sooner for peace of mind. |
| Inngest | Free | $0 | |
| Resend | Free | $0 | ~3k emails/month, 100/day — enough for instructor mail in Phase 1 |
| Twilio | not yet | $0 | |
| Claude API | not yet | $0 | |
| Sentry | Developer | $0 | |
| Domain | annual | ≈ $1–2 | ≈ $15/year |
| **Total today** | | **≈ $0–2 / month** | **≈ $25–27 / month** if Supabase Pro is taken from day one |

### One year out — Phase 3, all US

Assumptions (adjust to actuals): 40,000 seekers stored; 6,000 enrolled in weekly programs receiving 4 reminders/month (24k messages); one monthly public-program invitation to 30,000 by email and 10,000 by WhatsApp; 500 rule-driven AI follow-ups/month; ~200 portal users.

| Service | Plan | Monthly estimate | Driver |
|---|---|---|---|
| Vercel | Hobby or Pro | $0–20 | Pro only if a second developer needs the dashboard |
| Supabase | Pro | $25 | Always-on, daily backups; database size is far below the limit |
| Inngest | Free → first paid tier | $0–50 | Run volume: 15-minute syncs plus every send |
| Resend | Pro / Scale | $20–90 | 50k–100k emails/month |
| Twilio SMS | pay per segment | ≈ $200–300 | 24k reminders × ≈ $0.008 + carrier fees ≈ $0.003; plus a number (≈ $1) and 10DLC campaign fee (≈ $2–10) |
| Twilio WhatsApp | pay per message (Meta rates) | ≈ $100–300 | Utility messages are cheap (≈ $0.004–0.015 in the US); marketing-category invitations cost more (≈ $0.025) — 10k invitations ≈ $250 |
| Claude API | pay per token | ≈ $5–15 | 500 short drafts/month |
| Sentry | Developer | $0 | |
| Domain | annual | ≈ $1–2 | |
| **Total at one year** | | **≈ $350–800 / month** | 80–90% of it is messaging |

**What moves the number is the channel per message type, not the platform.** Reminders on WhatsApp-utility instead of SMS and invitations kept on email bring the total to roughly **$150–250 / month**; everything on SMS pushes it toward $800. Email-only at the same scale is **≈ $50–140 / month**. The portal therefore treats channel preference per program and per message type as a cost control, and the deliverability dashboard should show cost per campaign.

-----

## 10. Phase mapping

| Phase | Architecture delivered |
|---|---|
| **1 — Capture** | Next.js app + PWA shell; Supabase project, `0001_initial` migration, RLS; Auth with roles; offline outbox for intake and attendance; import job (Google Sheet or file → chunked normalize → outcomes) for the ~30k rows; Eventbrite backfill across all organizations, webhook, and 15-minute reconcile job; center dashboard views; CI with schema + smoke test. |
| **2 — Communicate** | `comms` module and `enqueueMessage`; Resend and Twilio (SMS + WhatsApp) providers with webhooks; 10DLC and WhatsApp template registration; SMS opt-in keyword; suppression and preferences link; campaign audience builder; instructor reminders job with Web Push; mentor/volunteer nudge job; deliverability views; New York and Texas onboarding. |
| **3 — Anticipate** | `rules` module and evaluate job; starter rule library; Claude drafting with template-gated review; testimonial link with YouTube video links and moderation; stage recompute and engagement views; regional rollup views for every region; retention job. |

-----

## 11. Risks

| Risk | Mitigation |
|---|---|
| Free-tier database pauses on inactivity | Health ping + cron traffic; budget for the paid tier before Phase 2 if traffic stays low |
| iOS: no Background Sync, push needs Home Screen install | Retry-on-open sync; install step in onboarding; email/message fallback for reminders |
| WhatsApp template approval delays Phase 2 | Decide channel during Phase 1; submit templates early; SMS/email work meanwhile |
| Service-role misuse in jobs | Single `serviceClient()` helper that requires an explicit `center_id` argument on writes; code review checklist |
| Vendor lock-in (Inngest, Resend, Twilio) | Provider interfaces in `lib/providers`; events are plain JSON; the DB is plain Postgres |
| US SMS compliance (TCPA, A2P 10DLC) without written consent | Lightweight opt-in keyword/checkbox; STOP honored instantly; registration at Phase 2 start; email and WhatsApp as fallbacks |
| Messaging cost at national scale | Channel preference per message type; email for broadcasts; monthly review against §9 |
| Volunteer maintainers after handover | Managed services only; runbook in `docs/`; one-command local setup; CI guards the schema |

-----

## 12. Decisions needing your yes

1. **Supabase** (Postgres + Auth + Storage) over Neon + Auth.js — AD-2.
2. **Inngest** for jobs over Supabase-native cron/edge functions — AD-4.
3. **Resend** for email (Postmark as the upgrade path) — AD-5.
4. **Twilio** as the vendor for SMS and WhatsApp behind one interface — AD-6 (both channels are confirmed; the vendor choice is what needs a yes).
5. **Vercel** hosting + **Sentry** — AD-10.
6. Confirm the free-tier posture for Phase 1, with the pause-on-inactivity caveat understood.
7. Confirm the one-year cost posture in §9 — messaging-dominated, with channel-per-message-type as the lever.

Everything else in this document follows from the PRD and data model and does not need a separate decision.
