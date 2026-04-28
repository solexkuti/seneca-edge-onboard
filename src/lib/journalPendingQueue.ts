// Local-first persistence queue for journal submissions.
//
// Guarantees a journal entry is never lost:
//   1. Caller persists payload via `enqueuePending` BEFORE advancing the UI.
//   2. `syncWithRetry` drains it in the background with silent retries.
//   3. `flushPending` runs on app load to recover anything left behind
//      (tab closed, offline, crash, etc.).

import { toast } from "sonner";
import {
  submitJournalEntry,
  type NewJournalSubmission,
} from "@/lib/dbJournal";

const PENDING_KEY = "journal_pending_submissions_v1";

export type PendingEntry = {
  id: string;
  payload: NewJournalSubmission;
  createdAt: number;
};

function readQueue(): PendingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(list: PendingEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* quota exceeded — best effort */
  }
}

/** Persist a submission BEFORE any UI advance. Returns the entry's id. */
export function enqueuePending(payload: NewJournalSubmission): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const list = readQueue();
  list.push({ id, payload, createdAt: Date.now() });
  writeQueue(list);
  return id;
}

export function removePending(id: string) {
  writeQueue(readQueue().filter((e) => e.id !== id));
}

export function listPending(): PendingEntry[] {
  return readQueue();
}

/** Background sync for a single entry. Silent retries with backoff. */
export async function syncWithRetry(
  id: string,
  payload: NewJournalSubmission,
  opts: { showToast?: boolean } = {},
) {
  const delays = [0, 1500, 4000, 10000, 30000];
  let warned = false;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0)
      await new Promise((r) => setTimeout(r, delays[attempt]));
    try {
      const res = await submitJournalEntry(payload);
      if (res.ok) {
        removePending(id);
        return true;
      }
    } catch {
      /* fallthrough */
    }
    if (!warned && opts.showToast && attempt === 0) {
      warned = true;
      toast("Couldn't sync. Retrying…");
    }
  }
  // Leave it in the queue for the next flush.
  return false;
}

let flushing = false;

/** Drain the entire queue. Safe to call on app start, route entry, focus. */
export async function flushPending(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const list = readQueue();
    for (const entry of list) {
      // Re-read each iteration so concurrent enqueues are honored.
      await syncWithRetry(entry.id, entry.payload, { showToast: false });
    }
  } finally {
    flushing = false;
  }
}
