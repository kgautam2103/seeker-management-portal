"use client";

import { useEffect } from "react";
import { offlineDb } from "@/offline/db";
import type { Roster } from "@/modules/attendance/schema";

/**
 * Keeps today's rosters on this device, so an instructor who opens the list with signal can mark
 * attendance later with none: the roster data goes to IndexedDB and the page itself into the
 * service worker's cache.
 */
export function WarmRosters({ sessionIds }: { sessionIds: string[] }) {
  const key = sessionIds.join(",");
  useEffect(() => {
    if (!navigator.onLine || key === "") return;
    let cancelled = false;
    (async () => {
      for (const id of key.split(",")) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/sessions/${id}/roster`, { credentials: "same-origin" });
          if (!res.ok) continue;
          const roster = (await res.json()) as Roster;
          const cached = await offlineDb.rosters.get(id);
          if (!cached || cached.fetchedAt < roster.fetchedAt) await offlineDb.rosters.put({ ...roster, sessionId: id });
          await fetch(`/sessions/${id}`, { credentials: "same-origin" }); // the service worker caches the page
        } catch {
          return; // connection dropped: nothing to warm
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);
  return null;
}
