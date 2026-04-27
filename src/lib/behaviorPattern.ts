// Behavior pattern engine — derives the user's current behavioral state
// from recent Trading Journal entries. No randomness, no static fallback
// when data exists. Output is always tied to actual behavior.

import type { JournalEntry } from "@/lib/tradingJournal";

export type BehaviorPatternKind =
  | "empty"
  | "rule_breaking"
  | "revenge"
  | "overtrading"
  | "discipline"
  | "neutral";

export type BehaviorPattern = {
  kind: BehaviorPatternKind;
  message: string;
};

// Rolling window — analyze the last N trades.
const WINDOW = 10;
const MIN_WINDOW = 3;

// Thresholds
const REVENGE_WINDOW_MS = 15 * 60 * 1000;     // loss → next trade within 15 min
const OVERTRADING_WINDOW_MS = 60 * 60 * 1000; // 4+ trades within 60 min
const OVERTRADING_COUNT = 4;

export function detectBehaviorPattern(all: JournalEntry[]): BehaviorPattern {
  if (all.length === 0) {
    return {
      kind: "empty",
      message: "Your behavior pattern will appear after your first trades.",
    };
  }

  // Most recent first
  const sorted = [...all].sort((a, b) => b.timestamp - a.timestamp);
  const recent = sorted.slice(0, WINDOW);

  // A. Rule breaking — 2+ trades in window where rules were not followed
  const brokenCount = recent.filter((e) => e.followedPlan === false).length;
  if (brokenCount >= 2) {
    return {
      kind: "rule_breaking",
      message: "You are breaking your system under pressure.",
    };
  }

  // B. Revenge trading — a loss immediately followed by another trade
  // (chronological order: oldest → newest)
  const chrono = [...recent].reverse();
  for (let i = 0; i < chrono.length - 1; i++) {
    const prev = chrono[i];
    const next = chrono[i + 1];
    if (prev.resultR < 0 && next.timestamp - prev.timestamp <= REVENGE_WINDOW_MS) {
      return {
        kind: "revenge",
        message: "You are reacting to loss, not executing your plan.",
      };
    }
  }

  // C. Overtrading — many trades in a short rolling window
  for (let i = 0; i < chrono.length; i++) {
    const start = chrono[i].timestamp;
    const cluster = chrono.filter(
      (e) => e.timestamp >= start && e.timestamp - start <= OVERTRADING_WINDOW_MS,
    );
    if (cluster.length >= OVERTRADING_COUNT) {
      return {
        kind: "overtrading",
        message: "You are trading out of impulse, not clarity.",
      };
    }
  }

  // D. Discipline — recent trades consistently follow rules
  if (recent.length >= MIN_WINDOW) {
    const tagged = recent.filter((e) => typeof e.followedPlan === "boolean");
    if (tagged.length >= MIN_WINDOW && tagged.every((e) => e.followedPlan === true)) {
      return {
        kind: "discipline",
        message: "You are executing with consistency. Stay here.",
      };
    }
  }

  // E. Default — data exists but no strong signal
  return {
    kind: "neutral",
    message: "Stay disciplined. Execute your system.",
  };
}
