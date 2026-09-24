-- Generated from db/schema.sql by scripts/build-supabase-migration.mjs — do not edit by hand.
-- Differences from db/schema.sql: current_app_user_id() reads auth.uid(); app_user.id references auth.users;
-- auth-user mirror trigger and role grants appended.

-- Seeker Management Portal — first-pass schema (PostgreSQL 15+)
-- Companion to docs/DATA_MODEL.md. Not yet applied to any environment.
-- Supabase note: replace the body of current_app_user_id() with `select auth.uid()`
-- and make app_user.id equal to the auth user id.


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
  select auth.uid()
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
  id          uuid primary key references auth.users(id) on delete cascade,
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

-- ============================================================
-- Supabase specifics
-- ============================================================
-- Mirror every new auth user into app_user. Roles are granted separately by an admin (role_assignment).
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_user (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Grants. authenticated acts under RLS; service_role (jobs, webhooks) bypasses RLS by design (AD-3); anon gets nothing.
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
