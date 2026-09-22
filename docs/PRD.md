# Product Requirements Document: Seeker Management Portal

**Author:** Kumar Gautam (22.gautam@gmail.com) — personal/volunteer project, Sahaja Yoga meditation community
**Status:** Draft v0.2 — for review · **Date:** 2026-09-22 · Supersedes v0.1 (2026-09-02)
**Delivery:** Progressive Web App (PWA) — no native mobile app · **Repo:** github.com/kgautam2103/seeker-management-portal

**Scope note:** Planning document only. Nothing has been built, purchased, or deployed; no accounts, domains, or tools have been created. This PRD exists to align on requirements before implementation begins.

-----

## 1. Vision

> **"No seeker is ever lost."**

Every person who registers for, attends, or shows interest in a Sahaja Yoga session is captured once, in one shared system, and receives timely follow-up — automated for logistics, personal where it matters.

-----

## 2. Problem / Background

Sahaja Yoga meditation is offered free of charge by volunteers at local centers, public programs, and introductory sessions. Newcomers are known as **seekers**. Today seekers are tracked informally — paper sign-in sheets, personal notebooks, WhatsApp chats, Eventbrite exports, and individual memory. The result:

- **Lost follow-up** — a seeker not personally invited back within days rarely returns; follow-up depends on who remembers.
- **No visibility into drop-off** — no one can see who attended once, a few times, or became regular, so nobody knows where people disengage.
- **Fragmented ownership** — contact details live in one volunteer's phone; when they step back, the relationship and the data go with them.
- **No routing** — a seeker's nearest center, preferred time, or language may not match the session they first attended.
- **Manual regional reporting** — coordinators collect numbers center by center, if at all.

A lightweight shared portal lets volunteers, instructors, and coordinators capture seekers once, follow up consistently, and see retention honestly — without adding overhead to an all-volunteer effort.

-----

## 3. Goals & Success Metrics

| Goal | Metric | Starting target |
|---|---|---|
| Capture every seeker | Session attendees with contact info recorded; historical records imported | ≥ 90%; 100% imported, 0 duplicates by email/phone |
| Frictionless intake | Time to log a new seeker on a phone | < 60 seconds |
| Timely follow-up | New seekers contacted within 72 h; no-shows/drop-offs contacted within 7 days | ≥ 90% / ≥ 90% |
| Retention | Seekers attending a 2nd session within 30 days; still active at 90 days | Baseline in Phase 1; improve in Phase 3 |
| Volunteer adoption | Active centers logging attendance monthly | ≥ 80% |
| Healthy, respectful sending | Bounce / spam-complaint rate; unsubscribe honored | < 2% / < 0.1%; 100%, immediately |

Targets are starting points, to be refined once a baseline exists.

-----

## 4. Users / Personas

| Persona | Who | Needs |
|---|---|---|
| **Volunteer Coordinator** (primary) | Local center volunteer managing seeker relationships; on a phone; non-technical; time-constrained | Log seekers fast, see who is due for follow-up, send program communications |
| **Session Instructor** | Leads the session; focused on facilitating, not admin | One-tap attendance, remarks, session reminders |
| **Regional / National Coordinator** | Oversees many centers; closest to an admin | Rollup of seekers, retention, and sessions per center; identify centers needing support |
| **Seeker** | Newcomer or returning practitioner; not a portal user | Relevant, timely messages; submit a testimonial; unsubscribe easily. Interacts only via emailed or shared links |
| **System / Data Steward** | KG or a designated volunteer | Access control, data privacy, system health |

-----

## 5. Requirements

Grouped by capability. Phase numbers reference the [Implementation Plan](IMPLEMENTATION_PLAN.md).

### A. Seeker capture

| ID | Requirement | Acceptance | Phase |
|---|---|---|---|
| **R1** | **Seeker intake form** — short, mobile-first form used by a volunteer or instructor (optionally by the seeker via QR/shared tablet). Fields: name, phone/email, city/area, how they heard of us, first session date, center/session. | < 60 s on a phone; works offline and syncs later; warns on likely duplicates; consent statement shown at intake; no field so strict a rushed volunteer gets stuck. | 1 |
| **R2** | **Historical import** — import existing seekers from CSV/XLSX using a published standard template. | Validates and normalizes name/email/phone/center/date; dedupes by email or phone; uncertain rows go to a review queue, never silently merged. | 1 |
| **R3** | **Eventbrite sync** — pull registrations for linked Eventbrite events. | Scheduled sync + webhook; each event mapped to a dated session (and so its program); new vs returning flagged; visible within 15 min. | 1 |
| **R4** | **Center & session directory** — centers, locations, regular session times; each seeker has a home center. | Follow-ups and access route to the right local volunteer; seekers can be reassigned to a better-fit center/session. | 1 |

### B. Sessions & attendance

| ID | Requirement | Acceptance | Phase |
|---|---|---|---|
| **R5** | **Attendance & remarks** — instructors mark attendance per session and add per-seeker remarks. | One-tap present/absent from the roster; new vs returning shown; free-text remarks with optional tags; works offline; history on the seeker profile. | 1 |
| **R6** | **Instructor session reminders** — email, message, and web push before each session. | Configurable lead time; includes roster, location, and any unmarked attendance from the last session. | 2 |
| **R7** | **Volunteer follow-up nudges** — prompt the assigned volunteer to make personal contact. | e.g., "Follow up with [Seeker] — attended 3 days ago, not yet contacted"; marks contact done; visible on the dashboard and sent via email/message. | 2 |

### C. Communication with seekers

| ID | Requirement | Acceptance | Phase |
|---|---|---|---|
| **R8** | **Weekly program communications** — email and messages (WhatsApp/SMS — channel TBD) to seekers enrolled in a weekly program. | Per-program audience; schedule, reminders, materials, cancellations; every send logged against the seeker. | 2 |
| **R9** | **Public program invitations** — targeted emails to past and inactive seekers about upcoming public programs. | Segment by program history, attendance, recency, and center; suppression list enforced; results tracked per campaign. | 2 |
| **R10** | **Testimonials** — seekers submit testimonials via a public link. | Optional automatic request after program completion; moderation queue; approve, publish, or export. | 2 |
| **R11** | **Unsubscribe & preferences** — seekers opt out of any channel at any time. | One-click unsubscribe in every email; STOP handling for messages; per-channel preferences; global suppression checked on every send. Ships before the first campaign. | 2 |
| **R12** | **Delivery monitoring** — track health of every message. | Sent/delivered/opened/clicked/bounced/complained per message; deliverability dashboard; hard bounces auto-suppressed. | 2 |

### D. Intelligence & insight

| ID | Requirement | Acceptance | Phase |
|---|---|---|---|
| **R13** | **Rule engine + AI follow-ups** — configurable rules drive follow-up; an LLM personalizes content. | Rule = trigger → condition → action. Triggers: no-show, missed sessions, program completed, inactive N days. Actions: message the seeker **or** create a task for the volunteer. LLM drafts within admin-approved templates and tone; review-before-send available; cooldowns prevent over-messaging. | 3 |
| **R14** | **Dashboards & reporting** — center dashboard and regional rollup. | Center: new seekers this week/month, due for follow-up, returning vs lapsed, attendance counts (Phase 1). Regional: seekers per center, retention, sessions, trends; exportable without raw-data access (Phase 3). | 1 / 3 |
| **R15** | **Access control** — by role and by center. | Volunteers see their own center's seekers; regional coordinators see rollups for centers they oversee; no public access to personal data. | 1 |

-----

## 6. Out of Scope

- Native iOS/Android apps — **PWA only** (v0.1 listed a mobile app as a future option; decided).
- Payments and ticketing — remain in Eventbrite; the portal does not replace Eventbrite as the public registration front end.
- Seeker accounts or login — seekers interact only via links (self-service is a future option).
- General-purpose CRM or marketing automation — rules are purpose-built for the flows above.
- Health or other sensitive personal data — never collected.

## 7. Future (V2+)

Multi-language UI (data model localization-ready from v1) · seeker self-service portal and session self-registration/calendar · cross-region seeker lookup for travelers · program-effectiveness analytics (retention vs instructor, format, time, follow-up speed) · WhatsApp group auto-add for consenting seekers · integration with existing informal tools, pending discovery.

-----

## 8. Non-Functional Requirements

**Privacy & consent (critical — personal data of members of the public)**
- Explicit, plain-language consent at intake: what is collected, why (follow-up and program improvement only), and how to opt out.
- Data minimization: name, contact, city, center/session only. No health data, no ID numbers.
- Seekers can request correction or deletion; deletion honored across channels.
- Access limited by role and center; audit log for exports and bulk actions. No third-party sharing or sale.
- Retention policy: archive or anonymize after a defined period of inactivity.
- AI-generated content never includes another seeker's data; remarks are internal-only.

**Simplicity & low maintenance** — volunteer-run with no IT staff. Managed services over self-hosting; one-page guides suffice for training; infrequent technical intervention.

**Cost** — free or near-free tiers at initial scale. WhatsApp Business API is not fully free at scale; channel choice must account for this.

**Ease of use** — basic smartphone, no training beyond a one-page guide, tolerant of imperfect data entry.

**Reliability** — available evenings and weekends around sessions; offline-tolerant for instructor flows.

**Localization readiness** — non-English names, international phone formats, no English-only assumptions in the data model.

**PWA platform** — installable (manifest + service worker); responsive from 360px; offline-first intake and attendance with background sync (last-write-wins with audit); web push for reminders (iOS requires Home Screen install, iOS 16.4+ — part of onboarding); auth via magic link or Google sign-in; roles Admin, Coordinator, Instructor; WCAG 2.1 AA for core flows.

-----

## 9. Core Data Model

| Entity | Purpose |
|---|---|
| Seeker | Person record; unique by email/phone; home center (optional until assigned); mentor; consent source, timestamp, and preferences |
| Center | Location, regular session times, assigned volunteers |
| Program | Weekly or public; belongs to a center; owns sessions and an audience |
| Session | Dated occurrence of a program; instructor; roster |
| Registration | Seeker ↔ Program, plus the session when known (Eventbrite); source = intake, import, or Eventbrite |
| Attendance / Remark | Per seeker per session |
| Testimonial | Seeker-submitted; moderation status |
| User | Admin, Regional Coordinator, Volunteer Coordinator, or Instructor; center scope |
| Message / Campaign | Every outbound send: channel, template, delivery events |
| Rule | Trigger, conditions, action, cooldown |
| Suppression | Unsubscribes, hard bounces, complaints — per channel |

## 10. Integrations

Eventbrite API (OAuth, attendees, webhooks) · email provider with delivery-event webhooks · messaging provider for WhatsApp and/or SMS · LLM API (e.g., Claude API) for follow-up drafting · Web Push (VAPID).

-----

## 11. Decisions Since v0.1

1. **PWA, not a native app.** One codebase, installable on any phone, offline-capable.
2. **Automated communication to seekers is in scope** (v0.1 deferred it). Automation covers logistics — schedules, reminders, invitations, testimonial requests. Personal follow-up remains a volunteer action that the system prompts, preserving the community's relationship-first culture.
3. **Direction: custom PWA on managed services** rather than a no-code assembly, given Eventbrite sync, offline use, and rules. Ops stays near zero by using hosted providers on free tiers. To confirm with the architecture step.

## 12. Open Questions

1. **Scale** — how many centers, volunteers, and seekers; one city, one country, or global? Drives hosting, localization, and access-control complexity.
2. **Existing data and tools** — how many historical records, in what formats; any spreadsheets, WhatsApp lists, or websites to integrate with or replace?
3. **Budget and ownership** — any budget at all? Who owns the domain, hosting, and paid APIs; who holds admin keys long-term?
4. **Governance and consent** — who approves consent language on behalf of the organization; is there an existing Sahaja Yoga privacy policy to follow?
5. **Long-term steward** — KG indefinitely, or handed to a rotating coordinator role?
6. **Messaging channel** — WhatsApp, SMS, or both? Affects provider, cost, and WhatsApp template-approval lead time.
7. **Eventbrite account(s)** to link; **sending domain** and who controls DNS (SPF/DKIM/DMARC).
8. **AI review policy** — every AI draft reviewed before send, or only new templates?
9. **Testimonials** — where are approved testimonials published?

-----

*Draft for review. Feedback from KG and consulted coordinators to be incorporated before the architecture step begins.*
