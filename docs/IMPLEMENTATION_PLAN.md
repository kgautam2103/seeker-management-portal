# Implementation Plan — Three Phases

Companion to [PRD.md](PRD.md) (v0.3). Each phase ships an end-to-end usable increment, realizes the vision progressively — **Capture → Communicate → Anticipate** — and expands geography: **DMV → New York and Texas → all US**.

| Phase | Theme | Geography | Requirements | Outcome |
|---|---|---|---|---|
| 1 | Capture | DMV pilot (DC, Maryland, Northern Virginia) | R1, R2, R3, R4, R5, R15, R14 (center dashboard) + platform | Every seeker — 30k historical, all Eventbrite attendees, new intakes — exists once in the portal; volunteers and instructors work from their phones |
| 2 | Communicate | + New York, Texas | R11, R8, R9, R6, R7, R12 | All seeker and volunteer communication flows through the portal on email, SMS, and WhatsApp, with opt-out built in |
| 3 | Anticipate | All US | R13, R10, R14 (regional rollup + analytics) | The system notices at-risk seekers and prompts action; testimonials collected; every region reports without manual work |

Effort estimates assume 1–2 developers and are indicative only. Steward and admin throughout: KG, with a backup admin named in Phase 1.

---

## Phase 1 — Capture (DMV pilot)

**Goal:** Every seeker — past and present — exists once in the portal, and volunteers can add seekers and record attendance from a phone, online or offline.

**Deliverables**
- PWA shell: manifest, service worker, installability, responsive layout
- Auth with roles (Admin, Regional Coordinator, Volunteer Coordinator, Instructor) and center/region scoping (R15); environments and CI
- Data model and migrations for all core entities, so Phases 2–3 add features rather than rewrite schema
- Region and center directory seeded for DMV; program and session management (R4)
- **Historical import of ~30,000 rows from the Google Sheet:** template validation, normalization (E.164, ISO-2, US state), dedupe, review queue; runs as a chunked background job with progress (R2)
- **Eventbrite backfill script:** iterate every organization the API key can access → every past and upcoming event → attendees; create sessions from events, seekers and registrations from attendees, deduped; then scheduled 15-minute sync + webhook (R3)
- Seeker intake form: shareable link/QR, offline queue with background sync, duplicate warning (R1)
- Session roster with one-tap attendance, new vs returning, remarks; offline-capable (R5)
- Center dashboard: new seekers this week/month, due for follow-up, returning vs lapsed, attendance counts (R14)
- Admin views: seeker search and profile, merge/assign-center tools, import batch view
- Backup admin named; domain purchased; service accounts created under KG

**Exit criteria**
- 100% of the Google Sheet imported; duplicate review queue cleared
- Eventbrite backfill complete for all organizations; new registrations appear within 15 minutes
- A volunteer adds a seeker in < 60 s on mobile, including with no connectivity
- DMV pilot centers record attendance for every session across 2 consecutive weeks

**Indicative effort:** 6–8 weeks (up from 5–7: the multi-organization backfill and 30k import add scope)

---

## Phase 2 — Communicate (add New York and Texas)

**Goal:** The portal becomes the channel for seeker and volunteer communication on email, SMS, and WhatsApp, with opt-out handled from the first send.

**Start-of-phase prerequisites (lead time):** A2P 10DLC brand and campaign registration for US SMS; WhatsApp Business account and message-template approval; sending domain DNS (SPF, DKIM, DMARC) warmed up.

**Deliverables**
- Unsubscribe, STOP handling, per-channel preferences, suppression list — **ships before the first campaign** (R11)
- Lightweight SMS opt-in (keyword or intake checkbox) to satisfy TCPA / 10DLC expectations while written consent is deferred
- Email provider integration: templates, delivery-event webhooks
- Messaging provider integration for **SMS and WhatsApp**
- Weekly program communications: audiences per program, schedule and reminder templates (R8)
- Public program campaigns: segment builder (history, attendance, recency, center, region), send, track (R9)
- Instructor session reminders: email + message + web push with configurable lead time and roster link (R6)
- Volunteer follow-up nudges to the seeker's mentor, else a coordinator; mark contact done (R7)
- Delivery dashboard: per-message, per-channel events; automatic hard-bounce and STOP suppression (R12)
- **Onboard New York and Texas:** regions, centers, coordinators; their historical imports and Eventbrite organizations

**Exit criteria**
- All weekly and public program communications sent through the portal — no manual BCC or broadcast lists
- Unsubscribe and STOP honored immediately on every channel; bounce rate < 2%
- Instructors receive reminders for 100% of scheduled sessions; ≥ 90% of new seekers contacted within 72 h
- NY and TX centers live with attendance being recorded

**Indicative effort:** 6–8 weeks

---

## Phase 3 — Anticipate (all US)

**Goal:** The system detects when a seeker is at risk of being lost and acts — or asks a volunteer to — with AI-drafted content that admins trust; every region reports without manual work.

**Deliverables**
- Rule engine: triggers (attendance, registration, time since last contact, program completion), conditions (segment, preferences, cooldown), actions (email, message, task for mentor/volunteer) (R13)
- Starter rule library: registered-but-no-show follow-up · 2 consecutive misses → mentor task · program completed → next step · inactive 90 days → public program invite · new-seeker welcome sequence
- AI content: LLM drafts personalized follow-ups from approved templates plus seeker context (program, attendance; never remarks). **Review policy:** approved template → sends automatically; new or changed template → held in the review queue until the template is approved (R13)
- Testimonials: public link for text or a video; videos uploaded to the private YouTube channel by the steward and linked; moderation queue; publish link or export (R10)
- Engagement view: per-seeker journey stage (new → engaged → regular → lapsed) and an at-risk list per center
- Regional rollup and analytics for every region: seekers per center, retention, sessions, trends; funnel (registered → attended → completed → returned); campaign and rule effectiveness; exportable (R14)
- Retention job: anonymize seekers inactive past the agreed window
- **National rollout:** remaining regions onboarded with the same playbook as NY/TX

**Exit criteria**
- ≥ 90% of no-shows and drop-offs contacted within 7 days with no manual triggering
- Zero seekers with no contact in 90 days unless unsubscribed
- Regional coordinators in every region get their rollup without any manual data collection
- Re-engagement rate measurably above the Phase 1 baseline

**Indicative effort:** 6–8 weeks

---

## Cross-Phase Practices

- Pilot each phase with 2–3 centers before wide rollout; collect feedback in-app
- Privacy review before each release; SMS opt-in and STOP verified before Phase 2 goes live
- Documentation with each phase: import template guide, volunteer one-page quick-start, admin runbook, region onboarding playbook
- Cost tracked monthly against the estimates in [ARCHITECTURE.md §9](ARCHITECTURE.md#9-cost-today-and-one-year-out)
- **Public repo:** no real seeker data is ever committed; fixtures and samples are synthetic

## Stack

Detailed in [ARCHITECTURE.md](ARCHITECTURE.md): Next.js PWA on Vercel, Supabase (Postgres + RLS, Auth, Storage), Inngest jobs, Resend email, Twilio SMS + WhatsApp, Claude API, Web Push, Sentry.

## Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| US SMS compliance (TCPA, A2P 10DLC) with no written consent | Lightweight opt-in keyword/checkbox in Phase 2; STOP honored instantly; 10DLC registration started at the beginning of Phase 2; email and WhatsApp as fallbacks |
| WhatsApp template approval lead time | Submit templates at Phase 2 start; SMS and email work meanwhile |
| Messaging cost grows with volume | Reminders default to the cheapest eligible channel per seeker; broadcast invitations default to email; monthly cost review (see cost estimate) |
| 30k historical rows of mixed quality | Review queue instead of silent auto-merge; dedupe report before commit; import in chunks with progress |
| Eventbrite backfill across many organizations hits rate limits | Paginated, resumable job with `last_synced_at` per organization; reconcile on schedule |
| iOS web push requires Home Screen install | Make install a step in onboarding; fall back to email/SMS/WhatsApp reminders |
| YouTube "private" videos are not viewable by link | Use *unlisted* if testimonials are to be watched from the portal; decide before Phase 3 |
| Single admin | Backup admin named in Phase 1; documented handover; service accounts under KG with recovery set up |
| AI content tone or accuracy | Approved templates only; new templates reviewed before first send; every draft logged |
