// Cache today's generated checklist so other surfaces (Mentor, Trade Check)
// can reference the same enforced rules without re-fetching.
//
// The daily checklist is THE source of truth for today's enforcement context:
//   - control state (in_control / at_risk / out_of_control)
//   - allowed tiers
//   - adaptive rules (e.g. "Max 2 trades today")
//   - weak rule categories
//   - today's focus statements
//
// It expires automatically when the date changes — a new day requires a new
// checklist, not stale rules.

export type DailyChecklistCache = {
  generated_for: string; // YYYY-MM-DD
  control_state: "in_control" | "at_risk" | "out_of_control";
  discipline_score: number;
  allowed_tiers: string[];
  applied_restrictions: string[];
  weak_categories: string[];
  focus: string[];
  suggest_no_trade_day: boolean;
  strategy_name: string;
};

import { userKey } from "@/lib/userScopedStorage";

const SUFFIX = "dailyChecklist.v1";

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

export function saveDailyChecklist(c: DailyChecklistCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(userKey(SUFFIX), JSON.stringify(c));
  } catch {
    // ignore — quota or private mode
  }
}

export function getDailyChecklist(): DailyChecklistCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(userKey(SUFFIX));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyChecklistCache;
    // Hard expiry: must match today's date.
    if (!parsed.generated_for || parsed.generated_for !== todayLabel()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDailyChecklist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(userKey(SUFFIX));
  } catch {
    // ignore
  }
}
