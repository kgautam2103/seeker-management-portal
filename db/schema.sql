-- Seeker Management Portal — first-pass schema (PostgreSQL 15+)
-- Companion to docs/DATA_MODEL.md. Not yet applied to any environment.
-- Supabase note: replace the body of current_app_user_id() with `select auth.uid()`
-- and make app_user.id equal to the auth user id.

begin;

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ============================================================
-- Enums
-- ============================================================
create type role_t                 as enum ('admin','regional_coordinator','volunteer_coordinator','instructor');
create type seeker_stage_t         as enum ('new','engaged','regular','lapsed');
create type record_source_t        as enum ('intake','import','eventbrite');
create type program_kind_t         as enum ('weekly','public','intro');
create type session_status_t       as enum ('scheduled','held','cancelled');
create type registration_status_t  as enum ('registered','cancelled');
create type attendance_status_t    as enum ('present','absent');
create type channel_t              as enum ('email','sms','whatsapp','push');
create type consent_status_t       as enum ('granted','withdrawn');
create type suppression_reason_t   as enum ('unsubscribe','stop','hard_bounce','complaint');
create type campaign_status_t      as enum ('draft','scheduled','sending','sent','cancelled');
create type message_status_t       as enum ('draft','queued','suppressed','sent','delivered','bounced','failed');
create type review_status_t        as enum ('not_required','pending','approved','rejected');
create type generated_by_t         as enum ('template','llm');
create type message_event_t        as enum ('queued','sent','delivered','opened','clicked','bounced','complained','failed');
create type rule_trigger_t         as enum ('no_show','missed_sessions','program_completed','inactive_days','stage_changed','new_seeker');
create type rule_run_outcome_t     as enum ('message_created','task_created','skipped_cooldown','skipped_suppressed','awaiting_review');
create type task_status_t          as enum ('open','done','dismissed');
create type testimonial_status_t   as enum ('submitted','approved','rejected','published');
create type import_outcome_t       as enum ('created','matched','needs_review','rejected');
create type duplicate_resolution_t as enum ('pending','merged','distinct');
create type media_kind_t           as enum ('text','video');
create type import_source_t        as enum ('csv','xlsx','google_sheet');

-- ============================================================
-- Helpers
-- ============================================================
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Current user id. Supabase: `select auth.uid()`.
create or replace function current_app_user_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- ============================================================
-- Organization & access
-- ============================================================
create table region (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table center (
  id            uuid primary key default gen_random_uuid(),
  region_id     uuid not null references region(id),
  name          text not null,
  address       text,
  city          text,
  state         text,                                   -- US: 2-letter USPS code
  country_code  char(2),
  timezone      text not null default 'UTC',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (region_id, name)
);

create table app_user (
  id          uuid primary key default gen_random_uuid(),
  email       citext not null unique,
  full_name   text not null,
  phone_e164  text,
  locale      text not null default 'en',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table role_assignment (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_user(id) on delete cascade,
  role        role_t not null,
  center_id   uuid references center(id) on delete cascade,
  region_id   uuid references region(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint role_scope_valid check (
    (role = 'admin'                and center_id is null     and region_id is null) or
    (role = 'regional_coordinator' and center_id is null     and region_id is not null) or
    (role in ('volunteer_coordinator','instructor') and center_id is not null and region_id is null)
  ),
  unique nulls not distinct (user_id, role, center_id, region_id)
);
create index role_assignment_user on role_assignment (user_id);

create table push_subscription (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_user(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Admin check and visible centers for RLS
create or replace function is_admin() returns boolean language sql stable as $$
  select exists (
    select 1 from role_assignment
    where user_id = current_app_user_id() and role = 'admin'
  )
$$;

create or replace function visible_center_ids() returns setof uuid language sql stable as $$
  select c.id from center c where is_admin()
  union
  select ra.center_id from role_assignment ra
   where ra.user_id = current_app_user_id() and ra.center_id is not null
  union
  select c.id from role_assignment ra
   join center c on c.region_id = ra.region_id
   where ra.user_id = current_app_user_id() and ra.role = 'regional_coordinator'
$$;

-- True when the current user may see rows scoped to this center. Null = unassigned, admin-only.
create or replace function center_visible(c uuid) returns boolean language sql stable as $$
  select c in (select visible_center_ids()) or (c is null and is_admin())
$$;

-- ============================================================
-- Seekers
-- ============================================================
create table seeker (
  id                  uuid primary key default gen_random_uuid(),
  home_center_id      uuid references center(id),               -- null = not yet assigned; admin-only until set
  full_name           text not null,
  email               citext,
  phone_e164          text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  city                text,
  state               text,                                   -- US: 2-letter USPS code (required with city for US seekers); elsewhere optional province/region
  country_code        char(2),                                -- ISO 3166-1 alpha-2; defaults from the home center
  locale              text,
  how_heard           text,
  mentor_name         text,
  mentor_email        citext,
  mentor_user_id      uuid references app_user(id),           -- set when mentor_email matches a user
  first_session_at    date,
  source              record_source_t not null,
  stage               seeker_stage_t not null default 'new',
  stage_changed_at    timestamptz,
  last_activity_at    timestamptz,
  merged_into_id      uuid references seeker(id),
  anonymized_at       timestamptz,
  client_mutation_id  uuid unique,
  created_by          uuid references app_user(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint seeker_has_contact check (email is not null or phone_e164 is not null or anonymized_at is not null),
  constraint seeker_us_state_code check (country_code is distinct from 'US' or state is null or state ~ '^[A-Z]{2}$')
);
create unique index seeker_email_uniq on seeker (email)
  where email is not null and merged_into_id is null and anonymized_at is null;
create unique index seeker_phone_uniq on seeker (phone_e164)
  where phone_e164 is not null and merged_into_id is null and anonymized_at is null;
create index seeker_name_trgm     on seeker using gin (full_name gin_trgm_ops);
create index seeker_center_stage  on seeker (home_center_id, stage);
create index seeker_last_activity on seeker (last_activity_at);
create index seeker_mentor        on seeker (mentor_user_id);
create trigger seeker_updated_at before update on seeker for each row execute function set_updated_at();

create table consent (
  id            uuid primary key default gen_random_uuid(),
  seeker_id     uuid not null references seeker(id) on delete cascade,
  channel       channel_t not null,
  status        consent_status_t not null,
  source        text not null,      -- intake_form | eventbrite | import:<batch_id> | unsubscribe_link | stop_reply | suppression:<reason>
  text_version  text,               -- version of the written consent statement shown; null while none is shown (current policy)
  recorded_by   uuid references app_user(id),
  at            timestamptz not null default now()
);
create index consent_latest on consent (seeker_id, channel, at desc);

create table duplicate_candidate (
  id           uuid primary key default gen_random_uuid(),
  seeker_a     uuid not null references seeker(id) on delete cascade,
  seeker_b     uuid not null references seeker(id) on delete cascade,
  score        numeric(4,3) not null,
  reason       text,
  resolution   duplicate_resolution_t not null default 'pending',
  resolved_by  uuid references app_user(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (seeker_a < seeker_b),
  unique (seeker_a, seeker_b)
);
create index duplicate_pending on duplicate_candidate (resolution) where resolution = 'pending';

-- ============================================================
-- Programs & attendance
-- ============================================================
create table program (
  id                  uuid primary key default gen_random_uuid(),
  center_id           uuid not null references center(id),
  kind                program_kind_t not null,
  name                text not null,
  description         text,
  default_weekday     smallint check (default_weekday between 0 and 6),
  default_start_time  time,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
create index program_center on program (center_id, is_active);

create table session (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references program(id),
  center_id      uuid not null references center(id),   -- denormalized for RLS
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  location       text,
  instructor_id  uuid references app_user(id),
  status         session_status_t not null default 'scheduled',
  notes          text,
  created_at     timestamptz not null default now()
);
create index session_program_time    on session (program_id, starts_at);
create index session_instructor_time on session (instructor_id, starts_at);

create table registration (
  id             uuid primary key default gen_random_uuid(),
  seeker_id      uuid not null references seeker(id) on delete cascade,
  program_id     uuid not null references program(id),
  session_id     uuid references session(id),            -- the dated session when registered via Eventbrite
  center_id      uuid not null references center(id),   -- denormalized for RLS
  source         record_source_t not null,
  external_id    text,                                   -- e.g. Eventbrite attendee id
  status         registration_status_t not null default 'registered',
  registered_at  timestamptz not null default now(),
  unique (seeker_id, program_id)
);
create unique index registration_external_uniq on registration (source, external_id) where external_id is not null;

create table attendance (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references session(id) on delete cascade,
  seeker_id           uuid not null references seeker(id) on delete cascade,
  center_id           uuid not null references center(id),   -- denormalized for RLS
  status              attendance_status_t not null,
  first_visit         boolean not null default false,
  marked_by           uuid references app_user(id),
  marked_at           timestamptz not null default now(),
  client_mutation_id  uuid unique,
  unique (session_id, seeker_id)
);
create index attendance_seeker_time on attendance (seeker_id, marked_at desc);

create table remark (
  id                  uuid primary key default gen_random_uuid(),
  seeker_id           uuid not null references seeker(id) on delete cascade,
  session_id          uuid references session(id) on delete set null,
  center_id           uuid not null references center(id),   -- denormalized for RLS
  author_id           uuid not null references app_user(id),
  body                text not null,                         -- internal only; never rendered into messages
  tags                text[] not null default '{}',
  client_mutation_id  uuid unique,
  created_at          timestamptz not null default now()
);
create index remark_seeker_time on remark (seeker_id, created_at desc);

-- ============================================================
-- Eventbrite
-- ============================================================
-- One private API key (held in server configuration, never in the database) grants access to several organizations.
create table eventbrite_org (
  id                 uuid primary key default gen_random_uuid(),
  eventbrite_org_id  text not null unique,
  name               text,
  default_center_id  uuid references center(id),             -- where attendees land when the event gives no better signal
  region_id          uuid references region(id),
  last_synced_at     timestamptz,                            -- backfill/sync checkpoint per organization
  created_at         timestamptz not null default now()
);

create table eventbrite_event (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references eventbrite_org(id) on delete cascade,
  eventbrite_event_id  text not null unique,
  session_id           uuid not null references session(id),  -- each Eventbrite event maps to one dated session
  name                 text,
  starts_at            timestamptz,
  last_synced_at       timestamptz
);

-- ============================================================
-- Communication
-- ============================================================
create table template (
  id           uuid primary key default gen_random_uuid(),
  channel      channel_t not null,
  name         text not null,
  subject      text,
  body         text not null,
  variables    text[] not null default '{}',
  version      int not null default 1,
  approved_by  uuid references app_user(id),
  approved_at  timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (name, version)
);

create table campaign (
  id            uuid primary key default gen_random_uuid(),
  center_id     uuid references center(id),                  -- null = regional/global campaign
  region_id     uuid references region(id),
  template_id   uuid not null references template(id),
  name          text not null,
  audience      jsonb not null,                              -- segment definition, resolved at send time
  scheduled_at  timestamptz,
  status        campaign_status_t not null default 'draft',
  created_by    uuid references app_user(id),
  created_at    timestamptz not null default now()
);

create table suppression (
  channel            channel_t not null,
  address            text not null,                          -- lower-cased email or E.164 phone
  reason             suppression_reason_t not null,
  source_message_id  uuid,
  at                 timestamptz not null default now(),
  primary key (channel, address)
);

-- ============================================================
-- Automation
-- ============================================================
create table rule (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  trigger          rule_trigger_t not null,
  conditions       jsonb not null default '{}',
  action           jsonb not null,   -- {"type":"message","template_id":...} | {"type":"task","assign_to":"home_center_coordinator","due_in_days":3}
  cooldown_days    int not null default 14,
  requires_review  boolean not null default false,  -- review is decided by template approval; this is a per-rule override
  center_id        uuid references center(id),               -- null = applies to all centers
  is_enabled       boolean not null default false,
  created_by       uuid references app_user(id),
  created_at       timestamptz not null default now()
);

create table rule_run (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid not null references rule(id),
  seeker_id    uuid not null references seeker(id) on delete cascade,
  trigger_key  text not null,                                 -- e.g. session id or date bucket; makes runs idempotent
  outcome      rule_run_outcome_t not null,
  at           timestamptz not null default now(),
  unique (rule_id, seeker_id, trigger_key)
);

create table message (
  id                   uuid primary key default gen_random_uuid(),
  seeker_id            uuid references seeker(id) on delete set null,
  user_id              uuid references app_user(id) on delete set null,
  center_id            uuid references center(id),           -- denormalized for RLS; null for user-only messages
  channel              channel_t not null,
  template_id          uuid references template(id),
  campaign_id          uuid references campaign(id),
  rule_run_id          uuid references rule_run(id),
  to_address           text not null,
  subject              text,
  body_rendered        text not null,
  generated_by         generated_by_t not null default 'template',
  generation_meta      jsonb,                                 -- model, prompt version, template version
  review_status        review_status_t not null default 'not_required',
  reviewer_id          uuid references app_user(id),
  reviewed_at          timestamptz,
  status               message_status_t not null default 'queued',
  provider             text,
  provider_message_id  text,
  sent_at              timestamptz,
  created_at           timestamptz not null default now(),
  constraint message_one_recipient check ((seeker_id is null) <> (user_id is null))
);
create index message_seeker_time  on message (seeker_id, created_at desc);
create index message_user_time    on message (user_id, created_at desc);
create index message_campaign     on message (campaign_id);
create index message_review_queue on message (review_status, created_at) where review_status = 'pending';
create unique index message_provider_uniq on message (provider, provider_message_id) where provider_message_id is not null;

create table message_event (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references message(id) on delete cascade,
  event       message_event_t not null,
  at          timestamptz not null default now(),
  payload     jsonb
);
create index message_event_msg on message_event (message_id, at);

create table follow_up_task (
  id            uuid primary key default gen_random_uuid(),
  seeker_id     uuid not null references seeker(id) on delete cascade,
  center_id     uuid references center(id),                  -- denormalized for RLS; null while the seeker is unassigned
  assignee_id   uuid references app_user(id),                 -- defaults to the seeker's mentor, else a center coordinator
  rule_run_id   uuid references rule_run(id),
  reason        text not null,
  due_at        timestamptz not null,
  status        task_status_t not null default 'open',
  completed_by  uuid references app_user(id),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index task_center_open   on follow_up_task (center_id, status, due_at);
create index task_assignee_open on follow_up_task (assignee_id, status, due_at);

create table testimonial (
  id            uuid primary key default gen_random_uuid(),
  seeker_id     uuid references seeker(id) on delete set null,
  program_id    uuid references program(id),
  center_id     uuid not null references center(id),
  media_kind    media_kind_t not null default 'text',
  body          text,                                         -- text testimonial
  video_url     text,                                         -- link on the community's YouTube channel; no media stored here
  display_name  text,
  publish_ok    boolean not null default false,
  status        testimonial_status_t not null default 'submitted',
  moderated_by  uuid references app_user(id),
  moderated_at  timestamptz,
  submitted_at  timestamptz not null default now(),
  constraint testimonial_has_content check (body is not null or video_url is not null)
);

-- ============================================================
-- Import & audit
-- ============================================================
create table import_batch (
  id                uuid primary key default gen_random_uuid(),
  center_id         uuid references center(id),
  uploaded_by       uuid not null references app_user(id),
  source_kind       import_source_t not null default 'csv',
  source_ref        text,                                   -- Google Sheet id/URL or uploaded file path
  filename          text,
  template_version  text not null,
  row_count         int not null default 0,
  created_count     int not null default 0,
  matched_count     int not null default 0,
  review_count      int not null default 0,
  rejected_count    int not null default 0,
  status            text not null default 'processing',
  created_at        timestamptz not null default now()
);

create table import_row (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references import_batch(id) on delete cascade,
  row_number   int not null,
  raw          jsonb not null,
  normalized   jsonb,
  outcome      import_outcome_t not null,
  seeker_id    uuid references seeker(id),
  issues       jsonb,
  resolved_by  uuid references app_user(id),
  resolved_at  timestamptz,
  unique (batch_id, row_number)
);
create index import_row_review on import_row (batch_id) where outcome = 'needs_review';

create table audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references app_user(id),
  action       text not null,      -- export.seekers | seeker.merge | seeker.anonymize | campaign.send | role.change ...
  entity_type  text,
  entity_id    uuid,
  center_id    uuid,
  metadata     jsonb,
  at           timestamptz not null default now()
);
create index audit_center_time on audit_log (center_id, at desc);

-- ============================================================
-- Guards
-- ============================================================
-- Suppression always wins: a message to a suppressed address is stored as 'suppressed'
-- and never handed to a provider. The sender only dispatches status = 'queued'.
create or replace function enforce_suppression() returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from suppression s
    where s.channel = new.channel and s.address = lower(new.to_address)
  ) then
    new.status := 'suppressed';
  end if;
  return new;
end $$;
create trigger message_suppression before insert on message
  for each row execute function enforce_suppression();

-- Keep consent in sync: a new suppression records a withdrawn consent for matching seekers.
create or replace function suppression_to_consent() returns trigger language plpgsql as $$
begin
  insert into consent (seeker_id, channel, status, source)
  select s.id, new.channel, 'withdrawn', 'suppression:' || new.reason
  from seeker s
  where (new.channel = 'email' and s.email = new.address)
     or (new.channel in ('sms','whatsapp') and s.phone_e164 = new.address);
  return new;
end $$;
create trigger suppression_consent after insert on suppression
  for each row execute function suppression_to_consent();

-- ============================================================
-- Intake (R1)
-- ============================================================
-- Intake is one function so the seeker, its consent, its registration and any duplicate candidates
-- are written in one transaction, and so an exact contact match is found even when the existing
-- seeker belongs to a center the caller cannot see (RLS would hide that row while the unique index
-- still rejects the insert). Both functions run as the owner, so each checks the caller itself and
-- never returns another center's seeker details.

-- Before saving: is this email or phone already on file? Another center's match reveals nothing but that fact.
create or replace function intake_contact_check(p_email text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_email citext := nullif(trim(p_email), '');
  v_phone text   := nullif(trim(p_phone), '');
  m       record;
begin
  if not exists (select 1 from role_assignment where user_id = current_app_user_id()) then
    raise exception 'no role assigned' using errcode = '42501';
  end if;
  if v_email is null and v_phone is null then
    return jsonb_build_object('match', 'none');
  end if;
  select s.id, s.home_center_id, s.full_name,
         case when v_email is not null and s.email = v_email then 'email' else 'phone' end as matched_on
    into m
    from seeker s
   where s.merged_into_id is null and s.anonymized_at is null
     and ((v_email is not null and s.email = v_email) or (v_phone is not null and s.phone_e164 = v_phone))
   order by (v_email is not null and s.email = v_email) desc, s.created_at
   limit 1;
  if not found then
    return jsonb_build_object('match', 'none');
  end if;
  if center_visible(m.home_center_id) then
    return jsonb_build_object('match', 'visible', 'seeker_id', m.id, 'full_name', m.full_name,
      'matched_on', m.matched_on, 'center_name', (select name from center where id = m.home_center_id));
  end if;
  return jsonb_build_object('match', 'other_center', 'matched_on', m.matched_on);
end $$;

-- Save one intake entry. Idempotent on client_mutation_id, so an offline replay never duplicates.
-- Expects normalized input: phone_e164 in E.164, US state as the USPS code.
-- Outcomes: created | already_applied | matched (same person, visible) | matched_other_center.
create or replace function intake_seeker(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user    uuid   := current_app_user_id();
  v_center  uuid   := nullif(p->>'center_id', '')::uuid;
  v_program uuid   := nullif(p->>'program_id', '')::uuid;
  v_cmid    uuid   := nullif(p->>'client_mutation_id', '')::uuid;
  v_name    text   := nullif(trim(p->>'full_name'), '');
  v_email   citext := nullif(trim(p->>'email'), '');
  v_phone   text   := nullif(trim(p->>'phone_e164'), '');
  v_city    text   := nullif(trim(p->>'city'), '');
  v_id      uuid;
  v_dupes   int    := 0;
  m         record;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if v_center is null or not center_visible(v_center) then
    raise exception 'you cannot add seekers to this center' using errcode = '42501';
  end if;
  if v_cmid is null or v_name is null then
    raise exception 'client_mutation_id and full_name are required' using errcode = '22023';
  end if;
  if v_program is not null and not exists (select 1 from program where id = v_program and center_id = v_center) then
    raise exception 'that program does not belong to this center' using errcode = '22023';
  end if;

  -- A replay of an entry that already created a seeker (response lost, sync retried).
  select id into v_id from seeker where client_mutation_id = v_cmid;
  if found then
    return jsonb_build_object('outcome', 'already_applied', 'seeker_id', v_id);
  end if;

  -- Exact contact match: this person is already on file.
  select s.id, s.home_center_id, s.full_name,
         case when v_email is not null and s.email = v_email then 'email' else 'phone' end as matched_on
    into m
    from seeker s
   where s.merged_into_id is null and s.anonymized_at is null
     and ((v_email is not null and s.email = v_email) or (v_phone is not null and s.phone_e164 = v_phone))
   order by (v_email is not null and s.email = v_email) desc, s.created_at
   limit 1;
  if found then
    if center_visible(m.home_center_id) then
      -- Fill blanks only; never overwrite what is on file. A contact is added only if no one else has it.
      update seeker s set
        email            = coalesce(s.email, case when v_email is not null and not exists (
                             select 1 from seeker o where o.email = v_email and o.merged_into_id is null and o.anonymized_at is null)
                           then v_email end),
        phone_e164       = coalesce(s.phone_e164, case when v_phone is not null and not exists (
                             select 1 from seeker o where o.phone_e164 = v_phone and o.merged_into_id is null and o.anonymized_at is null)
                           then v_phone end),
        city             = coalesce(s.city, v_city),
        state            = coalesce(s.state, case when s.city is null then nullif(trim(p->>'state'), '') end),
        country_code     = coalesce(s.country_code, nullif(p->>'country_code', '')),
        how_heard        = coalesce(s.how_heard, nullif(trim(p->>'how_heard'), '')),
        first_session_at = coalesce(s.first_session_at, nullif(p->>'first_session_at', '')::date),
        home_center_id   = coalesce(s.home_center_id, v_center)
       where s.id = m.id;
      if v_program is not null then
        insert into registration (seeker_id, program_id, center_id, source)
        values (m.id, v_program, v_center, 'intake')
        on conflict (seeker_id, program_id) do nothing;
      end if;
      return jsonb_build_object('outcome', 'matched', 'seeker_id', m.id, 'full_name', m.full_name, 'matched_on', m.matched_on);
    end if;
    -- On file with another center: record it for an admin, reveal nothing about that seeker.
    if not exists (select 1 from audit_log where action = 'seeker.intake_matched_other_center'
                     and metadata->>'client_mutation_id' = v_cmid::text) then
      insert into audit_log (actor_id, action, entity_type, entity_id, center_id, metadata)
      values (v_user, 'seeker.intake_matched_other_center', 'seeker', m.id, v_center,
              jsonb_build_object('client_mutation_id', v_cmid, 'matched_on', m.matched_on, 'program_id', v_program));
    end if;
    return jsonb_build_object('outcome', 'matched_other_center', 'matched_on', m.matched_on);
  end if;

  begin
    insert into seeker (home_center_id, full_name, email, phone_e164, city, state, country_code, how_heard,
                        mentor_name, mentor_email, mentor_user_id, first_session_at, source, client_mutation_id, created_by)
    values (v_center, v_name, v_email, v_phone, v_city, nullif(trim(p->>'state'), ''),
            coalesce(nullif(p->>'country_code', ''), (select country_code from center where id = v_center)),
            nullif(trim(p->>'how_heard'), ''), nullif(trim(p->>'mentor_name'), ''), nullif(trim(p->>'mentor_email'), '')::citext,
            (select id from app_user where email = nullif(trim(p->>'mentor_email'), '')::citext),
            nullif(p->>'first_session_at', '')::date, 'intake', v_cmid, v_user)
    returning id into v_id;
  exception when unique_violation then
    -- Another device saved this person (or this entry) a moment ago: resolve against that row instead.
    return intake_seeker(p);
  end;

  -- Consent is implied by sharing an email for follow-up (D7). SMS needs its own opt-in (Phase 2), so none is recorded here.
  if v_email is not null then
    insert into consent (seeker_id, channel, status, source, recorded_by)
    values (v_id, 'email', 'granted', 'intake_form', v_user);
  end if;
  if v_program is not null then
    insert into registration (seeker_id, program_id, center_id, source) values (v_id, v_program, v_center, 'intake');
  end if;

  -- Probable duplicates go to the review queue; they never block the volunteer. The count returned
  -- covers only seekers the caller can see, so it says nothing about other centers' records.
  with ins as (
  insert into duplicate_candidate (seeker_a, seeker_b, score, reason)
  select least(v_id, s.id), greatest(v_id, s.id), round(similarity(s.full_name, v_name)::numeric, 3),
         case when v_city is not null and lower(s.city) = lower(v_city) then 'similar name, same city' else 'similar name' end
    from seeker s
   where s.id <> v_id and s.merged_into_id is null and s.anonymized_at is null
     and s.full_name % v_name
     and (similarity(s.full_name, v_name) >= 0.8
          or (similarity(s.full_name, v_name) >= 0.5 and v_city is not null and lower(s.city) = lower(v_city)))
   order by similarity(s.full_name, v_name) desc
   limit 5
  on conflict do nothing
  returning seeker_a, seeker_b
  )
  select count(*) into v_dupes
    from ins join seeker o on o.id = case when ins.seeker_a = v_id then ins.seeker_b else ins.seeker_a end
   where center_visible(o.home_center_id);

  return jsonb_build_object('outcome', 'created', 'seeker_id', v_id, 'possible_duplicates', v_dupes);
end $$;

-- ============================================================
-- Attendance & remarks (R5)
-- ============================================================
-- These run as the caller (security invoker), so RLS decides what each user may read and write;
-- a session, seeker or remark the caller can't see behaves as if it doesn't exist.

-- Open the session for a program on a date (in the center's time zone), or return the one already
-- open. An advisory lock keeps two instructors tapping at once from creating two sessions.
create or replace function start_session(p_program_id uuid, p_date date) returns uuid
language plpgsql set search_path = public, pg_temp as $$
declare
  v_program  program%rowtype;
  v_tz       text;
  v_id       uuid;
begin
  if current_app_user_id() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select p.* into v_program from program p where p.id = p_program_id and p.is_active;
  if not found then
    raise exception 'program not found or not visible' using errcode = '42501';
  end if;
  select c.timezone into v_tz from center c where c.id = v_program.center_id;
  if p_date is null or p_date > (now() at time zone v_tz)::date + 30 then
    raise exception 'choose a date within the next 30 days' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('session:' || p_program_id::text || ':' || p_date::text));
  select s.id into v_id
    from session s
   where s.program_id = p_program_id and s.status <> 'cancelled'
     and (s.starts_at at time zone v_tz)::date = p_date
   order by s.starts_at
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into session (program_id, center_id, starts_at, instructor_id)
  values (p_program_id, v_program.center_id,
          (p_date + coalesce(v_program.default_start_time, time '19:00')) at time zone v_tz,
          current_app_user_id())
  returning id into v_id;
  return v_id;
end $$;

-- True when this seeker has no earlier attendance or recorded first session before this session.
create or replace function is_first_visit(p_seeker_id uuid, p_session_id uuid) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select not exists (
           select 1 from attendance a join session e on e.id = a.session_id
            where a.seeker_id = p_seeker_id and a.status = 'present'
              and a.session_id <> p_session_id and e.starts_at < s.starts_at)
     and (k.first_session_at is null or k.first_session_at >= (s.starts_at at time zone c.timezone)::date)
    from session s join center c on c.id = s.center_id, seeker k
   where s.id = p_session_id and k.id = p_seeker_id
$$;

-- One tap on the roster. Keyed by (session, seeker), so two instructors marking the same person
-- converge; the later tap wins (by the device's marked_at), and a tap that overrides someone
-- else's different mark leaves the losing version in audit_log.
-- Returns {outcome: recorded | already_applied | superseded, status, first_visit}.
create or replace function mark_attendance(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_user     uuid := current_app_user_id();
  v_cmid     uuid := nullif(p->>'client_mutation_id', '')::uuid;
  v_session  session%rowtype;
  v_seeker   uuid := nullif(p->>'seeker_id', '')::uuid;
  v_status   attendance_status_t := (p->>'status')::attendance_status_t;
  v_at       timestamptz := least(coalesce(nullif(p->>'marked_at', '')::timestamptz, now()), now());
  v_old      attendance%rowtype;
  v_first    boolean;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if v_cmid is null or v_seeker is null or v_status is null then
    raise exception 'client_mutation_id, seeker_id and status are required' using errcode = '22023';
  end if;

  select * into v_old from attendance where client_mutation_id = v_cmid;
  if found then
    return jsonb_build_object('outcome', 'already_applied', 'status', v_old.status, 'first_visit', v_old.first_visit);
  end if;

  select * into v_session from session where id = nullif(p->>'session_id', '')::uuid;
  if not found then
    raise exception 'session not found or not visible' using errcode = '42501';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'this session was cancelled' using errcode = '22023';
  end if;
  if not exists (select 1 from seeker where id = v_seeker and merged_into_id is null) then
    raise exception 'seeker not found or not visible' using errcode = '42501';
  end if;

  v_first := v_status = 'present' and is_first_visit(v_seeker, v_session.id);

  select * into v_old from attendance where session_id = v_session.id and seeker_id = v_seeker for update;
  if not found then
    begin
      insert into attendance (session_id, seeker_id, center_id, status, first_visit, marked_by, marked_at, client_mutation_id)
      values (v_session.id, v_seeker, v_session.center_id, v_status, v_first, v_user, v_at, v_cmid);
    exception when unique_violation then
      -- Another device marked this person a moment ago: resolve against that row.
      return mark_attendance(p);
    end;
    if v_session.status = 'scheduled' and v_status = 'present' then
      update session set status = 'held' where id = v_session.id;
    end if;
    return jsonb_build_object('outcome', 'recorded', 'status', v_status, 'first_visit', v_first);
  end if;

  if v_old.marked_at > v_at then
    if v_old.status <> v_status and v_old.marked_by is distinct from v_user then
      insert into audit_log (actor_id, action, entity_type, entity_id, center_id, metadata)
      values (v_user, 'attendance.superseded', 'attendance', v_old.id, v_old.center_id,
              jsonb_build_object('kept', v_old.status, 'discarded', v_status, 'discarded_marked_at', v_at,
                                 'client_mutation_id', v_cmid));
    end if;
    return jsonb_build_object('outcome', 'superseded', 'status', v_old.status, 'first_visit', v_old.first_visit);
  end if;

  if v_old.status <> v_status and v_old.marked_by is distinct from v_user then
    insert into audit_log (actor_id, action, entity_type, entity_id, center_id, metadata)
    values (v_user, 'attendance.overridden', 'attendance', v_old.id, v_old.center_id,
            jsonb_build_object('previous', v_old.status, 'previous_marked_by', v_old.marked_by,
                               'previous_marked_at', v_old.marked_at, 'new', v_status));
  end if;
  update attendance
     set status = v_status, first_visit = v_first, marked_by = v_user, marked_at = v_at, client_mutation_id = v_cmid
   where id = v_old.id;
  if v_session.status = 'scheduled' and v_status = 'present' then
    update session set status = 'held' where id = v_session.id;
  end if;
  return jsonb_build_object('outcome', 'recorded', 'status', v_status, 'first_visit', v_first);
end $$;

-- A free-text note about a seeker, optionally tied to a session. Internal only (never in messages,
-- exports or LLM prompts). Idempotent by client_mutation_id. Returns {outcome: created | already_applied, remark_id}.
create or replace function add_remark(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_user     uuid := current_app_user_id();
  v_cmid     uuid := nullif(p->>'client_mutation_id', '')::uuid;
  v_seeker   uuid := nullif(p->>'seeker_id', '')::uuid;
  v_session  uuid := nullif(p->>'session_id', '')::uuid;
  v_body     text := nullif(btrim(p->>'body'), '');
  v_center   uuid;
  v_tags     text[];
  v_id       uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if v_cmid is null or v_seeker is null or v_body is null then
    raise exception 'client_mutation_id, seeker_id and body are required' using errcode = '22023';
  end if;
  if length(v_body) > 2000 then
    raise exception 'keep the remark under 2000 characters' using errcode = '22023';
  end if;

  select id into v_id from remark where client_mutation_id = v_cmid;
  if found then
    return jsonb_build_object('outcome', 'already_applied', 'remark_id', v_id);
  end if;

  if not exists (select 1 from seeker where id = v_seeker) then
    raise exception 'seeker not found or not visible' using errcode = '42501';
  end if;
  if v_session is not null then
    select center_id into v_center from session where id = v_session;
    if not found then
      raise exception 'session not found or not visible' using errcode = '42501';
    end if;
  else
    select home_center_id into v_center from seeker where id = v_seeker;
    if v_center is null then
      raise exception 'this seeker has no center yet' using errcode = '22023';
    end if;
  end if;

  select coalesce(array_agg(distinct t order by t), '{}') into v_tags
    from (select lower(btrim(x)) as t
            from jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb)) x
           limit 10) tags
   where t <> '' and length(t) <= 40;

  insert into remark (seeker_id, session_id, center_id, author_id, body, tags, client_mutation_id)
  values (v_seeker, v_session, v_center, v_user, v_body, v_tags, v_cmid)
  on conflict (client_mutation_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from remark where client_mutation_id = v_cmid;
    return jsonb_build_object('outcome', 'already_applied', 'remark_id', v_id);
  end if;
  return jsonb_build_object('outcome', 'created', 'remark_id', v_id);
end $$;

-- The roster: everyone registered for the session's program, plus anyone already marked at it.
-- is_new = no earlier attendance and no earlier recorded first session.
create or replace function session_roster(p_session_id uuid)
returns table (seeker_id uuid, full_name text, registered boolean, status attendance_status_t,
               marked_at timestamptz, is_new boolean, remark_count int)
language sql stable set search_path = public, pg_temp as $$
  with s as (select * from session where id = p_session_id),
  people as (
    select r.seeker_id, true as registered
      from registration r, s
     where r.program_id = s.program_id and r.status = 'registered'
    union
    select a.seeker_id, false
      from attendance a, s
     where a.session_id = s.id
  ),
  dedup as (select p.seeker_id, bool_or(p.registered) as registered from people p group by p.seeker_id)
  select k.id, k.full_name, d.registered, a.status, a.marked_at,
         coalesce(a.first_visit, false) or (a.status is distinct from 'present' and is_first_visit(k.id, p_session_id)),
         (select count(*)::int from remark m where m.seeker_id = k.id and m.session_id = p_session_id)
    from dedup d
    join seeker k on k.id = d.seeker_id and k.merged_into_id is null and k.anonymized_at is null
    left join attendance a on a.session_id = p_session_id and a.seeker_id = k.id
   order by lower(k.full_name)
$$;

-- Sessions from the last two weeks and the next week, with roster counts, for the sessions list.
create or replace function recent_sessions()
returns table (session_id uuid, program_id uuid, program_name text, center_id uuid, center_name text,
               timezone text, starts_at timestamptz, status session_status_t, registered int, present int)
language sql stable set search_path = public, pg_temp as $$
  select s.id, p.id, p.name, c.id, c.name, c.timezone, s.starts_at, s.status,
         (select count(*)::int from registration r where r.program_id = p.id and r.status = 'registered'),
         (select count(*)::int from attendance a where a.session_id = s.id and a.status = 'present')
    from session s
    join program p on p.id = s.program_id
    join center c on c.id = s.center_id
   where s.starts_at between now() - interval '14 days' and now() + interval '7 days'
   order by s.starts_at desc
$$;

-- ============================================================
-- Row-level security
-- ============================================================
-- One center-scope policy for every table that carries a center_id (null = admin-only).
do $$
declare t text;
begin
  foreach t in array array['program','session','registration','attendance','remark','follow_up_task','testimonial','campaign'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (center_visible(center_id)) with check (center_visible(center_id))',
      t || '_center_scope', t);
  end loop;
end $$;

alter table seeker enable row level security;
create policy seeker_center_scope on seeker for all
  using      (center_visible(home_center_id))
  with check (center_visible(home_center_id));

alter table consent enable row level security;
create policy consent_via_seeker on consent for all
  using (seeker_id in (select id from seeker));   -- seeker is already RLS-filtered

-- A pair is visible only when both seekers are: a cross-center pair is for an admin to review.
alter table duplicate_candidate enable row level security;
create policy duplicate_via_seekers on duplicate_candidate for all
  using      (seeker_a in (select id from seeker) and seeker_b in (select id from seeker))   -- seeker is already RLS-filtered
  with check (seeker_a in (select id from seeker) and seeker_b in (select id from seeker));

alter table message enable row level security;
create policy message_scope on message for all
  using      (center_visible(center_id) or user_id = current_app_user_id())
  with check (center_visible(center_id) or user_id = current_app_user_id());

alter table message_event enable row level security;
create policy message_event_via_message on message_event for all
  using (message_id in (select id from message));

-- Admin-managed, readable by all authenticated users
do $$
declare t text;
begin
  foreach t in array array['template','rule','suppression'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (current_app_user_id() is not null)', t || '_read_all', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t || '_admin_write', t);
  end loop;
end $$;

alter table audit_log enable row level security;
create policy audit_admin_read on audit_log for select using (is_admin());
create policy audit_insert_any on audit_log for insert with check (current_app_user_id() is not null);

commit;
