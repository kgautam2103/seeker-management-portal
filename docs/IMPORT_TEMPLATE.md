# Seeker Import Template (R2)

**Status:** v1 draft · **File:** [`assets/seeker-import-template.csv`](assets/seeker-import-template.csv) (header row + two synthetic example rows) · **Format:** CSV or XLSX, UTF-8, one seeker per row, first row = headers exactly as below.

The import tool validates and normalizes every row, deduplicates against existing seekers by email or phone, and sends anything uncertain to a review queue. It never silently merges. See [DATA_MODEL.md](DATA_MODEL.md) §3.2 and §3.5 for where each column lands.

## Columns

| # | Column | Required | Format / allowed values | Lands in | Notes |
|---|---|---|---|---|---|
| 1 | `full_name` | **Yes** | Free text, any script | `seeker.full_name` | One field — do not split first/last. |
| 2 | `email` | One of email / phone | Valid email; case-insensitive | `seeker.email` | Primary dedupe key. |
| 3 | `phone` | One of email / phone | Any readable format; normalized to E.164 using `country_code` | `seeker.phone_e164` | Secondary dedupe key. Rows whose phone cannot be normalized go to review. |
| 4 | `country_code` | Recommended | ISO 3166-1 alpha-2 (`US`, `GB`, `IN`, …) | phone normalization | Defaults to the center's country if blank. |
| 5 | `city` | No | Free text | `seeker.city` | |
| 6 | `center` | **Yes** | Exact center name from the directory | `seeker.home_center_id` | Unknown center → row rejected with a clear message; fix the directory or the sheet. |
| 7 | `program` | No | Exact program name at that center | `registration` (source `import`) | Blank = seeker only, no program link. |
| 8 | `first_session_date` | Recommended | `YYYY-MM-DD` | `seeker.first_session_at` | |
| 9 | `last_attended_date` | Recommended | `YYYY-MM-DD` | `seeker.last_activity_at`, initial `stage` | Historical attendance is not imported session by session; this date plus the count below seed the journey stage. |
| 10 | `sessions_attended` | Recommended | Integer ≥ 0 | initial `stage` | Approximate is fine. |
| 11 | `how_heard` | No | Free text (`Friend`, `Eventbrite`, `Flyer`, `Web`, …) | `seeker.how_heard` | |
| 12 | `language` | No | BCP-47 tag (`en`, `hi`, `fr`, `pt-BR`) | `seeker.locale` | Defaults to `en`. |
| 13 | `consent_email` | Recommended | `yes` / `no` / `unknown` | `consent` (channel `email`) | `no` also adds a `suppression` row. `unknown` or blank = no consent recorded; the seeker will not be emailed until consent is captured. |
| 14 | `consent_messages` | Recommended | `yes` / `no` / `unknown` | `consent` (channels `sms`, `whatsapp`) | Same rules as above. |
| 15 | `consent_date` | No | `YYYY-MM-DD` | `consent.at` | Defaults to import date. |
| 16 | `consent_source` | No | Free text (`sign-in sheet`, `eventbrite`, `verbal`, `web form`) | `consent.source` | Stored as `import:<batch_id>:<value>`. |
| 17 | `assigned_volunteer_email` | No | Email of an existing user at that center | first `follow_up_task.assignee_id` | Lets the volunteer who knows the seeker keep the relationship. Unknown email → warning, not rejection. |
| 18 | `notes` | No | Free text | `remark` (internal) | Never rendered into any message. |
| 19 | `external_id` | No | Free text | `import_row.raw`, `registration.external_id` if it is an Eventbrite id | Original row/order id for traceability. |

## Row outcomes

| Outcome | When | What happens |
|---|---|---|
| `created` | No existing seeker matches email or phone | New seeker, plus registration / consent / remark as provided |
| `matched` | Email or phone matches exactly one existing seeker | Existing seeker kept; blank fields filled in; registration / consent added if new |
| `needs_review` | Email matches one seeker and phone matches a different one; name very similar to an existing seeker with different contact; phone cannot be normalized | Row held in the review queue with the candidate matches shown |
| `rejected` | Missing `full_name`, both `email` and `phone` blank, or unknown `center` | Row skipped; reason reported in the batch summary |

## Rules

- Headers must match exactly (lower-case, underscores). Extra columns are ignored with a warning; missing optional columns are fine.
- Dates are `YYYY-MM-DD`. Anything else → the row goes to review.
- Whitespace is trimmed; email is lower-cased; phone is normalized to E.164.
- **Do not include** health information, identity numbers, dates of birth, street addresses, or anything beyond the columns above — the importer drops unknown columns and logs a warning.
- Use synthetic data only in this public repo. Real seeker exports must never be committed; keep them outside the repository.
