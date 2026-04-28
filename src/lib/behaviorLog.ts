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

import { userKey } from "@/lib/userScopedStorage";

const SUFFIX = "check_history";

function safeRead(): CheckRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(userKey(SUFFIX));
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
  window.localStorage.setItem(userKey(SUFFIX), JSON.stringify(all.slice(0, 50)));
  try {
    window.dispatchEvent(new CustomEvent("seneca:check-logged", { detail: entry }));
  } catch {
    // ignore (older browsers)
  }
}

export const CHECK_HISTORY_EVENT = "seneca:check-logged";
/** @deprecated use userKey('check_history') from userScopedStorage. */
export const CHECK_HISTORY_KEY = "seneca_check_history";

export function readCheckHistory(): CheckRecord[] {
  return safeRead();
}
