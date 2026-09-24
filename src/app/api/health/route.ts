import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Uptime ping target. Also keeps the free-tier database awake once a DB check is added here. */
export function GET() {
  return NextResponse.json({
    ok: true,
    service: "seeker-portal",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    time: new Date().toISOString(),
  });
}
