// Builds the Supabase migration from db/schema.sql (the readable, vendor-neutral source of truth).
// Run: npm run db:migration
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = "db/schema.sql";
const OUT = "supabase/migrations/20260923000000_initial.sql";

let sql = readFileSync(SRC, "utf8");

function must(pattern, replacement, label) {
  if (!pattern.test(sql)) throw new Error(`build-supabase-migration: expected to find ${label} in ${SRC}`);
  sql = sql.replace(pattern, () => replacement);
}

// Supabase runs each migration file itself; no explicit transaction wrapper.
must(/^begin;\n/m, "", "begin;");
must(/^commit;\n?/m, "", "commit;");

// The current user comes from the Supabase JWT, not a session setting.
must(
  /create or replace function current_app_user_id\(\) returns uuid language sql stable as \$\$\n  select nullif\(current_setting\('app.user_id', true\), ''\)::uuid\n\$\$;/,
  "create or replace function current_app_user_id() returns uuid language sql stable as $$\n  select auth.uid()\n$$;",
  "current_app_user_id()",
);

// app_user rows mirror auth.users one-to-one.
must(
  /create table app_user \(\n  id          uuid primary key default gen_random_uuid\(\),/,
  "create table app_user (\n  id          uuid primary key references auth.users(id) on delete cascade,",
  "app_user.id",
);

const header = `-- Generated from db/schema.sql by scripts/build-supabase-migration.mjs — do not edit by hand.
-- Differences from db/schema.sql: current_app_user_id() reads auth.uid(); app_user.id references auth.users;
-- auth-user mirror trigger and role grants appended.

`;

const footer = `
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
`;

mkdirSync("supabase/migrations", { recursive: true });
writeFileSync(OUT, header + sql.trimEnd() + "\n" + footer);
console.log(`wrote ${OUT} (${(header + sql + footer).length} bytes)`);
