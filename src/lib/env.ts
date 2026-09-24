/**
 * Environment access with clear errors. Nothing here runs at import time, so `next build`
 * succeeds without secrets; the error surfaces on the first request that needs the value.
 */
function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} — ${hint}. See .env.example.`);
  return value;
}

export const env = {
  /** Public Supabase URL and anon/publishable key — safe for the browser; RLS is the guard. */
  supabasePublic(): { url: string; key: string } {
    const url = required("NEXT_PUBLIC_SUPABASE_URL", "your Supabase project URL");
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      required("NEXT_PUBLIC_SUPABASE_ANON_KEY", "the anon (or publishable) key");
    return { url, key };
  },
  /** Service-role key — server only, bypasses RLS. Used by jobs and webhooks, never by user requests (AD-3). */
  supabaseServiceRole(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY", "the service_role key (server only)");
  },
  siteUrl(): string {
    return (
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    );
  },
};
