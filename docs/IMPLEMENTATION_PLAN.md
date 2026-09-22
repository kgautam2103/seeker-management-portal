# Implementation Plan — Three Phases

Companion to [PRD.md](PRD.md). Each phase ships an end-to-end usable increment and realizes the vision progressively: **Capture → Communicate → Anticipate**.

| Phase | Theme | Requirements | Outcome |
|---|---|---|---|
| 1 | Capture | R1, R2, R3, R4, R5, R15, R14 (center dashboard) + platform | Every seeker exists once in the portal; volunteers and instructors work from their phones |
| 2 | Communicate | R11, R8, R9, R6, R7, R12, R10 | All seeker and volunteer communication flows through the portal, with consent built in |
| 3 | Anticipate | R13, R14 (regional rollup + analytics) | The system notices at-risk seekers and prompts action before anyone has to remember |

Effort estimates assume 1–2 developers and are indicative only.

---

## Phase 1 — Capture (Foundation)

**Goal:** Every seeker — past and present — exists once in the portal, and volunteers can add seekers and record attendance from a phone, online or offline.

**Deliverables**
- PWA shell: manifest, service worker, installability, responsive layout
- Auth with roles (Admin, Regional Coordinator, Volunteer Coordinator, Instructor) and center scoping (R15); environments and CI
- Data model and migrations for all core entities, so Phases 2–3 add features rather than rewrite schema
- Center & session directory; home-center assignment (R4)
- Standard import template + import tool: validation, normalization, dedupe, review queue (R2)
- Seeker intake form: shareable link/QR, consent statement, offline queue with background sync, duplicate warning (R1)
- Eventbrite: connect account, map events → programs, scheduled sync + webhook, reconciliation job (R3)
- Session roster with one-tap attendance, new vs returning, remarks; offline-capable (R5)
- Center dashboard: new seekers this week/month, due for follow-up, returning vs lapsed, attendance counts (R14)
- Admin views: seeker search and profile, program and session management

**Exit criteria**
- 100% of historical records imported; duplicate review queue cleared
- A volunteer adds a seeker in < 60 s on mobile, including with no connectivity
- Eventbrite registrations appear in the portal within 15 minutes
- Pilot centers record attendance for every session across 2 consecutive weeks

**Indicative effort:** 5–7 weeks

---

## Phase 2 — Communicate

**Goal:** The portal becomes the channel for seeker and volunteer communication, with deliverability and consent handled from the first send.

**Deliverables**
- Unsubscribe, per-channel preferences, suppression list — **ships before the first campaign** (R11)
- Email provider integration: sending domain, templates, delivery-event webhooks
- Messaging provider integration for the chosen channel(s); WhatsApp templates submitted early
- Weekly program communications: audiences per program, schedule and reminder templates (R8)
- Public program campaigns: segment builder (history, attendance, recency, center), send, track (R9)
- Instructor session reminders: email + message + web push with configurable lead time and roster link (R6)
- Volunteer follow-up nudges: due-for-follow-up alerts to the assigned volunteer; mark contact done (R7)
- Delivery dashboard: per-message events, automatic hard-bounce suppression (R12)
- Testimonials: public submission link, post-completion trigger, moderation queue, publish/export (R10)

**Exit criteria**
- All weekly and public program communications sent through the portal — no manual BCC or broadcast lists
- Unsubscribe honored immediately on every channel; bounce rate < 2%
- Instructors receive reminders for 100% of scheduled sessions; ≥ 90% of new seekers contacted within 72 h
- First batch of testimonials collected and moderated

**Indicative effort:** 5–7 weeks

---

## Phase 3 — Anticipate (Intelligence)

**Goal:** The system detects when a seeker is at risk of being lost and acts — or asks a volunteer to — with AI-drafted content that admins trust.

**Deliverables**
- Rule engine: triggers (attendance, registration, time since last contact, program completion), conditions (segment, preferences, cooldown), actions (email, message, task for volunteer) (R13)
- Starter rule library: registered-but-no-show follow-up · 2 consecutive misses → volunteer task · program completed → next step · inactive 90 days → public program invite · new-seeker welcome sequence
- AI content: LLM drafts personalized follow-ups from approved templates plus seeker context (program, attendance, remarks); review-before-send mode; guardrails on tone, facts, and data exposure (R13)
- Engagement view: per-seeker journey stage (new → engaged → regular → lapsed) and an at-risk list per center
- Regional rollup and analytics: seekers per center, retention, sessions, trends; funnel (registered → attended → completed → returned); campaign and rule effectiveness; exportable (R14)

**Exit criteria**
- ≥ 90% of no-shows and drop-offs contacted within 7 days with no manual triggering
- Zero seekers with no contact in 90 days unless unsubscribed
- Regional coordinators get their rollup without any manual data collection
- Re-engagement rate measurably above the Phase 1 baseline

**Indicative effort:** 6–8 weeks

---

## Cross-Phase Practices

- Pilot each phase with 2–3 centers before wide rollout; collect feedback in-app
- Privacy review before each release; consent language approved before Phase 1 goes live
- Documentation with each phase: import template guide, volunteer one-page quick-start, admin runbook
- **Public repo:** no real seeker data is ever committed; fixtures and samples are synthetic

## Proposed Stack (to confirm in the architecture step)

- **Frontend / PWA:** Next.js + TypeScript + Tailwind; service worker via Serwist
- **Backend / DB:** Next.js API routes or a small Node service; PostgreSQL (managed free tier, e.g., Supabase or Neon)
- **Jobs:** background worker for syncs, sends, and rules (e.g., Inngest, Trigger.dev, or BullMQ)
- **Email:** Postmark or Resend · **Messaging:** Twilio (SMS/WhatsApp) or WhatsApp Business API · **LLM:** Claude API · **Hosting:** Vercel + managed Postgres

## Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| iOS web push requires Home Screen install | Make install a step in onboarding; fall back to email/WhatsApp reminders |
| Eventbrite webhook gaps or rate limits | Scheduled reconciliation sync in addition to webhooks |
| WhatsApp template approval lead time and cost at scale | Decide channel in Phase 1; submit templates early; budget question resolved first |
| AI content tone or accuracy | Review-before-send default; approved templates only; log every draft |
| Poor historical data quality | Review queue instead of silent auto-merge; dedupe report before commit |
| Volunteer adoption | Pilot centers, < 60 s intake, tolerate imperfect entry, one-page guide |
| Single point of failure on admin access | Named steward plus a second admin; documented handover |
