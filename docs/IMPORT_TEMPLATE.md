# Seeker Import Template (R2)

**Status:** v1.5 (KG decisions applied 2026-09-22/23) · **Source:** the existing Google Sheet (~30,000 rows) · **File:** [`assets/seeker-import-template.csv`](assets/seeker-import-template.csv) (header row + two synthetic example rows) · **Format:** CSV or XLSX, UTF-8, one seeker per row, first row = headers exactly as below.

The importer reads the Google Sheet directly (share it with the importer's service account as Viewer) or an exported CSV/XLSX. Large sheets run as a background job in chunks; progress and outcomes appear in the batch view. The import tool validates and normalizes every row, deduplicates against existing seekers by email or phone, and sends anything uncertain to a review queue. It never silently merges. See [DATA_MODEL.md](DATA_MODEL.md) §3.2 and §3.5 for where each column lands.

## Columns (19)

| # | Column | Required | Format / allowed values | Lands in | Notes |
|---|---|---|---|---|---|
| 1 | `full_name` | **Yes** | Free text, any script | `seeker.full_name` | One field — do not split first/last. |
| 2 | `email` | **Either email or phone** | Valid email; case-insensitive | `seeker.email` | Primary dedupe key. A row needs at least one of email or phone; both is best. |
| 3 | `phone` | **Either email or phone** | Any readable format; normalized to E.164 using `country_code` | `seeker.phone_e164` | Secondary dedupe key. A phone that cannot be normalized sends the row to review. |
| 4 | `country` | Recommended | Country name (`United States`, `India`, `United Kingdom`) | resolves `seeker.country_code` when column 5 is blank | Human-readable; the code is what is stored. If both `country` and `country_code` are given and disagree, the row goes to review. |
| 5 | `country_code` | Recommended | ISO 3166-1 alpha-2 (`US`, `IN`, `GB`) | `seeker.country_code`, phone normalization | Canonical value. Blank → resolved from `country`; if that is blank too → the center's country, else the batch's default country. |
| 6 | `city` | **Yes** | Free text | `seeker.city` | |
| 7 | `state` | **Yes for US**; optional elsewhere | US: state name or 2-letter code (`California` or `CA`), normalized to the code. Other countries: free-text province/region | `seeker.state` | A US row (`country_code = US`) with a blank or unrecognized state is rejected. |
| 8 | `center` | Good to have | Exact center name from the directory | `seeker.home_center_id` | Blank → the batch's center if the upload was made for one, otherwise left unassigned (visible to admins only until a coordinator assigns it). A name that matches no center → review, not rejection. |
| 9 | `program` | No | Exact program name at that center | `registration` (source `import`) | Blank = seeker only, no program link. Ignored with a warning if `center` is blank. |
| 10 | `first_session_date` | Recommended | `YYYY-MM-DD` | `seeker.first_session_at` | |
| 11 | `last_attended_date` | Recommended | `YYYY-MM-DD` | `seeker.last_activity_at`, initial `stage` | Attendance is not imported session by session; this date plus the count below seed the journey stage. |
| 12 | `sessions_attended` | Recommended | Integer ≥ 0 | initial `stage` | Approximate is fine. |
| 13 | `how_heard` | No | Free text (`Friend`, `Eventbrite`, `Flyer`, `Web`, …) | `seeker.how_heard` | |
| 14 | `language` | No | BCP-47 tag (`en`, `hi`, `fr`, `pt-BR`) | `seeker.locale` | Defaults to `en`. |
| 15 | `consent_email` | No | `yes` / `no` — **blank = yes** | `consent` (channel `email`) | `no` also adds a `suppression` row so the address is never emailed. |
| 16 | `consent_messages` | No | `yes` / `no` — **blank = yes** | `consent` (channels `sms`, `whatsapp`) | Same rules as above. |
| 17 | `mentor_name` | No | Free text | `seeker.mentor_name` | The volunteer who personally guides this seeker. |
| 18 | `mentor_email` | No | Email | `seeker.mentor_email`, `seeker.mentor_user_id` | If it matches an existing portal user, the mentor is linked and becomes the default assignee for follow-up tasks. Otherwise stored as text and flagged for later linking. |
| 19 | `notes` | No | Free text | `remark` (internal) | Never rendered into any message. |

No written consent is collected today (decision 2026-09-23), so the two consent columns record **known opt-outs only**. Consent rows written by the import carry `source = import:<batch_id>` with a null `text_version` and the import date as timestamp. The default of *yes* reflects that these seekers gave their details for follow-up; every message still carries one-click unsubscribe or STOP, and any `no` here is honored immediately. SMS additionally requires the Phase 2 opt-in before marketing texts are sent.

## Row outcomes

| Outcome | When | What happens |
|---|---|---|
| `created` | No existing seeker matches email or phone | New seeker, plus registration / consent / remark as provided |
| `matched` | Email or phone matches exactly one existing seeker | Existing seeker kept; blank fields filled in; registration / consent added if new |
| `needs_review` | Email matches one seeker and phone matches a different one; name very similar to an existing seeker with different contact; phone cannot be normalized; `country` cannot be resolved or disagrees with `country_code`; `center` given but matches no center | Row held in the review queue with the candidate matches or the problem shown |
| `rejected` | Missing `full_name`; missing `city`; both `email` and `phone` blank; US row with missing or unrecognized `state` | Row skipped; reason reported in the batch summary |

## Rules

- Headers must match exactly (lower-case, underscores). Extra columns are ignored with a warning; missing optional columns are fine.
- Dates are `YYYY-MM-DD`. Anything else → the row goes to review.
- Whitespace is trimmed; emails are lower-cased; phones are normalized to E.164; country names are resolved to ISO-2 codes; US state names are resolved to 2-letter codes.
- **US records:** `city` and `state` are both mandatory. Other countries: `city` mandatory, `state` optional.
- **Do not include** health information, identity numbers, dates of birth, street addresses, or anything beyond the columns above — the importer drops unknown columns and logs a warning.
- Use synthetic data only in this public repo. Real seeker exports must never be committed; keep them outside the repository.
