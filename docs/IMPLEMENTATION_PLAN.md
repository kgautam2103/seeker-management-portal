# Implementation Plan — Three Phases

Companion to [PRD.md](PRD.md). Each phase ships an end-to-end usable increment and realizes the vision progressively: **Capture → Communicate → Anticipate**.

| Phase | Theme | Requirements | Outcome |
|---|---|---|---|
| 1 | Capture | F1, F2, F3, F6 + platform | Every seeker exists once in the portal; instructors work from their phones |
| 2 | Communicate | F4, F5, F7, F9, F10, F11 | All seeker and instructor communication flows through the portal, with consent built in |
| 3 | Anticipate | F8 + analytics | The system notices at-risk seekers and follows up before anyone has to remember |

Effort estimates assume 1–2 developers and are indicative only.

---

## Phase 1 — Capture (Foundation)

**Goal:** Every seeker — past and present — exists once in the portal, and instructors can add seekers and record attendance from a phone, online or offline.

**Deliverables**
- PWA shell: manifest, service worker, installability, responsive layout
- Auth with Admin and Instructor roles; environments and CI
- Data model and migrations for all core entities (so Phases 2–3 add features, not schema rewrites)
- Standard import template + import tool: validation, normalization, dedupe, review queue (F1)
- Instructor Add-Seeker form: shareable link, offline queue with background sync, duplicate warning (F2)
- Eventbrite: connect account, map events → programs, scheduled sync + webhook, reconciliation job (F3)
- Session roster with one-tap attendance and remarks, offline-capable (F6)
- Admin views: seeker search and profile, program and session management

**Exit criteria**
- 100% of historical records imported; duplicate review queue cleared
- Instructors add a seeker in < 60s on mobile, including with no connectivity
- Eventbrite registrations appear in the portal within 15 minutes
- Attendance recorded for every session across 2 consecutive weeks by pilot instructors

**Indicative effort:** 5–7 weeks

---

## Phase 2 — Communicate

**Goal:** The portal becomes the channel for all seeker and instructor communication, with deliverability and consent handled from the first send.

**Deliverables**
- Unsubscribe, per-channel preferences, and suppression list — **ships before the first campaign** (F11)
- Email provider integration: sending domain, templates, delivery-event webhooks
- Messaging provider integration for the chosen channel(s)
- Weekly program communications: audiences per program, schedule and reminder templates (F4)
- Public program campaigns: segment builder (program history, attendance, recency), send, track (F5)
- Instructor reminders: email + message + web push with configurable lead time and roster link (F9)
- Deliverability dashboard: per-message events, automatic hard-bounce suppression (F10)
- Testimonials: public submission link, post-completion trigger, moderation queue, publish/export (F7)

**Exit criteria**
- All weekly and public program communications sent through the portal — no manual BCC lists
- Unsubscribe honored immediately on every channel; bounce rate < 2%
- Instructors receive reminders for 100% of scheduled sessions
- First batch of testimonials collected and moderated

**Indicative effort:** 5–7 weeks

---

## Phase 3 — Anticipate (Intelligence)

**Goal:** The system detects when a seeker is at risk of being lost and acts, with AI-drafted content that admins trust.

**Deliverables**
- Rule engine: triggers (attendance, registration, time since last contact, program completion), conditions (segment, preferences, cooldown), actions (email, message, task for instructor) (F8)
- Starter rule library: registered-but-no-show follow-up · 2 consecutive misses · program completed → next step · inactive 90 days → public program invite · new-seeker welcome sequence
- AI content: LLM drafts personalized follow-ups from approved templates plus seeker context (program, attendance, remarks); review-before-send mode; guardrails on tone, facts, and data exposure (F8)
- Engagement view: per-seeker engagement score and an "at-risk" list for instructors and admins
- Analytics: funnel (registered → attended → completed → returned), campaign performance, rule effectiveness

**Exit criteria**
- ≥ 90% of no-shows and drop-offs contacted within 7 days with no manual action
- Zero seekers with no contact in 90 days unless unsubscribed
- Re-engagement rate measurably above the Phase 1 baseline

**Indicative effort:** 6–8 weeks

---

## Cross-Phase Practices

- Pilot each phase with 2–3 instructors before wide rollout; collect feedback in-app
- Privacy and security review before each release
- Documentation shipped with each phase: import template guide, instructor quick-start, admin runbook

## Proposed Stack (to confirm)

- **Frontend / PWA:** Next.js + TypeScript + Tailwind, service worker via Serwist
- **Backend / DB:** Next.js API routes or a small Node service; PostgreSQL (managed, e.g., Supabase or Neon)
- **Jobs:** background worker for syncs, sends, and rules (e.g., Inngest, Trigger.dev, or BullMQ)
- **Email:** Postmark or Resend · **Messaging:** Twilio · **LLM:** Claude API · **Hosting:** Vercel + managed Postgres

## Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| iOS web push requires Home Screen install | Make install a step in instructor onboarding; fall back to email/SMS reminders |
| Eventbrite webhook gaps or rate limits | Scheduled reconciliation sync in addition to webhooks |
| WhatsApp template approval lead time and messaging cost | Decide channel in Phase 1; submit templates early |
| AI content tone or accuracy | Review-before-send default; approved templates only; log every draft |
| Poor historical data quality | Review queue instead of silent auto-merge; dedupe report before commit |
