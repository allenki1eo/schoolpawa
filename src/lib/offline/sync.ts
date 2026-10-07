import { api } from "@/lib/client/api";
import { idb, idbAvailable } from "./db";
import type { QueuedResult, StoredPack } from "./types";

const MAX_AGE_MS = 14 * 86_400_000;
let flushing = false;

/** Send queued offline results. Safe to call often; runs one flush at a time. */
export async function flushQueue(): Promise<{ sent: number; points: number }> {
  if (!idbAvailable() || flushing || !navigator.onLine) return { sent: 0, points: 0 };
  flushing = true;
  let sent = 0;
  let points = 0;
  try {
    const queue = await idb.all<QueuedResult>("queue");
    for (const item of queue) {
      if (Date.now() - Date.parse(item.createdAt) > MAX_AGE_MS) {
        await idb.del("queue", item.clientResultId);
        continue;
      }
      const res = await api<{ points: number }>("/api/sync", { body: { clientResultId: item.clientResultId, packId: item.packId, answers: item.answers } });
      if (res.ok) {
        await idb.del("queue", item.clientResultId);
        const pack = await idb.get<StoredPack>("packs", item.packId);
        if (pack?.played) await idb.put("packs", { ...pack, played: { ...pack.played, synced: res.data.points } });
        sent++;
        points += res.data.points;
      } else if (res.status === 410 || res.status === 400) {
        await idb.del("queue", item.clientResultId); // expired or malformed: cannot ever succeed
      }
      // 401/404: belongs to another profile on this device — keep it for when they sign in.
    }
  } finally {
    flushing = false;
  }
  if (sent > 0 && "serviceWorker" in navigator) {
    window.dispatchEvent(new CustomEvent("schoolpawa:synced", { detail: { sent, points } }));
  }
  return { sent, points };
}

export async function queuedCount(studentId?: string) {
  if (!idbAvailable()) return 0;
  const q = await idb.all<QueuedResult>("queue");
  return studentId ? q.filter((i) => i.studentId === studentId).length : q.length;
}
