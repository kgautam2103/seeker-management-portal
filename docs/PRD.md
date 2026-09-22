# Seeker Management Portal — Product Requirements

**Status:** Draft v0.1 · **Updated:** 2026-09-22 · **Source:** planning notes (handwritten, 2026-09) · **Delivery:** Progressive Web App (no native mobile app)

## 1. Vision

> **"No seeker is ever lost."**

Every person who registers for, attends, or shows interest in a program is captured once, in one place, and receives timely, relevant follow-up — automatically where possible, personally where it matters.

## 2. Problem

Seeker information is scattered across Eventbrite exports, instructor notebooks, and spreadsheets. Historical records are inconsistent, new seekers are added ad hoc, and follow-up depends on individual memory. Seekers who miss a session or attend a single public program are often never contacted again.

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Single source of truth | Known seekers in the portal; duplicates by email/phone | 100% imported; 0 duplicates |
| Frictionless capture | Time for an instructor to add a seeker on a phone | < 60 seconds |
| No one slips through | No-shows / drop-offs contacted within 7 days | ≥ 90% |
| Re-engagement | Past seekers attending a later program | Baseline in Phase 1; improve in Phase 3 |
| Healthy sending | Email bounce rate / spam-complaint rate | < 2% / < 0.1% |
| Respect for seekers | Unsubscribe honored across channels | 100%, immediately |

## 4. Users

| Role | Who | Primary needs |
|---|---|---|
| **Admin / Coordinator** | Small core team | Import data, manage programs and campaigns, monitor sending, configure rules |
| **Instructor** | Volunteer teachers running sessions | Add seekers fast, mark attendance, leave remarks, get session reminders |
| **Seeker** | Program participants (no login) | Receive relevant, timely messages; submit a testimonial; unsubscribe easily |

## 5. Functional Requirements

Each requirement maps to an item in the planning notes.

| ID | Requirement | Acceptance |
|---|---|---|
| **F1** | **Historical import.** Import all existing seekers from CSV/XLSX using a published standard template. | Validates and normalizes name/email/phone/program/date; dedupes by email or phone; rows needing review are queued, not silently merged. |
| **F2** | **Instructor "Add Seeker" form.** Short, mobile-first form (name, phone, email, program, session, notes) shareable by link. | Completes in < 60s on a phone; works offline and syncs later; warns on likely duplicates before save. |
| **F3** | **Eventbrite sync.** Pull registrations for linked Eventbrite events into the database. | Scheduled sync + webhook; each event mapped to a program; new vs returning seekers flagged; registrations visible within 15 min. |
| **F4** | **Weekly program communications.** Email and messages (SMS/WhatsApp — channel TBD) to seekers enrolled in a weekly program. | Per-program audience; schedule, session reminders, materials, cancellations; every send logged against the seeker. |
| **F5** | **Public program invitations.** Targeted emails to past and inactive seekers about upcoming public programs. | Segment by program history, attendance, and recency; suppression list enforced; results tracked per campaign. |
| **F6** | **Attendance & remarks.** Instructors mark attendance per session and add per-seeker remarks. | One-tap present/absent from the session roster; free-text remarks with optional tags; history shown on the seeker profile; works offline. |
| **F7** | **Testimonials.** Seekers submit testimonials via a public link. | Link can be sent automatically after program completion; admin moderation queue; approve, publish, or export. |
| **F8** | **Rule engine + AI follow-ups.** Configurable rules drive automated follow-ups; an LLM personalizes content. | Rules = trigger → condition → action (e.g., 2 missed sessions → follow-up email). LLM drafts within admin-approved templates and tone; admin may require review before send; cooldowns prevent over-messaging. |
| **F9** | **Instructor reminders.** Email, message, and web push reminders before each session. | Configurable lead time; includes roster, location, and any unmarked attendance from the last session. |
| **F10** | **Email monitoring.** Track delivery health for every message. | Sent/delivered/opened/clicked/bounced/complained per message; deliverability dashboard; hard bounces auto-suppressed. |
| **F11** | **Unsubscribe & preferences.** Seekers can opt out of any channel at any time. | One-click unsubscribe in every email; STOP handling for messages; per-channel preferences; global suppression list checked on every send. |

## 6. Out of Scope

- Native iOS/Android apps — the portal ships as a **PWA** only.
- Payments and ticketing — remain in Eventbrite.
- Replacing Eventbrite as the public registration front end.
- Seeker accounts/login — seekers interact only through emailed or shared links.
- General-purpose marketing automation — rules are purpose-built for the follow-up flows above.

## 7. Platform Requirements (PWA)

- Installable (web app manifest + service worker); responsive from 360px width.
- Offline-first for instructor flows (F2, F6): local queue with background sync; conflicts resolved last-write-wins with an audit trail.
- Web push for instructor reminders (F9). iOS requires the PWA to be added to the Home Screen (iOS 16.4+) — covered in instructor onboarding.
- Auth: magic link or Google sign-in for admins and instructors; roles: Admin, Instructor.
- Accessibility: WCAG 2.1 AA for forms and core flows.

## 8. Core Data Model

| Entity | Purpose |
|---|---|
| Seeker | Person record; unique by email/phone; consent and preference flags |
| Program | Weekly or public; owns sessions and an audience |
| Session | Dated occurrence of a program; has an instructor and a roster |
| Registration | Seeker ↔ Program link; source = import, instructor, or Eventbrite |
| Attendance / Remark | Per seeker per session |
| Testimonial | Seeker-submitted; moderation status |
| User | Admin or Instructor |
| Message / Campaign | Every outbound send, its channel, template, and delivery events |
| Rule | Trigger, conditions, action, cooldown |
| Suppression | Unsubscribes, hard bounces, complaints — per channel |

## 9. Integrations

- **Eventbrite API** — OAuth, events/attendees, webhooks
- **Email provider** with event webhooks (e.g., Postmark, Resend, SendGrid)
- **Messaging provider** (e.g., Twilio) for SMS and/or WhatsApp — channel to confirm
- **LLM API** (e.g., Claude API) for follow-up content generation
- **Web Push** (VAPID)

## 10. Privacy & Compliance

- Collect minimum fields; role-based access; audit log for exports and bulk actions.
- Record consent source and timestamp at capture; honor unsubscribe across all channels.
- Meet CAN-SPAM and applicable regional consent rules; support deletion on request.
- AI-generated content never includes another seeker's data; remarks are internal-only.

## 11. Open Questions

1. Messaging channel — SMS, WhatsApp, or both? (drives provider, cost, and WhatsApp template approval lead time)
2. Historical data — how many records, in how many formats/sources?
3. Which Eventbrite account(s) to link?
4. Sending domain and from-address; who controls DNS for SPF/DKIM/DMARC?
5. AI content — always reviewed before send, or only for new templates?
6. Where are approved testimonials published?
7. Expected scale — seekers, sessions per week, instructors.
