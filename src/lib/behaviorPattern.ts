// Behavior pattern engine — produces an OBSERVATIONAL, specific sentence
// about how the user is actually behaving, derived from their recent
// Trading Journal entries (rule adherence per dimension, timing between
// trades, result sequencing, and discipline trend). Never advice, never
// motivational, never generic. One clean sentence.

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
const REVENGE_WINDOW_MS = 15 * 60 * 1000; // loss → next trade within 15 min
const OVERTRADING_WINDOW_MS = 60 * 60 * 1000; // 4+ trades within 60 min
const OVERTRADING_COUNT = 4;

type Dim = "entry" | "exit" | "risk" | "behavior";

function brokenDim(e: JournalEntry, dim: Dim): boolean {
  const r = e.rules;
  if (!r) return false;
  return r[dim] === false;
}

function dominantBrokenDimension(entries: JournalEntry[]): Dim | null {
  const counts: Record<Dim, number> = { entry: 0, exit: 0, risk: 0, behavior: 0 };
  let any = false;
  for (const e of entries) {
    if (!e.rules) continue;
    (Object.keys(counts) as Dim[]).forEach((d) => {
      if (e.rules![d] === false) {
        counts[d] += 1;
        any = true;
      }
    });
  }
  if (!any) return null;
  let top: Dim = "entry";
  for (const d of Object.keys(counts) as Dim[]) {
    if (counts[d] > counts[top]) top = d;
  }
  return counts[top] >= 2 ? top : null;
}

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
  const chrono = [...recent].reverse(); // oldest → newest

  // ── A. Revenge trading — loss followed quickly by another trade ──
  for (let i = 0; i < chrono.length - 1; i++) {
    const prev = chrono[i];
    const next = chrono[i + 1];
    if (
      prev.resultR < 0 &&
      next.timestamp - prev.timestamp <= REVENGE_WINDOW_MS
    ) {
      // Slightly different framings depending on what broke after the loss
      if (next.followedPlan === false) {
        return {
          kind: "revenge",
          message:
            "You stay disciplined until the first loss, then you start improvising.",
        };
      }
      return {
        kind: "revenge",
        message: "After a loss, you re-enter before the setup re-forms.",
      };
    }
  }

  // ── B. Overtrading — clusters of trades in a short window ──
  for (let i = 0; i < chrono.length; i++) {
    const start = chrono[i].timestamp;
    const cluster = chrono.filter(
      (e) => e.timestamp >= start && e.timestamp - start <= OVERTRADING_WINDOW_MS,
    );
    if (cluster.length >= OVERTRADING_COUNT) {
      const brokenInCluster = cluster.filter((e) => e.followedPlan === false).length;
      if (brokenInCluster >= 2) {
        return {
          kind: "overtrading",
          message: "You're forcing trades when nothing is really there.",
        };
      }
      return {
        kind: "overtrading",
        message: "You're stacking trades faster than your setup actually appears.",
      };
    }
  }

  // ── C. Rule breaking — interpret WHICH rule is breaking, not just THAT ──
  const brokenCount = recent.filter((e) => e.followedPlan === false).length;
  if (brokenCount >= 2) {
    const dim = dominantBrokenDimension(recent);

    // Drift pattern: first half clean, second half breaks
    const half = Math.floor(chrono.length / 2);
    if (half >= 2) {
      const earlyBreaks = chrono.slice(0, half).filter((e) => e.followedPlan === false).length;
      const lateBreaks = chrono.slice(half).filter((e) => e.followedPlan === false).length;
      if (earlyBreaks === 0 && lateBreaks >= 2) {
        return {
          kind: "rule_breaking",
          message: "You follow structure early, then improvise under pressure.",
        };
      }
    }

    if (dim === "exit") {
      return {
        kind: "rule_breaking",
        message: "Your entries are clean, but your exits are losing control.",
      };
    }
    if (dim === "entry") {
      return {
        kind: "rule_breaking",
        message: "You're entering before your own conditions are actually met.",
      };
    }
    if (dim === "risk") {
      return {
        kind: "rule_breaking",
        message: "Your sizing is drifting away from your own risk rule.",
      };
    }
    if (dim === "behavior") {
      return {
        kind: "rule_breaking",
        message: "You're reacting to the screen instead of executing your plan.",
      };
    }

    return {
      kind: "rule_breaking",
      message: "You start the session disciplined, then loosen as it goes on.",
    };
  }

  // ── D. Discipline — consistent rule-following across the window ──
  if (recent.length >= MIN_WINDOW) {
    const tagged = recent.filter((e) => typeof e.followedPlan === "boolean");
    if (
      tagged.length >= MIN_WINDOW &&
      tagged.every((e) => e.followedPlan === true)
    ) {
      const wins = tagged.filter((e) => e.resultR > 0).length;
      const losses = tagged.filter((e) => e.resultR < 0).length;
      if (losses > 0 && wins > 0) {
        return {
          kind: "discipline",
          message:
            "You're taking losses without flinching — your process is holding.",
        };
      }
      return {
        kind: "discipline",
        message: "You're executing the same way trade after trade.",
      };
    }
  }

  // ── E. Neutral — data exists but no strong signal. Stay observational. ──
  // Look at the most recent entry to anchor the sentence in something real.
  const last = sorted[0];
  if (last) {
    if (last.followedPlan === false) {
      return {
        kind: "neutral",
        message: "Your last trade slipped from the plan — watch if it repeats.",
      };
    }
    if (last.resultR < 0 && last.followedPlan === true) {
      return {
        kind: "neutral",
        message: "You took a clean loss — the test is the next entry.",
      };
    }
    if (last.resultR > 0 && last.followedPlan === true) {
      return {
        kind: "neutral",
        message: "You're executing cleanly, but the sample is still small.",
      };
    }
  }

  return {
    kind: "neutral",
    message: "Not enough behavior yet to read a clear pattern.",
  };
}
