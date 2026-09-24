-- Run as a superuser after the migration. Creates fixtures through the auth mirror trigger.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000099', 'admin@example.com', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000021', 'vol1@example.com',  '{"full_name":"Vol One"}'),
  ('00000000-0000-0000-0000-000000000022', 'vol2@example.com',  '{"full_name":"Vol Two"}');
do $$ begin
  assert (select count(*) from app_user) = 3, 'FAIL: auth mirror trigger did not create app_user rows';
  raise notice 'PASS: auth.users → app_user mirror';
end $$;
insert into role_assignment (user_id, role) values ('00000000-0000-0000-0000-000000000099', 'admin');
insert into region (id, name) values ('00000000-0000-0000-0000-000000000001', 'DMV');
insert into center (id, region_id, name, timezone, country_code) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Center one', 'America/New_York', 'US'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Center two', 'America/New_York', 'US');
insert into role_assignment (user_id, role, center_id) values
  ('00000000-0000-0000-0000-000000000021', 'volunteer_coordinator', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000022', 'volunteer_coordinator', '00000000-0000-0000-0000-000000000012');
insert into seeker (id, home_center_id, full_name, email, city, state, country_code, source) values
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000011', 'Asha Example', 'asha@example.com', 'Arlington', 'VA', 'US', 'import');
-- A login role that inherits exactly what Supabase's `authenticated` role can do.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_test') then
    create role app_test login password 'pw' nosuperuser nobypassrls in role authenticated;
  end if;
end $$;
