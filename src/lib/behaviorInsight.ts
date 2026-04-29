// Behavior Intelligence Layer — single primary insight + single next action,
// derived from the last N journal entries. Pure functions, no side effects.
// Reads existing journal data only — does NOT modify scoring, penalties, or
// trade structure.
//
// Outputs are designed for two surfaces:
//   1. Control State card → `insight` text replaces the static presence line
//   2. Next Action card   → `action` (title + sub + tone)
//
// Rules-of-the-house (matches product brief):
//   • One insight at a time. No flooding.
//   • Tone: calm, observant, slightly firm. Never hype, never comfort.
//   • Every insight is traceable to the underlying data (count + window).

import {
  MISTAKE_LABEL,
  type Classification,
  type JournalEntry,
  type MistakeId,
} from "@/lib/behavioralJournal";

export const INSIGHT_WINDOW = 5;
export const REPEAT_THRESHOLD = 2;       // mistake repeats ≥ this → repeating
export const ESCALATE_THRESHOLD = 3;     // ≥ this → stricter tone
export const HARD_PATTERN_THRESHOLD = 5; // ≥ this → "behavior, not mistake"
export const CLEAN_STREAK_REWARD = 2;

export type InsightKind =
  | "empty"
  | "single_trade"
  | "clean_streak"
  | "repetition"
  | "cluster"
  | "drift"
  | "stabilizing"
  | "neutral";

export type ControlState = "controlled" | "slight_drift" | "losing_control" | "undisciplined" | "inactive";

export type Tone = "ok" | "drift" | "warn" | "risk" | "inactive";

export type BehaviorInsight = {
  kind: InsightKind;
  /** One sentence shown on the Control State card. */
  insight: string;
  /** Decision the user should take next. */
  action: { title: string; sub: string; tone: Tone };
  /** Coarse-grained control bucket derived from the average per-trade score. */
  controlState: ControlState;
  controlLabel: string;
  /** Window actually used (≤ INSIGHT_WINDOW). */
  windowSize: number;
  /** Diagnostics — useful for logs / debug surfaces. */
  trace: {
    repeatingMistake: { id: MistakeId; count: number } | null;
    cluster: { a: MistakeId; b: MistakeId; count: number } | null;
    avgScore: number | null;
    cleanStreak: number;
    breakStreak: number;
    trend: "improving" | "slipping" | "flat" | "n/a";
  };
};

// ── Helpers ───────────────────────────────────────────────────────────

function controlBucket(avg: number | null): { state: ControlState; label: string; tone: Tone } {
  if (avg == null) return { state: "inactive", label: "Inactive", tone: "inactive" };
  if (avg >= 80) return { state: "controlled", label: "Controlled", tone: "ok" };
  if (avg >= 60) return { state: "slight_drift", label: "Slight drift", tone: "drift" };
  if (avg >= 40) return { state: "losing_control", label: "Losing control", tone: "warn" };
  return { state: "undisciplined", label: "Undisciplined", tone: "risk" };
}

function pairKey(a: MistakeId, b: MistakeId): string {
  return [a, b].sort().join("|");
}

function frequency(entries: JournalEntry[]): Map<MistakeId, number> {
  const map = new Map<MistakeId, number>();
  for (const e of entries) {
    for (const m of e.mistakes) map.set(m, (map.get(m) ?? 0) + 1);
  }
  return map;
}

/** Co-occurring mistake pairs that appear together in the SAME trade. */
function clusters(entries: JournalEntry[]): Map<string, { a: MistakeId; b: MistakeId; count: number }> {
  const map = new Map<string, { a: MistakeId; b: MistakeId; count: number }>();
  for (const e of entries) {
    const list = e.mistakes;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const k = pairKey(list[i], list[j]);
        const prev = map.get(k);
        if (prev) prev.count += 1;
        else {
          // Preserve the sorted order from pairKey for stable output
          const [a, b] = [list[i], list[j]].sort() as [MistakeId, MistakeId];
          map.set(k, { a, b, count: 1 });
        }
      }
    }
  }
  return map;
}

function averageScore(entries: JournalEntry[]): number | null {
  if (entries.length === 0) return null;
  const sum = entries.reduce((acc, e) => acc + (e.score_after ?? 0), 0);
  return Math.round(sum / entries.length);
}

/** Compare the score of the most recent half vs. the older half in the window. */
function trendOf(entries: JournalEntry[]): "improving" | "slipping" | "flat" | "n/a" {
  if (entries.length < 4) return "n/a";
  const half = Math.floor(entries.length / 2);
  // entries are newest-first
  const newer = entries.slice(0, half);
  const older = entries.slice(half);
  const avgNew = averageScore(newer) ?? 0;
  const avgOld = averageScore(older) ?? 0;
  const diff = avgNew - avgOld;
  if (diff >= 8) return "improving";
  if (diff <= -8) return "slipping";
  return "flat";
}

function isClean(c: Classification): boolean {
  return c === "clean";
}

// ── Action templates (one mistake → one prescription) ─────────────────

const FOCUS_ACTION: Partial<Record<MistakeId, { title: string; sub: string }>> = {
  fomo: {
    title: "Pause. No entry without confirmation.",
    sub: "Wait for full setup criteria before the next trade.",
  },
  no_setup: {
    title: "Confirm the setup before clicking buy.",
    sub: "If the criteria are not on the chart, you do not have a trade.",
  },
  revenge_trade: {
    title: "Step away. Reset your decision cycle.",
    sub: "Skip the next setup. The chart is not the problem.",
  },
  moved_sl: {
    title: "Lock the stop loss.",
    sub: "No adjustments after entry. Predefine, then execute.",
  },
  ignored_sl: {
    title: "Honor the stop next trade.",
    sub: "Set it, walk away from the screen until it triggers.",
  },
  overleveraged: {
    title: "Cut size on the next entry.",
    sub: "Return to your defined risk before adding any size.",
  },
  oversized: {
    title: "Cut size on the next entry.",
    sub: "Return to your defined risk before adding any size.",
  },
  broke_risk_rule: {
    title: "Re-anchor on your risk rules.",
    sub: "Read your plan before the next setup. No exceptions.",
  },
  early_entry: {
    title: "Wait for the trigger.",
    sub: "Anticipation is not confirmation. Let the setup come to you.",
  },
  late_entry: {
    title: "Skip late entries.",
    sub: "If price has already moved, the trade is gone. Wait for the next.",
  },
};

function actionFor(mistake: MistakeId, tone: Tone): { title: string; sub: string; tone: Tone } {
  const a = FOCUS_ACTION[mistake] ?? {
    title: "Tighten execution.",
    sub: "Run the next setup through the analyzer before clicking buy.",
  };
  return { ...a, tone };
}

// ── Core ──────────────────────────────────────────────────────────────

export function generateInsight(
  entries: JournalEntry[],
  windowSize: number = INSIGHT_WINDOW,
): BehaviorInsight {
  const window = entries.slice(0, Math.max(1, windowSize));
  const avg = averageScore(window);
  const ctrl = controlBucket(avg);
  const last = window[0];
  const cleanStreak = last?.clean_streak_after ?? 0;
  const breakStreak = last?.break_streak_after ?? 0;
  const trend = trendOf(window);

  // ── Edge cases ──
  if (window.length === 0) {
    return {
      kind: "empty",
      insight: "No behavior detected yet.",
      action: {
        title: "Log your first trade",
        sub: "Seneca needs one trade to start tracking your behavior.",
        tone: "inactive",
      },
      controlState: ctrl.state,
      controlLabel: ctrl.label,
      windowSize: 0,
      trace: {
        repeatingMistake: null,
        cluster: null,
        avgScore: null,
        cleanStreak: 0,
        breakStreak: 0,
        trend: "n/a",
      },
    };
  }

  if (window.length === 1) {
    const cleanOnly = isClean(last.classification);
    return {
      kind: "single_trade",
      insight: cleanOnly
        ? "One clean trade logged. Pattern not established yet."
        : "One trade logged. Pattern not established yet.",
      action: cleanOnly
        ? {
            title: "Repeat the process.",
            sub: "Take the next setup with the same criteria.",
            tone: "ok",
          }
        : {
            title: "Log the next trade with care.",
            sub: "Seneca needs more data to detect a pattern.",
            tone: "drift",
          },
      controlState: ctrl.state,
      controlLabel: ctrl.label,
      windowSize: 1,
      trace: {
        repeatingMistake: null,
        cluster: null,
        avgScore: avg,
        cleanStreak,
        breakStreak,
        trend: "n/a",
      },
    };
  }

  // ── Pattern detection ──
  const freq = frequency(window);
  const ranked = Array.from(freq.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
  const topMistake = ranked.find((r) => r.count >= REPEAT_THRESHOLD) ?? null;

  const clusterMap = clusters(window);
  const topCluster = Array.from(clusterMap.values())
    .filter((c) => c.count >= REPEAT_THRESHOLD)
    .sort((a, b) => b.count - a.count)[0] ?? null;

  // Clean streak reward — strongest positive signal first.
  if (cleanStreak >= CLEAN_STREAK_REWARD) {
    return {
      kind: "clean_streak",
      insight: `${cleanStreak} clean trades in a row. You are executing with control.`,
      action: {
        title: "Maintain this standard.",
        sub: "Do nothing different. Repeat the process.",
        tone: "ok",
      },
      controlState: ctrl.state,
      controlLabel: ctrl.label,
      windowSize: window.length,
      trace: {
        repeatingMistake: topMistake,
        cluster: topCluster,
        avgScore: avg,
        cleanStreak,
        breakStreak,
        trend,
      },
    };
  }

  // Cluster pattern — combinations are the highest-signal failure mode.
  if (topCluster) {
    const aLabel = MISTAKE_LABEL[topCluster.a] ?? topCluster.a;
    const bLabel = MISTAKE_LABEL[topCluster.b] ?? topCluster.b;
    const tone: Tone = ctrl.tone === "ok" ? "drift" : ctrl.tone;
    return {
      kind: "cluster",
      insight: `Your mistakes are not random. You tend to ${aLabel.toLowerCase()} when you also ${bLabel.toLowerCase()}.`,
      action: actionFor(topCluster.a, tone),
      controlState: ctrl.state,
      controlLabel: ctrl.label,
      windowSize: window.length,
      trace: {
        repeatingMistake: topMistake,
        cluster: topCluster,
        avgScore: avg,
        cleanStreak,
        breakStreak,
        trend,
      },
    };
  }

  // Repetition pattern — same mistake recurring.
  if (topMistake) {
    const label = MISTAKE_LABEL[topMistake.id] ?? topMistake.id;
    let insightText: string;
    let tone: Tone;
    if (topMistake.count >= HARD_PATTERN_THRESHOLD) {
      insightText = `${label} ${topMistake.count} times in your last ${window.length}. This is behavior, not a mistake anymore.`;
      tone = "risk";
    } else if (topMistake.count >= ESCALATE_THRESHOLD) {
      insightText = `${label} ${topMistake.count} of your last ${window.length}. This is now a pattern. You are not adjusting.`;
      tone = "warn";
    } else {
      insightText = `You've repeated ${label.toLowerCase()} in ${topMistake.count} of your last ${window.length} trades.`;
      tone = ctrl.tone === "ok" ? "drift" : ctrl.tone;
    }
    return {
      kind: "repetition",
      insight: insightText,
      action: actionFor(topMistake.id, tone),
      controlState: ctrl.state,
      controlLabel: ctrl.label,
      windowSize: window.length,
      trace: {
        repeatingMistake: topMistake,
        cluster: null,
        avgScore: avg,
        cleanStreak,
        breakStreak,
        trend,
      },
    };
  }

  // Directional drift — score trajectory only, no specific mistake.
  if (trend === "slipping" || breakStreak >= 2) {
    return {
      kind: "drift",
      insight: "Your discipline is slipping. Recent trades show increasing rule breaks.",
      action: {
        title: "Slow down before the next entry.",
        sub: "Confirm every criterion. If it's not perfect, skip it.",
        tone: "warn",
      },
      controlState: ctrl.state,
      controlLabel: ctrl.label,
      windowSize: window.length,
      trace: {
        repeatingMistake: null,
        cluster: null,
        avgScore: avg,
        cleanStreak,
        breakStreak,
        trend,
      },
    };
  }

  if (trend === "improving") {
    return {
      kind: "stabilizing",
      insight: "You're stabilizing. Clean executions are becoming more consistent.",
      action: {
        title: "Hold the line.",
        sub: "Run the next setup through the same checklist.",
        tone: "ok",
      },
      controlState: ctrl.state,
      controlLabel: ctrl.label,
      windowSize: window.length,
      trace: {
        repeatingMistake: null,
        cluster: null,
        avgScore: avg,
        cleanStreak,
        breakStreak,
        trend,
      },
    };
  }

  // Neutral fallback — calm, no fabricated pattern.
  return {
    kind: "neutral",
    insight: "Behavior is stable. No dominant pattern in the last few trades.",
    action: {
      title: "Stay in rhythm.",
      sub: "Grade every setup through the analyzer before clicking buy.",
      tone: ctrl.tone === "ok" ? "ok" : "drift",
    },
    controlState: ctrl.state,
    controlLabel: ctrl.label,
    windowSize: window.length,
    trace: {
      repeatingMistake: null,
      cluster: null,
      avgScore: avg,
      cleanStreak,
      breakStreak,
      trend,
    },
  };
}
