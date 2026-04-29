// Relapse & Behavioral Loop Detection
// -----------------------------------
// Builds on the Pattern Detection Engine (behaviorPatternAnalysis.ts) to
// detect:
//
//  1) Relapse — an improving user slipping back into a mistake they had
//     previously reduced.
//       Improvement state: recent_avg > past_avg + 5 AND the dominant mistake
//       in the previous slice now has a LOWER weighted frequency in the
//       recent slice.
//       Relapse fires when a previously-reduced mistake reappears in the
//       last 3 trades.
//       Severity:
//         light  → mistake appears once after improvement
//         medium → mistake appears 2× within the last 3 trades
//         strong → mistake appears 3× within the last 3 trades (i.e. every recent trade)
//
//  2) Loops — a mistake repeatedly following the SAME context (win, loss,
//     high_confidence). Triggered when ≥ 2 occurrences of the
//     (context → mistake) pair are observed in the windowed history.
//     Special-cased loops: "Win → mistake → loss", "Loss → revenge → loss".
//
//  3) Pre-trade awareness — a single short line the journal/dashboard can
//     show before the next trade when relapse OR a loop is active.
//
// Pure, deterministic, no randomness. Pure function of JournalEntry[].

import {
  MISTAKE_LABEL,
  type JournalEntry,
  type MistakeId,
} from "@/lib/behavioralJournal";
import { analyzeBehaviorPatterns } from "@/lib/behaviorPatternAnalysis";

const RELAPSE_LOOKBACK = 3; // trades inspected for severity (last 3)
const LOOP_MIN_OCCURRENCES = 2; // (context → mistake) pairs to call a loop
const LOOP_WINDOW = 20; // align with pattern engine window
// A mistake counts as "previously reduced" when its weighted frequency
// dropped by at least this much from previous → recent slice.
const REDUCTION_DELTA = 0.1;

export type RelapseSeverity = "light" | "medium" | "strong";

export type RelapseEvent = {
  mistakeId: MistakeId;
  mistakeLabel: string;
  /** Times the mistake appears in the last RELAPSE_LOOKBACK trades. */
  recentOccurrences: number;
  /** Times it appeared in older windowed trades (signal it had reduced). */
  previousOccurrences: number;
  severity: RelapseSeverity;
  /** Deterministic mentor line per spec section 5. */
  message: string;
};

export type LoopContext = "win" | "loss" | "high_confidence";

export type LoopEvent = {
  context: LoopContext;
  mistakeId: MistakeId;
  mistakeLabel: string;
  occurrences: number;
  /** Optional richer label, e.g. "Loss → revenge trade → loss". */
  loopLabel?: string;
  /** Deterministic mentor line per spec section 7. */
  message: string;
};

export type RelapseLoopReport = {
  improving: boolean;
  relapses: RelapseEvent[];
  loops: LoopEvent[];
  /** Optional pre-trade awareness line per spec section 8. */
  preTradeAwareness: string | null;
  /** Headlines the mentor can quote verbatim. */
  headlines: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────
function uniqueMistakes(entry: JournalEntry): MistakeId[] {
  return Array.from(new Set(entry.mistakes ?? []));
}

function severityFor(recentCount: number): RelapseSeverity {
  if (recentCount >= 3) return "strong";
  if (recentCount === 2) return "medium";
  return "light";
}

function relapseMessage(label: string, sev: RelapseSeverity): string {
  switch (sev) {
    case "light":
      return `You slipped back into ${label}. Stay aware.`;
    case "medium":
      return `${label} is starting to return. Don't let this become a pattern again.`;
    case "strong":
      return `You've fallen back into ${label}. This is your main issue again.`;
  }
}

function contextLabel(ctx: LoopContext): string {
  switch (ctx) {
    case "win":
      return "wins";
    case "loss":
      return "losses";
    case "high_confidence":
      return "high-confidence setups";
  }
}

/**
 * Classify a single trade outcome from result_r. We only know discrete
 * R-multiple results in this module — `> 0` is a win, `< 0` is a loss,
 * `=== 0` (rare in practice) is treated as neutral and ignored for context.
 */
function outcomeOf(entry: JournalEntry): "win" | "loss" | "neutral" {
  if (entry.result_r > 0) return "win";
  if (entry.result_r < 0) return "loss";
  return "neutral";
}

// ── Core ──────────────────────────────────────────────────────────────────
/**
 * Detect relapse + behavioral loops across journal entries.
 *
 * @param entries - Journal entries (any order). Newest-first ordering is
 *   reconstructed internally from `created_at`.
 */
export function detectRelapseAndLoops(
  entries: JournalEntry[],
): RelapseLoopReport {
  // Newest-first, capped at the same window as the pattern engine.
  const newestFirst = [...entries]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, LOOP_WINDOW);

  // Defer to the pattern engine for trend + frequency math so improvement
  // detection stays consistent with the rest of the system.
  const patterns = analyzeBehaviorPatterns(entries);
  const recent = newestFirst.slice(0, 5);
  const previous = newestFirst.slice(5);

  // ── 1) Improvement state per spec section 2 ──────────────────────────
  // recent_avg > past_avg + 5 AND the mistake that DOMINATED the previous
  // slice has a lower weighted frequency in the recent slice.
  const recentScores = recent.map((e) => e.score_after);
  const previousScores = previous.map((e) => e.score_after);
  const recentAvg =
    recentScores.length > 0
      ? recentScores.reduce((s, n) => s + n, 0) / recentScores.length
      : null;
  const previousAvg =
    previousScores.length > 0
      ? previousScores.reduce((s, n) => s + n, 0) / previousScores.length
      : null;

  // Recompute weighted frequencies on each half via the same engine.
  const previousAnalysis = analyzeBehaviorPatterns(previous);
  const recentAnalysis = analyzeBehaviorPatterns(recent);

  const previousFreqMap = new Map(
    previousAnalysis.mistakeFrequency.map((m) => [m.id, m.weightedFrequency]),
  );
  const recentFreqMap = new Map(
    recentAnalysis.mistakeFrequency.map((m) => [m.id, m.weightedFrequency]),
  );

  const previousTopMistake = previousAnalysis.mistakeFrequency[0] ?? null;
  const previousTopReduced =
    previousTopMistake != null
      ? (recentFreqMap.get(previousTopMistake.id) ?? 0) <
        previousTopMistake.weightedFrequency
      : false;

  const improving =
    recentAvg != null &&
    previousAvg != null &&
    recent.length >= 3 &&
    previous.length >= 3 &&
    recentAvg > previousAvg + 5 &&
    previousTopReduced;

  // ── 2) Relapse detection per spec sections 3–5 ──────────────────────
  const relapses: RelapseEvent[] = [];
  if (improving) {
    // "Previously reduced" mistakes — anything that was present in the
    // previous slice but whose weighted frequency dropped meaningfully in
    // the recent slice (or vanished entirely).
    const reducedMistakes = previousAnalysis.mistakeFrequency.filter((m) => {
      const recentWf = recentFreqMap.get(m.id) ?? 0;
      return m.weightedFrequency - recentWf >= REDUCTION_DELTA;
    });

    const lastN = newestFirst.slice(0, RELAPSE_LOOKBACK);
    for (const m of reducedMistakes) {
      const recentCount = lastN.filter((e) =>
        uniqueMistakes(e).includes(m.id),
      ).length;
      if (recentCount === 0) continue;
      const sev = severityFor(recentCount);
      relapses.push({
        mistakeId: m.id,
        mistakeLabel: m.label,
        recentOccurrences: recentCount,
        previousOccurrences: m.count,
        severity: sev,
        message: relapseMessage(m.label, sev),
      });
    }

    // Sort: strong → medium → light, then by recent occurrences.
    const sevRank: Record<RelapseSeverity, number> = {
      strong: 3,
      medium: 2,
      light: 1,
    };
    relapses.sort(
      (a, b) =>
        sevRank[b.severity] - sevRank[a.severity] ||
        b.recentOccurrences - a.recentOccurrences ||
        a.mistakeLabel.localeCompare(b.mistakeLabel),
    );
  }

  // ── 3) Loop detection per spec section 6 ────────────────────────────
  // Build (context → mistake) pair counts. Context = outcome of the trade
  // IMMEDIATELY BEFORE the mistake trade (chronologically). Loops fire when
  // the same (context, mistake) pair shows up at least LOOP_MIN_OCCURRENCES
  // times across the windowed history.
  //
  // newestFirst[0] is the latest. To examine "trade after a win", we walk
  // pairs (older → newer). Convert to chronological order first.
  const chronological = [...newestFirst].reverse();
  type PairKey = `${LoopContext}::${MistakeId}`;
  const pairCounts = new Map<
    PairKey,
    { count: number; context: LoopContext; mistakeId: MistakeId }
  >();
  // Track followups for the special "loss → revenge → loss" cascade.
  let revengeLossCascade = 0;
  let winMistakeLoss = 0;

  for (let i = 1; i < chronological.length; i++) {
    const prev = chronological[i - 1];
    const cur = chronological[i];
    const prevOutcome = outcomeOf(prev);
    if (prevOutcome === "neutral") continue;

    const curMistakes = uniqueMistakes(cur);
    if (curMistakes.length === 0) continue;

    const contexts: LoopContext[] = [prevOutcome];
    // Treat severe / oversized / overleveraged on prev trade as
    // "high confidence" setups regressing into mistakes.
    const prevHighConfidence = uniqueMistakes(prev).some((id) =>
      ["overleveraged", "oversized"].includes(id),
    );
    if (prevHighConfidence) contexts.push("high_confidence");

    for (const ctx of contexts) {
      for (const mId of curMistakes) {
        const key: PairKey = `${ctx}::${mId}`;
        const existing = pairCounts.get(key) ?? {
          count: 0,
          context: ctx,
          mistakeId: mId,
        };
        existing.count += 1;
        pairCounts.set(key, existing);
      }
    }

    // Cascade detections need a 3rd trade.
    if (i + 1 < chronological.length) {
      const next = chronological[i + 1];
      const nextOutcome = outcomeOf(next);
      if (
        prevOutcome === "loss" &&
        curMistakes.includes("revenge_trade") &&
        nextOutcome === "loss"
      ) {
        revengeLossCascade += 1;
      }
      if (
        prevOutcome === "win" &&
        curMistakes.length > 0 &&
        nextOutcome === "loss"
      ) {
        winMistakeLoss += 1;
      }
    }
  }

  const loops: LoopEvent[] = [];
  for (const { count, context, mistakeId } of pairCounts.values()) {
    if (count < LOOP_MIN_OCCURRENCES) continue;
    const label = MISTAKE_LABEL[mistakeId] ?? mistakeId;
    loops.push({
      context,
      mistakeId,
      mistakeLabel: label,
      occurrences: count,
      message: `You tend to ${label.toLowerCase()} after ${contextLabel(context)}. This is a repeating loop.`,
    });
  }

  if (revengeLossCascade >= 1) {
    loops.unshift({
      context: "loss",
      mistakeId: "revenge_trade",
      mistakeLabel: MISTAKE_LABEL.revenge_trade,
      occurrences: revengeLossCascade + 1, // count includes the trigger trade
      loopLabel: "Loss → revenge trade → loss",
      message:
        "Loss → revenge trade → loss is repeating. The slip is cascading — stop and reset.",
    });
  }
  if (winMistakeLoss >= LOOP_MIN_OCCURRENCES) {
    loops.unshift({
      context: "win",
      // No single mistake — represent the cascade with the most frequent
      // post-win mistake when available, else fall back to a generic id.
      mistakeId: (() => {
        let best: { id: MistakeId; count: number } | null = null;
        for (const v of pairCounts.values()) {
          if (v.context !== "win") continue;
          if (!best || v.count > best.count) best = { id: v.mistakeId, count: v.count };
        }
        return best?.id ?? "fomo";
      })(),
      mistakeLabel: "post-win mistakes",
      occurrences: winMistakeLoss,
      loopLabel: "Win → mistake → loss",
      message:
        "Win → mistake → loss keeps repeating. Wins are pulling you out of process.",
    });
  }

  // De-dup by (context + mistakeId), keep highest occurrences.
  const dedup = new Map<string, LoopEvent>();
  for (const l of loops) {
    const k = `${l.context}::${l.mistakeId}::${l.loopLabel ?? ""}`;
    const prev = dedup.get(k);
    if (!prev || l.occurrences > prev.occurrences) dedup.set(k, l);
  }
  const finalLoops = Array.from(dedup.values()).sort(
    (a, b) => b.occurrences - a.occurrences || a.mistakeLabel.localeCompare(b.mistakeLabel),
  );

  // ── 4) Pre-trade awareness per spec section 8 ───────────────────────
  let preTradeAwareness: string | null = null;
  if (relapses.length > 0) {
    const top = relapses[0];
    preTradeAwareness = `You've recently shown a relapse into ${top.mistakeLabel}. Stay controlled on this trade.`;
  } else if (finalLoops.length > 0) {
    const top = finalLoops[0];
    const pattern = top.loopLabel
      ? top.loopLabel.toLowerCase()
      : `${top.mistakeLabel.toLowerCase()} after ${contextLabel(top.context)}`;
    preTradeAwareness = `You've recently shown ${pattern}. Stay controlled on this trade.`;
  }

  // ── 5) Headlines (deterministic, ordered) ──────────────────────────
  const headlines: string[] = [];
  if (improving) headlines.push("State: improving (recent avg up >5 with dominant weakness reducing).");
  for (const r of relapses.slice(0, 3)) {
    headlines.push(
      `Relapse [${r.severity}]: ${r.mistakeLabel} ×${r.recentOccurrences} in last ${RELAPSE_LOOKBACK}.`,
    );
  }
  for (const l of finalLoops.slice(0, 3)) {
    headlines.push(
      l.loopLabel
        ? `Loop: ${l.loopLabel} ×${l.occurrences}.`
        : `Loop: ${l.mistakeLabel} after ${contextLabel(l.context)} ×${l.occurrences}.`,
    );
  }

  // Reference patterns avg score in headline when nothing else fired but
  // we still have signal — keeps consumers from getting an empty array.
  if (headlines.length === 0 && patterns.totalTrades > 0) {
    headlines.push(
      `No relapse or loop detected across last ${patterns.totalTrades} trades.`,
    );
  }

  return {
    improving,
    relapses,
    loops: finalLoops,
    preTradeAwareness,
    headlines,
  };
}
