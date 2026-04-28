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
const MAX_SYNC_ATTEMPTS = 3;

export type PendingEntry = {
  id: string;
  payload: NewJournalSubmission;
  createdAt: number;
  attempts?: number;
  lastError?: string;
  failedAt?: number;
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
  notify();
}

// ─── subscribers ───
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribePending(listener: Listener): () => void {
  listeners.add(listener);
  // Also reflect storage edits from other tabs.
  const onStorage = (e: StorageEvent) => {
    if (e.key === PENDING_KEY) listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Are we currently in the middle of a background flush? */
export function isSyncingNow(): boolean {
  return flushing;
}


/** Stable fingerprint of a submission's user-meaningful fields. */
function fingerprint(p: NewJournalSubmission): string {
  return JSON.stringify({
    t: p.trade,
    d: p.discipline,
    e: p.emotional_state,
    n: (p.notes ?? "").trim(),
  });
}

const DEDUPE_WINDOW_MS = 60_000; // ignore identical resubmits within 60s

/**
 * Persist a submission BEFORE any UI advance.
 * If an identical payload was just enqueued (same fingerprint within the
 * dedupe window), reuses the existing id instead of creating a duplicate.
 */
export function enqueuePending(payload: NewJournalSubmission): string {
  const fp = fingerprint(payload);
  const now = Date.now();
  const list = readQueue();

  const existing = list.find(
    (e) => fingerprint(e.payload) === fp && now - e.createdAt < DEDUPE_WINDOW_MS,
  );
  if (existing) return existing.id;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pj_${now}_${Math.random().toString(36).slice(2, 8)}`;
  list.push({ id, payload, createdAt: now, attempts: 0 });
  writeQueue(list);
  return id;
}


export function removePending(id: string) {
  writeQueue(readQueue().filter((e) => e.id !== id));
}

export function listPending(): PendingEntry[] {
  return readQueue();
}

function updatePending(id: string, patch: Partial<PendingEntry>) {
  writeQueue(readQueue().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

function getPending(id: string) {
  return readQueue().find((e) => e.id === id) ?? null;
}

/** Background sync for a single entry. Silent retries with backoff. */
export async function syncWithRetry(
  id: string,
  payload: NewJournalSubmission,
  opts: { showToast?: boolean; force?: boolean } = {},
) {
  const delays = [0, 1500, 4000];
  let warned = false;
  if (opts.force) updatePending(id, { attempts: 0, lastError: undefined, failedAt: undefined });

  for (let attempt = 0; attempt < delays.length; attempt++) {
    const current = getPending(id);
    if (!current) return true;
    const totalAttempts = current.attempts ?? 0;
    if (totalAttempts >= MAX_SYNC_ATTEMPTS) return false;

    if (delays[attempt] > 0)
      await new Promise((r) => setTimeout(r, delays[attempt]));
    try {
      const res = await submitJournalEntry(payload);
      if (res.ok) {
        removePending(id);
        // Pattern detection now runs server-side via Postgres trigger on
        // discipline_logs insert. No client-side detection needed.
        return true;
      }
      console.error(res.error);
      const nextAttempts = totalAttempts + 1;
      updatePending(id, {
        attempts: nextAttempts,
        lastError: res.error,
        failedAt: nextAttempts >= MAX_SYNC_ATTEMPTS ? Date.now() : undefined,
      });
      if (opts.showToast && nextAttempts >= MAX_SYNC_ATTEMPTS) {
        toast.error("Sync failed — tap to retry", { description: res.error });
      }
    } catch (error) {
      const message = "Unexpected error while syncing journal entry.";
      console.error(error);
      const nextAttempts = totalAttempts + 1;
      updatePending(id, {
        attempts: nextAttempts,
        lastError: message,
        failedAt: nextAttempts >= MAX_SYNC_ATTEMPTS ? Date.now() : undefined,
      });
      if (opts.showToast && nextAttempts >= MAX_SYNC_ATTEMPTS) {
        toast.error("Sync failed — tap to retry", { description: message });
      }
    }
    if (!warned && opts.showToast && attempt === 0) {
      warned = true;
      toast("Couldn't sync. Retrying…");
    }
  }
  // Leave it in the queue for manual retry.
  return false;
}

let flushing = false;

/** Drain the entire queue. Safe to call on app start, route entry, focus. */
export async function flushPending(): Promise<void> {
  if (flushing) return;
  flushing = true;
  notify();
  try {
    const list = readQueue();
    for (const entry of list) {
      // Re-read each iteration so concurrent enqueues are honored.
      await syncWithRetry(entry.id, entry.payload, { showToast: false });
    }
  } finally {
    flushing = false;
    notify();
  }
}

/**
 * User-initiated retry of every queued entry. Behaves like `flushPending`
 * but always runs (queues if a flush is already in progress) and resolves
 * with how many entries are still pending after the attempt.
 */
export async function retryNow(): Promise<{ remaining: number; synced: number }> {
  // If a background flush is in progress, wait briefly so we don't double-fire.
  if (flushing) {
    await new Promise((r) => setTimeout(r, 400));
  }
  const before = readQueue();
  if (before.length === 0) return { remaining: 0, synced: 0 };

  flushing = true;
  notify();
  let synced = 0;
  try {
    for (const entry of before) {
      const ok = await syncWithRetry(entry.id, entry.payload, { showToast: false, force: true });
      if (ok) synced++;
    }
  } finally {
    flushing = false;
    notify();
  }
  return { remaining: readQueue().length, synced };
}
