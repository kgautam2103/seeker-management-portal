# Accounts, Domain, and Prerequisites

**Owner identity:** every service account below is created with **novasahajameditation@gmail.com** (the project's Google account), not a personal address. KG's personal account is the recovery contact and backup admin. Decided 2026-09-23.

Do these in order; the ones marked *lead time* should start early because someone else's approval is involved.

-----

## 0. Before anything else

| Step | Why |
|---|---|
| Turn on 2-Step Verification on novasahajameditation@gmail.com; add a recovery phone and KG's personal email as recovery | Every other account will hang off this one |
| Create a password-manager vault for the project (Bitwarden free or 1Password) and share it with KG's personal account | Recovery codes, API keys, and the database password live here — never in the repo or in chat |
| Decide the domain (below) | Vercel, Resend, and Supabase Auth all need it |

## 1. Domain

**Checked 2026-09-23 (whois):**

| Domain | Status | Notes |
|---|---|---|
| **sahajaseekers.org** | available | **Recommended.** Says what the portal is for, is not tied to one region (the rollout ends at all US), and does not collide with the organization's own `sahajayoga.*` names. Also take `.com` (available) to redirect. |
| novasahaja.org / .com | available | Matches the Google account's "NoVA Sahaja" identity; short. Regional — fine if the brand is meant to stay Northern Virginia-first. |
| sahajameditationusa.org | available | National, descriptive, longer. |
| seekerportal.org / seekersportal.org | available | Generic; no community identity. |
| dmvsahaja.org / sahajadmv.org | available | Regional. |
| sahajacenter.org, novameditation.org, sahajanova.org | available | Weaker fits. |
| sahajameditation.org, meditatenova.org | taken | — |

Availability was checked with `whois` and can change at any time; confirm at the registrar before deciding.

**Registrar:** Cloudflare Registrar (at-cost pricing, free DNS, DNSSEC) or Porkbun. Create the registrar account with the project Google account. Avoid Squarespace Domains (the former Google Domains) — pricier, and the account would be tied to a Google identity anyway. `.org` is the right primary TLD for a volunteer community project; register for 2+ years and turn on auto-renew.

**DNS layout** (assuming `sahajaseekers.org`):

| Host | Purpose |
|---|---|
| `portal.sahajaseekers.org` | The PWA (Vercel) |
| `notify.sahajaseekers.org` | Sending domain for Resend — a subdomain isolates bulk-mail reputation from the root; SPF, DKIM, DMARC records live here |
| root | Optional landing page later; MX only if you ever want mailboxes |

## 2. Code hosting — GitHub

The repo is currently under KG's personal `kgautam2103`. Vercel's free Hobby plan can only deploy from repositories owned by the *personal* GitHub account it is signed in with, not from GitHub organizations (organizations require Vercel Pro). Two workable paths:

| Option | How | Trade-off |
|---|---|---|
| **A — project GitHub account (recommended for free tier)** | Create GitHub user `novasahajameditation` with the project email; transfer the repo to it; add `kgautam2103` as a collaborator with admin | GitHub's terms allow one free personal account *per person*; a second account that represents the project is common practice but is a gray area. Vercel Hobby works. |
| B — GitHub organization + Vercel Pro | Create org `nova-sahaja`, transfer the repo, connect Vercel Pro ($20/month) | Clean ownership; costs $20/month from day one |

Either way: enable 2FA, protect `main` (require CI green before merge), and keep the repo public with no real data.

## 3. Services (Phase 1)

| Service | Sign in with | Create | Then | Lead time |
|---|---|---|---|---|
| **Vercel** | GitHub (project account) — Hobby | Import the repo; framework preset Next.js | Add domain `portal.<domain>`; set env vars from `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` | none |
| **Supabase** | Google (project account) — Free | Organization "Nova Sahaja Meditation"; project in **us-east-1 (N. Virginia)**; save the DB password in the vault | Auth → Providers: enable Email (magic link) and Google (needs step 4); Auth → URL configuration: Site URL `https://portal.<domain>`, redirect URLs `https://portal.<domain>/auth/callback` and `http://localhost:3000/auth/callback`; **Auth → SMTP: use Resend** (Supabase's built-in mailer allows only a few emails per hour); run the migration with `npx supabase link` + `db push` | none |
| **Inngest** | Google (project account) — Free | App `seeker-portal` | Install the Inngest ↔ Vercel integration; it sets `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` on Vercel | none |
| **Resend** | Google (project account) — Free | Add domain `notify.<domain>`; add the DKIM/SPF/DMARC records at the registrar | API key → Vercel `RESEND_API_KEY`; webhook `https://portal.<domain>/api/webhooks/resend` → signing secret; also configure Supabase Auth SMTP with it | DNS propagation minutes–hours; warm up sending volume gradually |
| **Sentry** | Google (project account) — Developer | Org + Next.js project | DSN → `NEXT_PUBLIC_SENTRY_DSN`; install the Sentry ↔ Vercel integration for `SENTRY_AUTH_TOKEN` / org / project | none |
| **Uptime ping** | Google (project account) | UptimeRobot (free) monitor on `https://portal.<domain>/api/health` every 5 min | Keeps the free-tier database awake and alerts on downtime | none |

## 4. Google Cloud (under the project Google account)

Create one Google Cloud project, `nova-sahaja-portal`:

| Item | For | Notes |
|---|---|---|
| **OAuth client (Web application)** | "Continue with Google" sign-in via Supabase Auth | Authorized redirect URI: `https://<supabase-ref>.supabase.co/auth/v1/callback`; paste client id/secret into Supabase Auth → Google. Publish the OAuth consent screen (external, no sensitive scopes). |
| **Service account** | Reading the historical Google Sheet for the import (R2) | Enable the Google Sheets API; create a key (JSON) → base64 into `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON`; share the sheet with the service-account email as **Viewer** |
| **YouTube channel** (Phase 3) | Testimonial videos | Brand account under the project Google identity; decide *unlisted* vs *private* (PRD open question 5) |

## 5. Existing access to carry over

| Item | Action |
|---|---|
| **Eventbrite private API key** (KG's, with access to all organizations) | Store as `EVENTBRITE_PRIVATE_TOKEN` on Vercel and in the vault. Later, consider creating an Eventbrite user for the project email and moving organization access to it, so the integration does not depend on KG's personal Eventbrite login. |
| **Historical Google Sheet** | Share with the import service account (step 4) when it exists |

## 6. Phase 2 prerequisites (start at the beginning of Phase 2 — lead time)

| Service | Notes |
|---|---|
| **Twilio** | Account under the project email; buy a US number; **A2P 10DLC** brand and campaign registration is required for US SMS — the brand needs a legal identity (individual/sole proprietor registration exists but has lower throughput; an entity with an EIN registers normally). Decide who the registrant is (PRD open question 2). Weeks, not days. |
| **WhatsApp Business (via Twilio)** | Requires a Meta Business Manager account and business verification, which expects a legal entity and a public web presence; message templates need Meta approval. Weeks. |

## 7. Phase 3 prerequisites

| Service | Notes |
|---|---|
| **Anthropic Console** (Claude API) | Account under the project email; API key → `ANTHROPIC_API_KEY`; set a monthly spend limit |

## 8. Rules that apply everywhere

- 2FA on every account; recovery codes in the vault.
- KG's personal account is recovery/backup admin on Google, GitHub, Vercel, and Supabase — the portal must never depend on a single login (PRD open question 3).
- Secrets exist only in Vercel environment variables, the vault, and local `.env.local`. The repository holds `.env.example` only.
- Production Supabase access: the steward and the backup admin only.
