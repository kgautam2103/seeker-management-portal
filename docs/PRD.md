# Product Requirements Document: Seeker Management Portal

**Author:** Kumar Gautam (22.gautam@gmail.com) — personal/volunteer project, Sahaja Yoga meditation community
**Status:** Draft v0.3 — for review · **Date:** 2026-09-23 · Supersedes v0.2 (2026-09-22) and v0.1 (2026-09-02)
**Delivery:** Progressive Web App (PWA) — no native mobile app · **Repo:** github.com/kgautam2103/seeker-management-portal

**Scope note:** Planning document only. Nothing has been built, purchased, or deployed; no accounts, domains, or tools have been created. This PRD exists to align on requirements before implementation begins.

-----

## 1. Vision

> **"No seeker is ever lost."**

Every person who registers for, attends, or shows interest in a Sahaja Yoga session is captured once, in one shared system, and receives timely follow-up — automated for logistics, personal where it matters.

-----

## 2. Problem / Background

Sahaja Yoga meditation is offered free of charge by volunteers at local centers, public programs, and introductory sessions. Newcomers are known as **seekers**. Today seekers are tracked informally — a Google Sheet of roughly 30,000 historical records, Eventbrite exports across several organizations, paper sign-in sheets, WhatsApp chats, and individual memory. The result:

- **Lost follow-up** — a seeker not personally invited back within days rarely returns; follow-up depends on who remembers.
- **No visibility into drop-off** — no one can see who attended once, a few times, or became regular, so nobody knows where people disengage.
- **Fragmented ownership** — contact details live in one volunteer's phone; when they step back, the relationship and the data go with them.
- **No routing** — a seeker's nearest center, preferred time, or language may not match the session they first attended.
- **Manual regional reporting** — coordinators collect numbers center by center, if at all.

A lightweight shared portal lets volunteers, instructors, and coordinators capture seekers once, follow up consistently, and see retention honestly — without adding overhead to an all-volunteer effort.

-----

## 3. Goals & Success Metrics

**Goals** (carried from v0.1)

1. Any volunteer can record a new seeker in under a minute, from a phone, right after a session.
2. Every new seeker gets a timely, appropriate follow-up — a call, message, or invitation — instead of falling through the cracks.
3. Volunteers and coordinators see at a glance who is new, who is returning, and who has gone quiet.
4. Regional coordinators get honest reporting on reach and retention without weeks of manual data-gathering.
5. Non-technical volunteers can use and maintain the portal without ongoing developer support.

**Success metrics**

| Goal | Metric | Starting target |
|---|---|---|
| Capture every seeker | Session attendees with contact info recorded; historical records imported | ≥ 90%; 100% of the ~30k imported, 0 duplicates by email/phone |
| Frictionless intake | Time to log a new seeker on a phone | < 60 seconds |
| Timely follow-up | New seekers contacted within 72 h; no-shows/drop-offs contacted within 7 days | ≥ 90% / ≥ 90% |
| Retention | Seekers attending a 2nd session within 30 days; still active at 90 days | Baseline in Phase 1; improve in Phase 3 |
| Volunteer adoption | Active centers logging attendance monthly; sessions with attendance recorded | ≥ 80% of centers; ≥ 90% of sessions |
| Healthy, respectful sending | Bounce / spam-complaint rate; unsubscribe and STOP honored | < 2% / < 0.1%; 100%, immediately |

Targets are starting points, to be refined once a baseline exists.

-----

## 4. Users / Personas

| Persona | Who | Needs |
|---|---|---|
| **Volunteer Coordinator** (primary) | Local center volunteer who greets newcomers, collects contact details, sends follow-ups, and invites seekers back; on a phone, not a laptop; non-technical; unpaid work on top of a job | Log seekers fast, see who is due for follow-up, send program communications |
| **Session Instructor** | Leads the session; focused on facilitating, not admin | One-tap attendance, remarks, session reminders |
| **Regional / National Coordinator** | Oversees many centers; closest to an admin | Rollup of seekers, retention, and sessions per center; identify centers needing support |
| **Seeker** | Newcomer or returning practitioner; the subject of records, not a portal user today (self-service is a low-risk future option) | Relevant, timely messages; submit a testimonial; unsubscribe easily. Interacts only via emailed or shared links |
| **System / Data Steward** | **KG (Kumar Gautam)** — admin, budget owner, and long-term steward; a backup admin to be named | Access control, data privacy, system health, service accounts |

-----

## 5. Requirements

Grouped by capability. Phase numbers reference the [Implementation Plan](IMPLEMENTATION_PLAN.md).

### A. Seeker capture

| ID | Requirement | Acceptance | Phase |
|---|---|---|---|
| **R1** | **Seeker intake form** — short, mobile-first form used by a volunteer or instructor (optionally by the seeker via QR/shared tablet). Fields: name, phone/email, city, state (US), how they heard of us, first session date, center/session. | < 60 s on a phone; works offline and syncs later; warns on likely duplicates; no field so strict a rushed volunteer gets stuck. No written consent statement for now (see §9). | 1 |
| **R2** | **Historical import** — import the ~30,000 existing seekers from the Google Sheet, laid out per the published [import template](IMPORT_TEMPLATE.md). | Reads a Google Sheets link or CSV/XLSX; runs as a background job with progress; validates and normalizes name/email/phone/country/state/center/date; dedupes by email or phone; uncertain rows go to a review queue, never silently merged. | 1 |
| **R3** | **Eventbrite sync** — pull registrations from every event in every organization the API key can access. | One-time backfill over all organizations and past events, then scheduled sync + webhook; each event mapped to a dated session (and so its program); attendees deduped into seekers; new vs returning flagged; new registrations visible within 15 min. | 1 |
| **R4** | **Center & session directory** — regions, centers, locations, regular session times; each seeker has a home center when known. | Follow-ups and access route to the right local volunteer; seekers can be reassigned to a better-fit center/session. | 1 |

### B. Sessions & attendance

| ID | Requirement | Acceptance | Phase |
|---|---|---|---|
| **R5** | **Attendance & remarks** — instructors mark attendance per session and add per-seeker remarks. | One-tap present/absent from the roster; new vs returning shown; free-text remarks with optional tags; works offline; history on the seeker profile. | 1 |
| **R6** | **Instructor session reminders** — email, SMS/WhatsApp, and web push before each session. | Configurable lead time; includes roster, location, and any unmarked attendance from the last session. | 2 |
| **R7** | **Volunteer follow-up nudges** — prompt the seeker's mentor (else a center coordinator) to make personal contact. | e.g., "Follow up with [Seeker] — attended 3 days ago, not yet contacted"; marks contact done; visible on the dashboard and sent via email/message. | 2 |

### C. Communication with seekers

| ID | Requirement | Acceptance | Phase |
|---|---|---|---|
| **R8** | **Weekly program communications** — email, **SMS, and WhatsApp** to seekers enrolled in a weekly program. | Per-program audience; schedule, reminders, materials, cancellations; every send logged against the seeker. | 2 |
| **R9** | **Public program invitations** — targeted email and messages to past and inactive seekers about upcoming public programs. | Segment by program history, attendance, recency, center, and region; suppression list enforced; results tracked per campaign. | 2 |
| **R10** | **Testimonials** — seekers submit a text testimonial or a video via a public link; videos are hosted on a private YouTube channel and linked, never uploaded to the portal. | Optional automatic request after program completion; moderation queue; approve, publish (link), or export. | 3 |
| **R11** | **Unsubscribe & preferences** — seekers opt out of any channel at any time. | One-click unsubscribe in every email; STOP handling for SMS and WhatsApp; per-channel preferences; global suppression checked on every send. Ships before the first campaign. | 2 |
| **R12** | **Delivery monitoring** — track health of every message. | Sent/delivered/opened/clicked/bounced/complained per message and channel; deliverability dashboard; hard bounces and STOPs auto-suppressed. | 2 |

### D. Intelligence & insight

| ID | Requirement | Acceptance | Phase |
|---|---|---|---|
| **R13** | **Rule engine + AI follow-ups** — configurable rules drive follow-up; an LLM personalizes content. | Rule = trigger → condition → action. Triggers: no-show, missed sessions, program completed, inactive N days, journey-stage change (new → engaged → regular → lapsed). Actions: message the seeker **or** create a task for the mentor/volunteer. LLM drafts within admin-approved templates and tone. **Review policy:** drafts from an already-approved template send automatically; drafts from a new or changed template wait in the review queue until an admin approves the template. Cooldowns prevent over-messaging. | 3 |
| **R14** | **Dashboards & reporting** — center dashboard and regional rollup. | Center: new seekers this week/month, due for follow-up, journey stage (new / engaged / regular / lapsed), attendance counts (Phase 1). Regional (DMV, NY, Texas, then all US): seekers per center, retention, sessions, trends; exportable without raw-data access (Phase 3). | 1 / 3 |
| **R15** | **Access control** — by role, center, and region. | Volunteers see their own center's seekers; regional coordinators see rollups for centers they oversee; unassigned seekers are admin-only until placed; no public access to personal data. | 1 |

-----

## 6. Rollout

| Stage | Geography | Scope |
|---|---|---|
| **Pilot** (Phase 1) | DC metro — the DMV region (DC, Maryland, Northern Virginia) | Historical import, Eventbrite backfill, intake, attendance, center dashboards |
| **Expand** (Phase 2) | Add New York and Texas | Communications on all channels; onboarding of new regions' centers and coordinators |
| **National** (Phase 3) | All of the US | Rules and AI follow-up, regional rollups for every region, testimonials |

US-first: English UI, US phone default, state mandatory for US records. The data model remains ready for other countries.

-----

## 7. Out of Scope

- Native iOS/Android apps — **PWA only**.
- Payments and ticketing — remain in Eventbrite; the portal does not replace Eventbrite as the public registration front end.
- Seeker accounts or login — seekers interact only via links (self-service is a future option).
- General-purpose CRM or marketing automation — rules are purpose-built for the flows above.
- Video hosting — testimonial videos live on a YouTube channel; the portal stores links only.
- Health or other sensitive personal data — never collected.

## 8. Future (V2+)

Multi-language UI (data model localization-ready from v1) · countries beyond the US · seeker self-service portal (update own details, see attendance history, find a nearby center while traveling) and session self-registration with calendar sync (e.g., Google Calendar) · cross-region seeker lookup for travelers · program-effectiveness analytics (retention vs instructor, format, time, follow-up speed) · WhatsApp group auto-add for consenting seekers · written consent statement at intake, if introduced.

-----

## 9. Non-Functional Requirements

**Privacy & consent (personal data of members of the public)**
- **Consent posture (decision 2026-09-23):** no written consent statement is shown at intake for now. Consent is implied by a seeker sharing contact details for follow-up and is recorded with its source (intake, import, Eventbrite). A written statement can be introduced later without schema change.
- **Deferred consent design (from v0.1):** when introduced, a plain-language statement at intake saying what is collected, why (follow-up and program improvement only), how it is used, and how to opt out.
- **Opt-out is always available:** one-click unsubscribe in every email; STOP on SMS and WhatsApp; honored immediately across channels.
- **US messaging compliance:** SMS to US numbers falls under TCPA and carrier A2P 10DLC registration, which expect documented opt-in. Phase 2 therefore includes a lightweight SMS opt-in (keyword or checkbox at intake) even though a general written consent is deferred. See risks in the Implementation Plan.
- Data minimization: name, contact, city/state/country, center/session, mentor. No health data, no ID numbers, no street address.
- Seekers can request correction or deletion ("right to be forgotten"); deletion honored across channels. GDPR-like principles apply if the portal ever extends beyond the US.
- Access limited by role, center, and region; audit log for exports and bulk actions. No third-party sharing or sale.
- Retention policy: archive or anonymize after a defined period of inactivity (window still to be set).
- AI-generated content never includes another seeker's data; remarks are internal-only.

**Simplicity & low maintenance** — volunteer-run with no IT staff. Managed services over self-hosting; one-page guides suffice for training; infrequent technical intervention. Routine administration — adding a center or user, running an import, approving a template, exporting a report — never requires a developer.

**Cost** — funded personally by KG. Start on free tiers; messaging volume is the main cost driver. Estimates for today and one year out are in [ARCHITECTURE.md §9](ARCHITECTURE.md#9-cost-today-and-one-year-out).

**Ease of use** — basic smartphone, no training beyond a one-page guide, tolerant of imperfect data entry.

**Reliability** — available evenings and weekends around sessions; offline-tolerant for instructor flows.

**Scale** — ~30,000 seekers on day one; design headroom for tens of thousands more and hundreds of centers across the US without re-architecture.

**Localization readiness** — US-first and English-only in v1, but the data model and field choices assume nothing English-only: one free-text name field (no first/last split), international phone formats (E.164), ISO country codes, free-text region outside the US. Expansion beyond the US must not require schema changes.

**PWA platform** — installable (manifest + service worker); responsive from 360px; offline-first intake and attendance with background sync (last-write-wins with audit); web push for reminders (iOS requires Home Screen install, iOS 16.4+ — part of onboarding); auth via magic link or Google sign-in; roles Admin, Regional Coordinator, Volunteer Coordinator, Instructor; WCAG 2.1 AA for core flows.

-----

## 10. Core Data Model

Full model in [DATA_MODEL.md](DATA_MODEL.md).

| Entity | Purpose |
|---|---|
| Seeker | Person record; unique by email/phone; city, state, country; home center (optional until assigned); mentor; consent source and preferences |
| Region / Center | Rollout geography (DMV, NY, Texas, …) and locations with regular session times |
| Program | Weekly or public; belongs to a center; owns sessions and an audience |
| Session | Dated occurrence of a program; instructor; roster; the unit an Eventbrite event maps to |
| Registration | Seeker ↔ Program, plus the session when known (Eventbrite); source = intake, import, or Eventbrite |
| Eventbrite organization / event | Organizations the API key can access → default center; events → sessions |
| Attendance / Remark | Per seeker per session |
| Testimonial | Seeker-submitted text or private video link; moderation status |
| User | Admin, Regional Coordinator, Volunteer Coordinator, or Instructor; center scope |
| Message / Campaign | Every outbound send: channel, template, delivery events |
| Rule | Trigger, conditions, action, cooldown |
| Suppression | Unsubscribes, STOPs, hard bounces, complaints — per channel |

## 11. Integrations

Eventbrite API (one private token with multi-organization access; backfill, scheduled sync, webhooks) · Google Sheets (import source) · email provider with delivery-event webhooks · messaging provider for **SMS and WhatsApp** · LLM API (e.g., Claude API) for follow-up drafting · Web Push (VAPID) · YouTube (testimonial video links only).

-----

## 12. Decisions

| # | Decision | Date |
|---|---|---|
| D1 | PWA, not a native app | 2026-09-22 |
| D2 | Automated communication to seekers is in scope for logistics; personal follow-up remains a human action the system prompts, preserving the community's relationship-first culture | 2026-09-22 |
| D3 | Custom PWA on managed services rather than no-code assembly (alternatives weighed in v0.1: Google Forms + Sheets + Apps Script, Airtable, Glide) | 2026-09-22 |
| D4 | **Rollout:** DMV pilot → New York and Texas → all US | 2026-09-23 |
| D5 | **Historical data:** ~30,000 records in a Google Sheet, imported per the import template | 2026-09-23 |
| D6 | **Ownership and budget:** KG is admin, budget owner, and long-term steward; start minimal on free tiers. All service accounts are created under the project Google account **novasahajameditation@gmail.com**, with KG's personal account as recovery and backup admin (see [SETUP_ACCOUNTS.md](SETUP_ACCOUNTS.md)) | 2026-09-23 |
| D7 | **Consent:** no written consent statement at intake for now; opt-out always available; revisit later | 2026-09-23 |
| D8 | **Messaging channels:** SMS **and** WhatsApp | 2026-09-23 |
| D9 | **Eventbrite:** one API key with access to multiple organizations; a backfill script pulls seekers from all events in all organizations, then ongoing sync | 2026-09-23 |
| D10 | **AI review:** only drafts from new or changed templates are reviewed; approved templates send automatically | 2026-09-23 |
| D11 | **Testimonials:** later phase; videos kept on a private YouTube channel and linked | 2026-09-23 |

## 13. Open Questions

1. **Domain** — candidates checked 2026-09-23 in [SETUP_ACCOUNTS.md §1](SETUP_ACCOUNTS.md#1-domain); recommendation `sahajaseekers.org` (+ `.com`). KG to choose and register under the project Google account.
2. **SMS opt-in mechanics** — keyword (text JOIN) vs checkbox at intake; register the 10DLC brand as KG personally or as an organization?
3. **Backup admin** — KG's personal account is the recovery contact on every service; a second *person* with admin access is still to be named.
4. **Retention window** — how long before an inactive seeker is anonymized?
5. **YouTube privacy level** — *private* videos are visible only to invited Google accounts; *unlisted* videos are viewable by anyone with the link. If testimonials should be watchable from a portal link, unlisted is the practical setting.

## 14. Document History

| Version | Date | Source | Notes |
|---|---|---|---|
| v0.1 | 2026-09-02 | Google Doc (KG) | Original PRD: problem, goals, personas, MVP features, V2 ideas, NFRs, six open questions. Archived verbatim at [archive/PRD-v0.1-2026-09-02.md](archive/PRD-v0.1-2026-09-02.md). |
| v0.2 | 2026-09-22 | This repo | Merged the handwritten planning notes: requirements R1–R15, PWA only, communications in scope. |
| v0.3 | 2026-09-23 | This repo | Answers to all open questions: rollout, 30k import, ownership, consent, channels, Eventbrite, AI review, testimonials. Google Doc retired; this file is canonical. |

-----

*Draft for review. Feedback from KG and consulted coordinators to be incorporated before the architecture is finalized.*
