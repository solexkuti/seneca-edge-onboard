// Lightweight behavior tracking — persisted to localStorage so the Control Hub
// can read patterns later. Pure client-side. No backend.

export type CheckRecord = {
  id: string;
  timestamp: number;
  intention: string;
  ruleAlignment: "fully" | "partially" | "not_really";
  riskPercent: number;
  inControlIfLoss: boolean;
  emotion: string;
  emotionalBias: boolean;
  decision: "proceeded" | "reconsidered";
};

const KEY = "seneca_check_history";

function safeRead(): CheckRecord[] {
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

export function logCheck(record: Omit<CheckRecord, "id" | "timestamp">) {
  if (typeof window === "undefined") return;
  const entry: CheckRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  const all = safeRead();
  all.unshift(entry);
  window.localStorage.setItem(KEY, JSON.stringify(all.slice(0, 50)));
}

export function readCheckHistory(): CheckRecord[] {
  return safeRead();
}
