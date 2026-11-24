-- Smoke test for db/schema.sql: guards and row-level security.
-- Run as a NON-superuser (superusers bypass RLS). See db/README in DATA_MODEL.md §5.
-- Expects the schema to be loaded and role app_rw to exist with grants (see below).
--
--   create role app_rw login password 'pw' nosuperuser nobypassrls;
--   grant usage on schema public to app_rw;
--   grant all on all tables in schema public to app_rw;
--   grant all on all sequences in schema public to app_rw;
--   grant execute on all functions in schema public to app_rw;

\set ON_ERROR_STOP on
begin;

-- Fixtures: one region, two centers, one coordinator per center, one seeker at center 1.
select set_config('app.user_id', '00000000-0000-0000-0000-000000000099', false);  -- bootstrap admin
insert into app_user (id, email, full_name) values
  ('00000000-0000-0000-0000-000000000099', 'admin@example.com', 'Admin'),
  ('00000000-0000-0000-0000-000000000021', 'vol1@example.com',  'Vol One'),
  ('00000000-0000-0000-0000-000000000022', 'vol2@example.com',  'Vol Two');
insert into role_assignment (user_id, role) values ('00000000-0000-0000-0000-000000000099', 'admin');
insert into region (id, name) values ('00000000-0000-0000-0000-000000000001', 'Test region');
insert into center (id, region_id, name) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Center one'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Center two');
insert into role_assignment (user_id, role, center_id) values
  ('00000000-0000-0000-0000-000000000021', 'volunteer_coordinator', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000022', 'volunteer_coordinator', '00000000-0000-0000-0000-000000000012');
insert into seeker (id, home_center_id, full_name, email, source) values
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000011', 'Asha Example', 'asha@example.com', 'import');

-- Guard 1: suppression wins, even with different email casing.
insert into suppression (channel, address, reason) values ('email', 'asha@example.com', 'unsubscribe');
insert into message (seeker_id, center_id, channel, to_address, body_rendered)
  values ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000011', 'email', 'Asha@Example.com', 'hello');

do $$ begin
  assert (select status from message where to_address = 'Asha@Example.com') = 'suppressed',
    'FAIL: message to suppressed address was not marked suppressed';
  assert exists (select 1 from consent where seeker_id = '00000000-0000-0000-0000-000000000031'
                   and channel = 'email' and status = 'withdrawn' and source = 'suppression:unsubscribe'),
    'FAIL: suppression did not record a withdrawn consent';
  raise notice 'PASS: suppression trigger and consent sync';
end $$;

-- Guard 2: exactly one recipient on message.
do $$ begin
  begin
    insert into message (channel, to_address, body_rendered) values ('email', 'x@example.com', 'no recipient');
    raise exception 'FAIL: message with no recipient was accepted';
  exception when check_violation then
    raise notice 'PASS: message requires exactly one recipient';
  end;
end $$;

-- RLS: coordinator of center one sees the seeker; coordinator of center two does not.
do $$ begin
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000021', false);
  assert (select count(*) from seeker) = 1, 'FAIL: own-center coordinator cannot see seeker';
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000022', false);
  assert (select count(*) from seeker) = 0, 'FAIL: other-center coordinator can see seeker';
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000099', false);
  assert (select count(*) from seeker) = 1, 'FAIL: admin cannot see seeker';
  raise notice 'PASS: row-level security scopes seekers by center';
end $$;

-- RLS: a seeker with no center yet is visible to admins only.
do $$ begin
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000099', false);
  insert into seeker (id, full_name, email, city, source)
    values ('00000000-0000-0000-0000-000000000032', 'Unassigned Example', 'unassigned@example.com', 'Nowhere', 'import');
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000021', false);
  assert (select count(*) from seeker where id = '00000000-0000-0000-0000-000000000032') = 0,
    'FAIL: unassigned seeker visible to a center coordinator';
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000099', false);
  assert (select count(*) from seeker where id = '00000000-0000-0000-0000-000000000032') = 1,
    'FAIL: unassigned seeker not visible to admin';
  raise notice 'PASS: unassigned seekers are admin-only until a center is set';
end $$;

-- RLS: other-center coordinator cannot insert into center one.
do $$ begin
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000022', false);
  begin
    insert into seeker (home_center_id, full_name, email, source)
      values ('00000000-0000-0000-0000-000000000011', 'Intruder', 'intruder@example.com', 'intake');
    raise exception 'FAIL: cross-center insert was accepted';
  exception when insufficient_privilege then
    raise notice 'PASS: cross-center insert rejected';
  end;
end $$;

-- Intake (R1): create, idempotent replay, exact matches, center check, fuzzy duplicates.
do $$
declare r jsonb; r2 jsonb; v_other uuid;
begin
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000021', false);
  r := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000a1","center_id":"00000000-0000-0000-0000-000000000011",
                       "full_name":"Ravi Example","email":"ravi@example.com","city":"Arlington","state":"VA","country_code":"US"}');
  assert r->>'outcome' = 'created', 'FAIL: intake did not create a seeker: ' || r::text;
  assert exists (select 1 from consent where seeker_id = (r->>'seeker_id')::uuid and channel = 'email' and source = 'intake_form'),
    'FAIL: intake did not record email consent';
  r2 := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000a1","center_id":"00000000-0000-0000-0000-000000000011",
                        "full_name":"Ravi Example","email":"ravi@example.com","city":"Arlington","state":"VA","country_code":"US"}');
  assert r2->>'outcome' = 'already_applied' and r2->>'seeker_id' = r->>'seeker_id', 'FAIL: replay was not idempotent: ' || r2::text;
  raise notice 'PASS: intake creates a seeker and a replay is a no-op';

  r := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000a2","center_id":"00000000-0000-0000-0000-000000000011",
                       "full_name":"Asha E.","email":"ASHA@example.com","phone_e164":"+12025550143","city":"Arlington","state":"VA"}');
  assert r->>'outcome' = 'matched' and r->>'matched_on' = 'email', 'FAIL: same-center exact match: ' || r::text;
  assert (select phone_e164 from seeker where id = '00000000-0000-0000-0000-000000000031') = '+12025550143',
    'FAIL: matched intake did not fill a blank phone';
  raise notice 'PASS: intake matches an existing seeker by email and fills blanks';

  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000022', false);
  r := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000a3","center_id":"00000000-0000-0000-0000-000000000012",
                       "full_name":"Someone Else","phone_e164":"+12025550143","city":"Fairfax","state":"VA"}');
  assert r->>'outcome' = 'matched_other_center' and r->>'seeker_id' is null, 'FAIL: other-center match leaked or created: ' || r::text;
  assert intake_contact_check(null, '+12025550143') = '{"match":"other_center","matched_on":"phone"}'::jsonb,
    'FAIL: contact check leaked another center''s seeker';
  begin
    perform intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000a4","center_id":"00000000-0000-0000-0000-000000000011",
                            "full_name":"Intruder","email":"intruder@example.com"}');
    raise exception 'FAIL: intake into another center was accepted';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: intake hides other centers and rejects writes to them';

  r := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000a5","center_id":"00000000-0000-0000-0000-000000000012",
                       "full_name":"Ravi Exampel","email":"ravi.other@example.com","city":"Arlington","state":"VA"}');
  assert r->>'outcome' = 'created' and (r->>'possible_duplicates')::int = 0,
    'FAIL: duplicate count revealed another center''s seeker: ' || r::text;
  v_other := (r->>'seeker_id')::uuid;
  assert not exists (select 1 from duplicate_candidate), 'FAIL: volunteer can see a cross-center duplicate pair';

  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000099', false);
  assert (select count(*) from duplicate_candidate) = 1, 'FAIL: admin cannot see the cross-center duplicate pair';
  raise notice 'PASS: a cross-center duplicate is flagged for admins only';

  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000021', false);
  assert not exists (select 1 from duplicate_candidate), 'FAIL: other center''s volunteer can see the pair';
  r := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000a6","center_id":"00000000-0000-0000-0000-000000000011",
                       "full_name":"Ravi Exampl","email":"ravi.third@example.com","city":"Arlington","state":"VA"}');
  assert (r->>'possible_duplicates')::int >= 1, 'FAIL: same-center fuzzy duplicate not flagged: ' || r::text;
  assert (select count(*) from duplicate_candidate) = (r->>'possible_duplicates')::int,
    'FAIL: volunteer sees a different set of pairs than intake reported';
  insert into duplicate_candidate (seeker_a, seeker_b, score)
    values (least('00000000-0000-0000-0000-000000000031'::uuid, (r->>'seeker_id')::uuid),
            greatest('00000000-0000-0000-0000-000000000031'::uuid, (r->>'seeker_id')::uuid), 0.5)
    on conflict do nothing;
  begin
    insert into duplicate_candidate (seeker_a, seeker_b, score)
      values (least('00000000-0000-0000-0000-000000000031'::uuid, v_other), greatest('00000000-0000-0000-0000-000000000031'::uuid, v_other), 0.9);
    raise exception 'FAIL: volunteer flagged a pair involving another center''s seeker';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: volunteers see and flag only same-center duplicate pairs';
end $$;

rollback;
