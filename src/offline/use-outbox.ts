"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { liveQuery } from "dexie";
import { offlineDb, type OutboxItem } from "./db";
import { drainOutbox } from "./outbox";

const TICK_MS = 15_000;

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * The outbox as live state, plus the sync triggers from ARCHITECTURE A.3: app open, the browser's
 * `online` event, returning to the tab, and a timer while the page is open. (iOS Safari has no
 * Background Sync, so these cover every browser.)
 */
export function useOutbox(): { items: OutboxItem[]; online: boolean; ready: boolean } {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [ready, setReady] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    const sub = liveQuery(() => offlineDb.outbox.orderBy("createdAt").reverse().toArray()).subscribe({
      next: (rows) => {
        setItems(rows);
        setReady(true);
      },
      error: (err) => {
        console.error("outbox unavailable", err);
        setReady(true);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const sync = () => void drainOutbox();
    const onOnline = () => void drainOutbox({ force: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    sync();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(sync, TICK_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  return { items, online, ready };
}
