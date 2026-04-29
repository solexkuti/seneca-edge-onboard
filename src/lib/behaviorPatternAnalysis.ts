// Behavior pattern analysis
// -------------------------
// Produces a structured, mentor-ready summary of the user's behavioral
// patterns across their journal entries. The mentor reads this on every
// turn so its responses are anchored in REPEATING behavior, not one trade.
//
// Outputs:
//   - mistakeFrequency: every mistake with count + share of trades
//   - dominantWeakness: the single most repeated mistake (with severity)
//   - recentVsPrevious: discipline scores for the last 5 trades vs earlier
//   - trend: "improving" | "declining" | "stable" | "insufficient_data"
//   - repeatedInRecent: mistakes that appeared in last 5 AND in older trades
//   - headlines: short, human-readable lines the mentor can quote verbatim
//
// Pure function. No IO. Caller passes in JournalEntry[] (newest-first, the
// shape returned by useBehavioralJournal / fetchEntries).

import {
  MISTAKE_LABEL,
  MISTAKE_PENALTY,
  SEVERE_IDS,
  type JournalEntry,
  type MistakeId,
} from "@/lib/behavioralJournal";

const RECENT_WINDOW = 5;
// Trend is only meaningful when both halves carry signal. With <3 trades on
// either side, score swings dominate and we don't claim a direction.
const MIN_PER_HALF_FOR_TREND = 3;
// Score difference threshold (0..100) before we call something a real shift.
const TREND_DELTA_THRESHOLD = 5;

export type MistakeFreq = {
  id: MistakeId;
  label: string;
  count: number;
  /** Share of trades that contained this mistake (0..100). */
  pct: number;
  /** Total raw penalty contributed across all trades, before per-trade cap. */
  totalPenalty: number;
  severe: boolean;
};

export type TrendDirection =
  | "improving"
  | "declining"
  | "stable"
  | "insufficient_data";

export type BehaviorPatternSummary = {
  totalTrades: number;
  cleanRate: number; // % of trades with zero mistakes
  mistakeFrequency: MistakeFreq[];
  dominantWeakness: MistakeFreq | null;
  recentVsPrevious: {
    recentCount: number;
    previousCount: number;
    recentAvgScore: number | null;
    previousAvgScore: number | null;
    /** recentAvgScore - previousAvgScore, rounded to 1 decimal. */
    delta: number | null;
    recentMistakeRate: number; // mistakes per trade in last 5
    previousMistakeRate: number; // mistakes per trade in older slice
  };
  trend: TrendDirection;
  /** Mistakes that show up in the recent window AND in older trades. */
  repeatedInRecent: MistakeFreq[];
  /** Short, ready-to-quote lines for the mentor. Always non-empty. */
  headlines: string[];
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

function uniqueMistakes(entry: JournalEntry): MistakeId[] {
  return Array.from(new Set(entry.mistakes ?? []));
}

function buildFrequency(entries: JournalEntry[]): MistakeFreq[] {
  if (entries.length === 0) return [];
  const counts = new Map<MistakeId, { count: number; penalty: number }>();
  for (const e of entries) {
    for (const id of uniqueMistakes(e)) {
      const prev = counts.get(id) ?? { count: 0, penalty: 0 };
      prev.count += 1;
      prev.penalty += MISTAKE_PENALTY[id] ?? 0;
      counts.set(id, prev);
    }
  }
  const total = entries.length;
  return Array.from(counts.entries())
    .map(([id, v]) => ({
      id,
      label: MISTAKE_LABEL[id] ?? id,
      count: v.count,
      pct: Math.round((v.count / total) * 100),
      totalPenalty: v.penalty,
      severe: SEVERE_IDS.has(id),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.totalPenalty - a.totalPenalty ||
        a.label.localeCompare(b.label),
    );
}

/**
 * Analyze behavior patterns across all journal entries.
 *
 * @param entries - Journal entries, newest first (as returned by
 *   useBehavioralJournal). Older-first also works — order is rebuilt
 *   internally for the recent/previous split.
 */
export function analyzeBehaviorPatterns(
  entries: JournalEntry[],
): BehaviorPatternSummary {
  const total = entries.length;

  // Normalize to newest-first so slice(0, 5) is "last 5 trades".
  const newestFirst = [...entries].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const recent = newestFirst.slice(0, RECENT_WINDOW);
  const previous = newestFirst.slice(RECENT_WINDOW);

  const allFreq = buildFrequency(newestFirst);
  const recentFreq = buildFrequency(recent);
  const previousFreq = buildFrequency(previous);

  const recentMistakeIds = new Set(recentFreq.map((m) => m.id));
  const previousMistakeIds = new Set(previousFreq.map((m) => m.id));
  const repeatedInRecent = recentFreq.filter((m) =>
    previousMistakeIds.has(m.id),
  );

  const recentAvgScore = avg(recent.map((e) => e.score_after));
  const previousAvgScore = avg(previous.map((e) => e.score_after));
  const delta =
    recentAvgScore != null && previousAvgScore != null
      ? Math.round((recentAvgScore - previousAvgScore) * 10) / 10
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
    recent.length > 0
      ? Math.round((recentMistakeCount / recent.length) * 10) / 10
      : 0;
  const previousMistakeRate =
    previous.length > 0
      ? Math.round((previousMistakeCount / previous.length) * 10) / 10
      : 0;

  let trend: TrendDirection;
  if (
    recent.length < MIN_PER_HALF_FOR_TREND ||
    previous.length < MIN_PER_HALF_FOR_TREND ||
    delta == null
  ) {
    trend = "insufficient_data";
  } else if (delta >= TREND_DELTA_THRESHOLD) {
    trend = "improving";
  } else if (delta <= -TREND_DELTA_THRESHOLD) {
    trend = "declining";
  } else {
    trend = "stable";
  }

  const cleanCount = newestFirst.filter(
    (e) => uniqueMistakes(e).length === 0,
  ).length;
  const cleanRate =
    total > 0 ? Math.round((cleanCount / total) * 100) : 0;

  const dominant = allFreq[0] ?? null;

  // Build human-readable headlines the mentor can use verbatim. Order
  // matters: dominant weakness first, then trend, then recent repeats.
  const headlines: string[] = [];

  if (total === 0) {
    headlines.push("No trades logged yet — no behavior data to read from.");
  } else {
    if (dominant) {
      const severityNote = dominant.severe ? " (severe)" : "";
      headlines.push(
        `Dominant weakness: ${dominant.label}${severityNote} — ${dominant.count} of ${total} trades (${dominant.pct}%).`,
      );
    } else {
      headlines.push(
        `Clean execution across all ${total} logged trade${total === 1 ? "" : "s"}.`,
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

    if (cleanRate > 0) {
      headlines.push(
        `Clean trades: ${cleanCount}/${total} (${cleanRate}%).`,
      );
    }
  }

  return {
    totalTrades: total,
    cleanRate,
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
    headlines,
  };
}
