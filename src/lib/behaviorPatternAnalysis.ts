// Behavior pattern analysis (Pattern Detection Engine)
// -----------------------------------------------------
// Deterministic, mathematically consistent multi-trade pattern reader.
// Spec:
//   - Window: last 20 trades (use all if fewer).
//   - Frequency: count / total per mistake.
//   - Recency-weighted frequency:
//       weight(i) = max(0.5, 1.0 - i * 0.025)  (i=0 = most recent)
//       weighted_frequency = Σ(weight × occurrence) / Σ(weights)
//   - Dominant mistake: highest weighted_frequency, only if ≥ 0.30.
//   - Trend: split last-5 vs remaining via discipline scores.
//       recent_avg > past_avg + 5  → improving
//       recent_avg < past_avg - 5  → declining
//       else                        → stable
//   - Behavior classification:
//       controlled    → avgScore > 80 AND low mistake frequency (<0.20)
//       undisciplined → avgScore < 50 AND strong mistake pattern (≥0.30)
//       improving     → trend = improving
//       inconsistent  → fluctuating, no dominant mistake
//   - No-data fallback: total < 3 → suppress insights, return canned line.
//   - Pure, deterministic, no randomness.
//
// Caller passes JournalEntry[] (any order). Internally we sort newest-first.

import {
  MISTAKE_LABEL,
  MISTAKE_PENALTY,
  SEVERE_IDS,
  type JournalEntry,
  type MistakeId,
} from "@/lib/behavioralJournal";

// ---- Spec constants -------------------------------------------------------
const WINDOW_SIZE = 20;
const RECENT_WINDOW = 5;
const MIN_TRADES_FOR_INSIGHTS = 3;
const MIN_PER_HALF_FOR_TREND = 3;
const TREND_DELTA_THRESHOLD = 5;
const DOMINANT_THRESHOLD = 0.3; // weighted frequency
const CONTROLLED_SCORE = 80;
const UNDISCIPLINED_SCORE = 50;
const LOW_FREQ_CEILING = 0.2; // for "controlled"
const NO_DATA_LINE =
  "Log a few trades so I can identify your patterns.";

// ---- Types ----------------------------------------------------------------
export type MistakeFreq = {
  id: MistakeId;
  label: string;
  count: number;
  /** Raw share of trades that contained this mistake (0..100). */
  pct: number;
  /** Recency-weighted frequency in 0..1 (Σ(w·occ)/Σ(w)). */
  weightedFrequency: number;
  /** Weighted frequency expressed as a 0..100 percent for UI/quotes. */
  weightedPct: number;
  /** Total raw penalty contributed across windowed trades, before per-trade cap. */
  totalPenalty: number;
  severe: boolean;
};

export type TrendDirection =
  | "improving"
  | "declining"
  | "stable"
  | "insufficient_data";

export type BehaviorState =
  | "controlled"
  | "undisciplined"
  | "improving"
  | "inconsistent"
  | "insufficient_data";

export type BehaviorPatternSummary = {
  /** Trades actually used (capped at WINDOW_SIZE). */
  totalTrades: number;
  /** Trades available before windowing (for transparency). */
  totalAvailable: number;
  windowSize: number;
  cleanRate: number; // % of windowed trades with zero mistakes
  /** Average discipline score across the window (rounded to 1dp). */
  avgScore: number | null;
  mistakeFrequency: MistakeFreq[];
  /** Highest weighted_frequency mistake, only if ≥ 0.30. Else null. */
  dominantWeakness: MistakeFreq | null;
  recentVsPrevious: {
    recentCount: number;
    previousCount: number;
    recentAvgScore: number | null;
    previousAvgScore: number | null;
    /** recentAvgScore - previousAvgScore, rounded to 1 decimal. */
    delta: number | null;
    recentMistakeRate: number;
    previousMistakeRate: number;
  };
  trend: TrendDirection;
  /** Mistakes that show up in the recent 5 AND in older windowed trades. */
  repeatedInRecent: MistakeFreq[];
  /** Behavior classification per spec section 7. */
  behaviorState: BehaviorState;
  /** True when total < MIN_TRADES_FOR_INSIGHTS. */
  insufficientData: boolean;
  /** Single deterministic mentor line per spec sections 8/9/10. */
  mentorLine: string;
  /** Short, ready-to-quote lines for the mentor (deterministic, ordered). */
  headlines: string[];
};

// ---- Helpers --------------------------------------------------------------
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return round1(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function uniqueMistakes(entry: JournalEntry): MistakeId[] {
  return Array.from(new Set(entry.mistakes ?? []));
}

/** Recency weight per spec: w(i) = max(0.5, 1.0 - i*0.025), i=0 is newest. */
function recencyWeight(idx: number): number {
  return Math.max(0.5, 1.0 - idx * 0.025);
}

/**
 * Build mistake frequency table for a newest-first slice using recency-
 * weighted occurrences. Returns rows sorted by weightedFrequency desc.
 */
function buildFrequency(newestFirst: JournalEntry[]): MistakeFreq[] {
  if (newestFirst.length === 0) return [];

  const totalWeight = newestFirst.reduce(
    (s, _e, i) => s + recencyWeight(i),
    0,
  );

  const acc = new Map<
    MistakeId,
    { count: number; weighted: number; penalty: number }
  >();

  newestFirst.forEach((entry, i) => {
    const w = recencyWeight(i);
    for (const id of uniqueMistakes(entry)) {
      const prev = acc.get(id) ?? { count: 0, weighted: 0, penalty: 0 };
      prev.count += 1;
      prev.weighted += w;
      prev.penalty += MISTAKE_PENALTY[id] ?? 0;
      acc.set(id, prev);
    }
  });

  const total = newestFirst.length;
  return Array.from(acc.entries())
    .map(([id, v]) => {
      const wf = totalWeight > 0 ? v.weighted / totalWeight : 0;
      return {
        id,
        label: MISTAKE_LABEL[id] ?? id,
        count: v.count,
        pct: Math.round((v.count / total) * 100),
        weightedFrequency: Math.round(wf * 1000) / 1000,
        weightedPct: Math.round(wf * 100),
        totalPenalty: v.penalty,
        severe: SEVERE_IDS.has(id),
      };
    })
    .sort(
      (a, b) =>
        b.weightedFrequency - a.weightedFrequency ||
        b.count - a.count ||
        b.totalPenalty - a.totalPenalty ||
        a.label.localeCompare(b.label),
    );
}

// ---- Mentor line builder (deterministic, no randomness) ------------------
function buildMentorLine(args: {
  total: number;
  insufficient: boolean;
  state: BehaviorState;
  trend: TrendDirection;
  dominant: MistakeFreq | null;
  recentCount: number;
}): string {
  if (args.insufficient) return NO_DATA_LINE;

  // Priority order per spec section 9 — dominant mistake first when present,
  // then trend-driven lines, then state, then a stable fallback.
  if (args.dominant) {
    return `${args.dominant.label} appears in ${args.dominant.weightedPct}% of your recent trades. This is your main issue right now.`;
  }
  if (args.trend === "improving") {
    return "Your recent trades are cleaner. Keep this behavior.";
  }
  if (args.trend === "declining") {
    return "Your discipline is slipping in recent trades. Something changed.";
  }
  if (args.state === "controlled") {
    return "Your behavior is consistent. Maintain this execution.";
  }
  if (args.state === "undisciplined") {
    return "Your last trades show repeated breakdowns. Reset before the next entry.";
  }
  if (args.state === "inconsistent") {
    return "Your scores are fluctuating with no single dominant mistake. Tighten the inputs you control.";
  }
  // Stable, no dominant pattern, not enough signal for a stronger call.
  return "No dominant pattern in your recent trades. Keep logging — the signal needs more data.";
}

// ---- Public API -----------------------------------------------------------
/**
 * Analyze behavior patterns across journal entries. Implements the
 * Pattern Detection Engine spec.
 *
 * @param entries - Journal entries (any order). Newest-first ordering is
 *   reconstructed internally from `created_at`.
 */
export function analyzeBehaviorPatterns(
  entries: JournalEntry[],
): BehaviorPatternSummary {
  const totalAvailable = entries.length;

  // Newest-first, then cap at WINDOW_SIZE per spec section 2.
  const newestFirstAll = [...entries].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const newestFirst = newestFirstAll.slice(0, WINDOW_SIZE);
  const total = newestFirst.length;

  const recent = newestFirst.slice(0, RECENT_WINDOW);
  const previous = newestFirst.slice(RECENT_WINDOW);

  const allFreq = buildFrequency(newestFirst);
  const recentFreq = buildFrequency(recent);
  const previousFreq = buildFrequency(previous);

  const previousMistakeIds = new Set(previousFreq.map((m) => m.id));
  const recentMistakeIds = new Set(recentFreq.map((m) => m.id));
  const repeatedInRecent = recentFreq.filter((m) =>
    previousMistakeIds.has(m.id),
  );

  const recentAvgScore = avg(recent.map((e) => e.score_after));
  const previousAvgScore = avg(previous.map((e) => e.score_after));
  const avgScore = avg(newestFirst.map((e) => e.score_after));
  const delta =
    recentAvgScore != null && previousAvgScore != null
      ? round1(recentAvgScore - previousAvgScore)
      : null;

  const recentMistakeCount = recent.reduce(
    (s, e) => s + uniqueMistakes(e).length,
    0,
  );
  const previousMistakeCount = previous.reduce(
    (s, e) => s + uniqueMistakes(e).length,
    0,
  );
  const recentMistakeRate =
    recent.length > 0 ? round1(recentMistakeCount / recent.length) : 0;
  const previousMistakeRate =
    previous.length > 0 ? round1(previousMistakeCount / previous.length) : 0;

  // Trend per spec section 6.
  let trend: TrendDirection;
  if (
    recent.length < MIN_PER_HALF_FOR_TREND ||
    previous.length < MIN_PER_HALF_FOR_TREND ||
    delta == null
  ) {
    trend = "insufficient_data";
  } else if (delta > TREND_DELTA_THRESHOLD) {
    trend = "improving";
  } else if (delta < -TREND_DELTA_THRESHOLD) {
    trend = "declining";
  } else {
    trend = "stable";
  }

  // Dominant per spec section 5: highest weighted_frequency, ≥ 0.30.
  const topCandidate = allFreq[0] ?? null;
  const dominant =
    topCandidate && topCandidate.weightedFrequency >= DOMINANT_THRESHOLD
      ? topCandidate
      : null;

  const cleanCount = newestFirst.filter(
    (e) => uniqueMistakes(e).length === 0,
  ).length;
  const cleanRate = total > 0 ? Math.round((cleanCount / total) * 100) : 0;

  // Behavior classification per spec section 7.
  const insufficient = totalAvailable < MIN_TRADES_FOR_INSIGHTS;
  let behaviorState: BehaviorState;
  if (insufficient || avgScore == null) {
    behaviorState = "insufficient_data";
  } else if (
    avgScore < UNDISCIPLINED_SCORE &&
    dominant &&
    dominant.weightedFrequency >= DOMINANT_THRESHOLD
  ) {
    behaviorState = "undisciplined";
  } else if (trend === "improving") {
    behaviorState = "improving";
  } else if (
    avgScore > CONTROLLED_SCORE &&
    (topCandidate === null ||
      topCandidate.weightedFrequency < LOW_FREQ_CEILING)
  ) {
    behaviorState = "controlled";
  } else {
    behaviorState = "inconsistent";
  }

  const mentorLine = buildMentorLine({
    total,
    insufficient,
    state: behaviorState,
    trend,
    dominant,
    recentCount: recent.length,
  });

  // Headlines — deterministic, ordered. Suppressed when insufficient data.
  const headlines: string[] = [];

  if (insufficient) {
    headlines.push(NO_DATA_LINE);
  } else {
    if (dominant) {
      const severityNote = dominant.severe ? " (severe)" : "";
      headlines.push(
        `Dominant weakness: ${dominant.label}${severityNote} — ${dominant.count} of ${total} trades (${dominant.pct}%, weighted ${dominant.weightedPct}%).`,
      );
    } else if (topCandidate) {
      headlines.push(
        `Top recurring mistake: ${topCandidate.label} — ${topCandidate.count}/${total} (${topCandidate.pct}%, weighted ${topCandidate.weightedPct}%, below 30% dominance).`,
      );
    } else {
      headlines.push(
        `Clean execution across all ${total} windowed trade${total === 1 ? "" : "s"}.`,
      );
    }

    if (trend === "improving" && delta != null) {
      headlines.push(
        `Trend: improving — last ${recent.length} avg ${recentAvgScore} vs previous ${previous.length} avg ${previousAvgScore} (+${delta}).`,
      );
    } else if (trend === "declining" && delta != null) {
      headlines.push(
        `Trend: declining — last ${recent.length} avg ${recentAvgScore} vs previous ${previous.length} avg ${previousAvgScore} (${delta}).`,
      );
    } else if (trend === "stable" && delta != null) {
      headlines.push(
        `Trend: stable — last ${recent.length} avg ${recentAvgScore} vs previous ${previous.length} avg ${previousAvgScore}.`,
      );
    } else if (recent.length > 0 && previous.length === 0) {
      headlines.push(
        `Only ${recent.length} trade${recent.length === 1 ? "" : "s"} logged so far — not enough history to call a trend.`,
      );
    }

    if (repeatedInRecent.length > 0) {
      const top = repeatedInRecent.slice(0, 2).map((m) => m.label).join(", ");
      headlines.push(
        `Repeating now: ${top} — already present in earlier trades, showing up again in the last ${recent.length}.`,
      );
    } else if (
      recent.length > 0 &&
      previous.length > 0 &&
      recentMistakeIds.size > 0
    ) {
      headlines.push(
        `New behavior in last ${recent.length}: ${recentFreq
          .slice(0, 2)
          .map((m) => m.label)
          .join(", ")} — not in older trades.`,
      );
    }

    headlines.push(`Behavior state: ${behaviorState}.`);
    if (cleanRate > 0) {
      headlines.push(`Clean trades: ${cleanCount}/${total} (${cleanRate}%).`);
    }
  }

  return {
    totalTrades: total,
    totalAvailable,
    windowSize: WINDOW_SIZE,
    cleanRate,
    avgScore,
    mistakeFrequency: allFreq,
    dominantWeakness: dominant,
    recentVsPrevious: {
      recentCount: recent.length,
      previousCount: previous.length,
      recentAvgScore,
      previousAvgScore,
      delta,
      recentMistakeRate,
      previousMistakeRate,
    },
    trend,
    repeatedInRecent,
    behaviorState,
    insufficientData: insufficient,
    mentorLine,
    headlines,
  };
}
