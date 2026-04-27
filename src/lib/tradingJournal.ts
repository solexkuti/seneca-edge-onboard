// Trading Journal store — single source of truth for trade entries.
// Persisted to localStorage. Recent Activity reads ONLY from here.
// No defaults. No samples. Nothing exists until the user creates it.

export type JournalEntry = {
  id: string;
  timestamp: number;
  pair: string;        // e.g. "EUR/USD"
  resultR: number;     // e.g. 0.8 or -1.2 (in R)
  followedPlan?: boolean;
  notes?: string;
  // Optional, present only for DB-backed entries:
  emotionalState?:
    | "calm"
    | "fearful"
    | "frustrated"
    | "overconfident"
    | "confused";
  disciplineScore?: number; // 0–100
  rules?: {
    entry: boolean;
    exit: boolean;
    risk: boolean;
    behavior: boolean;
  };
};

const KEY = "seneca_trading_journal";
export const JOURNAL_EVENT = "seneca:journal-updated";

function safeRead(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readJournal(): JournalEntry[] {
  return safeRead();
}

export function getLatestEntry(): JournalEntry | null {
  const all = safeRead();
  if (all.length === 0) return null;
  // Newest first by timestamp
  return all.reduce((acc, e) => (e.timestamp > acc.timestamp ? e : acc), all[0]);
}

export function logJournalEntry(
  entry: Omit<JournalEntry, "id" | "timestamp">,
): JournalEntry {
  const full: JournalEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  if (typeof window === "undefined") return full;
  const all = safeRead();
  all.unshift(full);
  window.localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
  try {
    window.dispatchEvent(new CustomEvent(JOURNAL_EVENT, { detail: full }));
  } catch {
    // ignore
  }
  return full;
}

// Discipline metric — derived strictly from journal entries.
// For now: % of trades where the user followed their plan.
// Returns null when there is no data (so the UI can hide the metric).
export function computeDiscipline(entries: JournalEntry[]): number | null {
  if (entries.length === 0) return null;
  const tagged = entries.filter((e) => typeof e.followedPlan === "boolean");
  if (tagged.length === 0) return null;
  const followed = tagged.filter((e) => e.followedPlan).length;
  return Math.round((followed / tagged.length) * 100);
}
