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

rollback;
