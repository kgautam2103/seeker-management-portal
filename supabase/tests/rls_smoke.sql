-- Run as app_test (inherits `authenticated`). Mirrors db/smoke_test.sql for the Supabase flavor.
\set ON_ERROR_STOP on
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
  assert (select count(*) from seeker) = 1, 'FAIL: own-center coordinator cannot see seeker';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', false);
  assert (select count(*) from seeker) = 0, 'FAIL: other-center coordinator can see seeker';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
  assert (select count(*) from seeker) = 1, 'FAIL: admin cannot see seeker';
  raise notice 'PASS: RLS scopes seekers by center under auth.uid()';
end $$;
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', false);
  begin
    insert into seeker (home_center_id, full_name, email, city, state, country_code, source)
      values ('00000000-0000-0000-0000-000000000011', 'Intruder', 'intruder@example.com', 'Arlington', 'VA', 'US', 'intake');
    raise exception 'FAIL: cross-center insert was accepted';
  exception when insufficient_privilege then
    raise notice 'PASS: cross-center insert rejected';
  end;
end $$;
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
  begin
    insert into suppression (channel, address, reason) values ('email', 'blocked@example.com', 'unsubscribe');
    raise exception 'FAIL: coordinator could write to suppression';
  exception when insufficient_privilege then
    raise notice 'PASS: suppression is admin/webhook-only for writes';
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', false);
  insert into suppression (channel, address, reason) values ('email', 'asha@example.com', 'unsubscribe');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
  insert into message (seeker_id, center_id, channel, to_address, body_rendered)
    values ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000011', 'email', 'Asha@Example.com', 'hello');
  assert (select status from message where to_address = 'Asha@Example.com') = 'suppressed', 'FAIL: suppression trigger';
  raise notice 'PASS: suppression trigger under authenticated role';
end $$;
do $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);
  r := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000b1","center_id":"00000000-0000-0000-0000-000000000011",
                       "full_name":"Mira Example","email":"mira@example.com","city":"Arlington","state":"VA"}');
  assert r->>'outcome' = 'created', 'FAIL: intake under auth.uid(): ' || r::text;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', false);
  r := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000b2","center_id":"00000000-0000-0000-0000-000000000012",
                       "full_name":"Mira","email":"mira@example.com","city":"Fairfax","state":"VA"}');
  assert r->>'outcome' = 'matched_other_center' and r->>'seeker_id' is null, 'FAIL: other-center intake match: ' || r::text;
  raise notice 'PASS: intake under auth.uid() creates and hides other-center matches';
end $$;
do $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', false);
  r := intake_seeker('{"client_mutation_id":"00000000-0000-0000-0000-0000000000b3","center_id":"00000000-0000-0000-0000-000000000012",
                       "full_name":"Mira Exampel","email":"mira.two@example.com","city":"Arlington","state":"VA"}');
  assert (r->>'possible_duplicates')::int = 0, 'FAIL: duplicate count revealed another center''s seeker: ' || r::text;
  assert not exists (select 1 from duplicate_candidate), 'FAIL: volunteer can see a cross-center duplicate pair';
  raise notice 'PASS: cross-center duplicate pairs are hidden under auth.uid()';
end $$;
