> **Archived original.** This is the v0.1 PRD as written in the Google Doc on 2026-09-02, preserved verbatim (author email updated to the personal address) so nothing from it is lost. It is superseded by [../PRD.md](../PRD.md), which merges every point below; the Google Doc itself has been retired.

# Product Requirements Document: Seeker Management Portal

**Author:** Kumar Gautam (22.gautam@gmail.com) — personal/volunteer project, Sahaja Yoga meditation community
**Status:** Draft v0.1 — for review
**Date:** 2026-09-02

**Important note on scope:** This is a planning document only. Nothing described here has been built, purchased, or deployed. No accounts, domains, or tools have been created. This PRD exists to align on requirements before any implementation work begins.

-----

## 1. Problem Statement / Background

Sahaja Yoga meditation is offered free of charge by volunteers, typically at local centers, public programs, or introductory sessions. People who attend for the first time or are newly exploring the practice are referred to within the community as "seekers." Today, most centers track seekers informally — through paper sign-in sheets, personal notebooks, scattered WhatsApp chats, or an individual volunteer's memory. This creates several recurring problems:

- **Lost follow-up:** A seeker who attends one session but isn't personally invited back within a few days is unlikely to return. Without a system, follow-up depends entirely on whether a volunteer happens to remember and has the contact details on hand.
- **No visibility into drop-off:** Centers have no reliable way to see how many seekers attended once, attended a few times, or became regular practitioners — so there's no way to identify where in the journey people disengage or why.
- **Fragmented ownership:** Contact information often lives in one volunteer's personal phone or notebook. When that volunteer becomes unavailable (moves, gets busy, steps back), the relationship and the data are effectively lost.
- **No way to match seekers to the right session:** A seeker's nearest center, preferred day/time, or language may not match the session they first attended. There's no shared system to route them to a better fit.
- **Regional/national reporting is manual and unreliable:** Regional coordinators who want to understand overall program reach and effectiveness across multiple centers currently have to manually collect information center-by-center, if they can get it at all.

A lightweight, shared Seeker Management Portal would give volunteers, session instructors, and regional coordinators a simple, common system to capture seeker information once, follow up consistently, and understand how well the program is retaining new people — without adding significant overhead to an all-volunteer effort.

-----

## 2. Goals and Success Metrics

### Goals

- Make it easy for any volunteer to record a new seeker's information in under a minute, from a phone, immediately after a session.
- Ensure every new seeker gets a timely, appropriate follow-up (a call, message, or invitation) rather than falling through the cracks.
- Give volunteers and coordinators a clear, at-a-glance view of who is new, who is returning, and who has gone quiet.
- Provide basic, honest reporting on program reach and retention that regional coordinators can use without weeks of manual data-gathering.
- Do all of this while remaining simple enough that non-technical volunteers can use and maintain it without ongoing developer support.

### Candidate Success Metrics (to be refined with KG/coordinators)

- **Follow-up response time:** % of new seekers contacted within 48–72 hours of their first session.
- **Seeker retention rate:** % of seekers who attend a 2nd session within 30 days; % who are still active after 90 days.
- **Data capture rate:** % of session attendees whose contact info is actually recorded (a proxy for whether volunteers are actually using the tool).
- **Session attendance tracking coverage:** % of sessions/centers that log attendance regularly.
- **Volunteer adoption:** number/% of active centers or instructors using the portal regularly (e.g., monthly).
- **Time-to-log:** average time it takes a volunteer to register a new seeker (should stay low — a proxy for usability).

These are starting suggestions; actual targets should be set once there's a baseline (see Open Questions).

-----

## 3. Target Users / Personas

**Volunteer Coordinator (primary user)** A local center volunteer who manages day-to-day seeker relationships — greeting newcomers, collecting contact info, sending follow-ups, and inviting seekers back. Likely using a phone, not a laptop. Not technical. Time-constrained; this is unpaid work on top of a regular job/life.

**Session Instructor / Facilitator** Leads the actual meditation session. May take attendance and note who's new vs. returning, but is focused on facilitating, not admin. Needs a very low-friction way to record attendance during or right after a session.

**Regional/National Coordinator** Oversees multiple centers in a city, region, or country. Wants a rollup view: how many seekers per center, retention trends, which centers need support. Not involved in day-to-day data entry. May be the closest thing to a "power user" or admin of the system.

**Seeker (potential future self-service user)** The new/prospective practitioner. In a v1, seekers are the subject of records, not necessarily active users of the portal. A future self-service angle (e.g., seekers registering themselves via a simple public form, checking session schedules, or updating their own info) is plausible and low-risk since it only requires seekers to submit info they choose to share.

**System/Data Steward (informal role)** Someone (possibly KG, possibly a designated volunteer) responsible for the overall health of the system, access control, and data privacy compliance across centers. This role should be explicit even if it's a part-time responsibility.

-----

## 4. Core Features (V1 / MVP)

The MVP should be intentionally narrow: solve the follow-up and visibility problem first, without trying to be a full CRM.

- **Seeker intake / registration form** A short form (mobile-friendly) capturing: name, phone/email, city/area, how they heard about the session, date of first session, and center/session attended. Should take under a minute to fill out, usable by a volunteer on behalf of the seeker or (optionally) by the seeker directly on a shared tablet/QR code.
- **Center and session directory** A simple list of centers, their locations, and regular session times, so seekers can be assigned/matched to the most convenient one.
- **Session/center assignment** Ability to tag which center or session a seeker is associated with (their "home" center) — needed to route follow-ups to the right local volunteer.
- **Attendance tracking** Simple per-session check-in (new vs. returning) so attendance history builds up automatically over time per seeker.
- **Follow-up reminders** Automated nudges to the assigned volunteer (e.g., "Follow up with [Seeker] — attended 3 days ago, not yet contacted") via email or WhatsApp. Does not need to message the seeker automatically in v1 — the goal is prompting the *volunteer* to take a personal action, which fits the community's relationship-first culture.
- **Volunteer dashboard** A simple view per center showing: new seekers this week/month, seekers due for follow-up, returning vs. lapsed seekers, and basic attendance counts.
- **Basic reporting** Center-level and rollup (regional) counts: total seekers, retention rate, sessions held, attendance trends over time — exportable or viewable by regional coordinators without needing raw data access.
- **Basic access control** Volunteers can see/manage seekers for their own center; regional coordinators can see rollups across centers they oversee. No public access to seeker personal data.

-----

## 5. Nice-to-Have / Future Features (V2+)

- **Mobile app** (native or PWA) for faster on-the-go logging by volunteers and instructors.
- **WhatsApp integration**, e.g., auto-adding consenting seekers to a center's WhatsApp group, or sending automated (opt-in) reminders directly to seekers about upcoming sessions.
- **Multi-language support**, since Sahaja Yoga operates globally and many seekers/volunteers are not native English speakers.
- **Program effectiveness analytics**, e.g., correlating retention with factors like instructor, session format, day/time, or follow-up speed.
- **Session scheduling / calendar integration**, letting seekers see and self-register for upcoming sessions (e.g., synced with Google Calendar).
- **Self-service seeker portal**, where seekers can update their own contact info, see their attendance history, or find nearby centers while traveling.
- **Automated seeker journey stages** (e.g., "new," "engaged," "regular practitioner," "lapsed") with rules-based nudges to volunteers as seekers move between stages.
- **Cross-region seeker lookup**, useful for seekers who travel or relocate and want to continue with a center elsewhere in the same system.
- **Integration with existing tools** the community may already use informally (shared spreadsheets, existing WhatsApp broadcast lists, an existing website), pending discovery of what currently exists.

-----

## 6. Non-Functional Requirements

**Data privacy and consent (critical — this system holds personal data of members of the public)**

- Seekers are not employees or paying customers; they are members of the public who have not necessarily agreed to be tracked in a database. Consent must be explicit and easy to understand — e.g., a simple statement at the point of intake explaining what data is collected, why, and how it will be used (follow-up and program improvement only), with an opt-out.
- Data collected should be minimized to what's actually needed (name, contact info, city, session attended) — no unnecessary personal data (e.g., no health information, no ID numbers).
- Seekers should be able to request their data be corrected or deleted ("right to be forgotten"), consistent with general good practice and relevant data protection norms (e.g., GDPR-like principles), especially if the community has seekers/centers in the EU or other jurisdictions with formal privacy law.
- Access to seeker data should be limited by role and by center — a volunteer in one city should not have open access to seeker lists from unrelated centers/regions.
- Data should not be sold, shared with third parties, or used for anything beyond the stated purpose (program follow-up and reporting).
- A basic data retention policy should exist (e.g., archiving or anonymizing records after a period of inactivity) rather than keeping personal data indefinitely by default.

**Simplicity and low maintenance**

- The system is run entirely by volunteers with no dedicated IT staff. It must be maintainable by non-developers after initial setup, or require minimal, infrequent technical intervention.
- Prefer a small number of well-understood building blocks (e.g., a simple hosted form + spreadsheet-backed database, or a no-code/low-code tool) over a custom-built application, unless a custom build is clearly justified by scale.

**Cost**

- The community operates on donations and volunteer time; the system should run on free or near-free tiers wherever possible (e.g., free tiers of no-code platforms, free-tier cloud hosting, free email/WhatsApp Business API allowances) at the expected initial scale.

**Ease of use for non-technical volunteers**

- Primary interactions (intake, attendance, follow-up marking) should be usable on a basic smartphone, require no training beyond a one-page guide, and tolerate imperfect data entry gracefully (e.g., no fields so strictly required that a rushed volunteer gets stuck).

**Reliability and availability**

- The system doesn't need enterprise-grade uptime, but it should be available during and shortly after sessions (typically evenings/weekends) when volunteers are actually logging data.

**Localization readiness**

- Even if multi-language support is a v2 feature, the v1 data model and field choices should not assume English-only names, addresses, or phone formats, so international expansion isn't blocked later.

-----

## 7. Open Questions / Assumptions Requiring KG's Input

These are the biggest unknowns that materially affect the right technical and process approach, and should be resolved before scoping build effort:

1. **Scale:** How many centers, volunteers, and seekers are we talking about — a single city, a country, or a global rollout across many countries? This drives nearly every other decision (hosting choice, multi-language needs, access-control complexity, and whether a no-code tool is even sufficient).
2. **Existing tools and data:** Is there already an informal system in place today (shared spreadsheet, WhatsApp broadcast lists, an existing Sahaja Yoga website or app used by other regions) that this should integrate with, replace, or avoid duplicating? Are there existing seeker records that would need to be migrated?
3. **Budget and hosting ownership:** Is there any budget at all (even a few dollars/month), or does this need to run entirely on free tiers? Relatedly, who would own/pay for the domain, hosting account, or any paid API (e.g., WhatsApp Business API, which is not fully free at scale)? Who holds the "keys" (admin login) long-term so this doesn't become another single-point-of-failure like the current notebooks?
4. **Governance and consent process:** Who has the authority to approve the data collection/consent language on behalf of the organization (given this touches personal data of the public), and is there an existing privacy policy or precedent from Sahaja Yoga globally that this should follow rather than create from scratch?
5. **Build approach:** Should this be built as a custom lightweight web app, or assembled from existing no-code/low-code tools (e.g., Google Forms + Sheets + Apps Script, Airtable, Glide, or similar)? This is a build decision, not just a requirements decision, but it affects how "V1" should be scoped and by whom.
6. **Who maintains it:** Once built, who is the ongoing owner/steward — is it KG indefinitely, or is the intent to hand this off to a rotating volunteer or regional coordinator role?

-----

*End of draft. This document is intended as a starting point for review and revision — feedback and corrections from KG (and any coordinators consulted) should be incorporated before any build decisions are made.*

*All six open questions were answered on 2026-09-23 and are recorded as decisions D4–D11 in [../PRD.md](../PRD.md).*
