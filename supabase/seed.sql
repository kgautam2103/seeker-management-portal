-- Synthetic development data only. Never put real seekers here.
insert into region (id, name) values ('10000000-0000-0000-0000-000000000001', 'DMV')
on conflict do nothing;
insert into center (id, region_id, name, city, state, country_code, timezone) values
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Washington DC Center', 'Washington', 'DC', 'US', 'America/New_York'),
  ('10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Bethesda Center', 'Bethesda', 'MD', 'US', 'America/New_York'),
  ('10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Arlington Center', 'Arlington', 'VA', 'US', 'America/New_York')
on conflict do nothing;
insert into program (id, center_id, kind, name, default_weekday, default_start_time) values
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000013', 'weekly', 'Weekly meditation — Tuesday', 2, '19:00'),
  ('10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000011', 'public', 'Public program — Introduction', null, null)
on conflict do nothing;
-- Grant yourself admin after your first sign-in (replace the uuid with your auth user id):
-- insert into role_assignment (user_id, role) values ('<your-auth-user-id>', 'admin');
