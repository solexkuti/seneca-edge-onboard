// Confidence Breakdown — deterministic, transparent.
//
// The single AI confidence number is replaced by three sub‑scores the user
// can audit, plus a one‑line "why" derived from the weakest sub‑score.

import type { StructuralAnalysis } from "./marketCondition";
import type { StrategyAlignment } from "./strategyAlignment";

export type ConfidenceBreakdown = {
  overall: number; // 0–100
  structure_clarity: number;
  trend_strength: number;
  confirmation_signals: number;
  why: string;
};

type Quality = "clear" | "messy" | "unclear" | undefined;

function pctFromQuality(q: Quality): number {
  if (q === "clear") return 100;
  if (q === "messy") return 55;
  return 35; // unclear / undefined
}

function structureClarityScore(
  quality: Quality,
  structural: StructuralAnalysis | null,
): number {
  let s = pctFromQuality(quality);
  if (structural) {
    const sp = structural.swing_points;
    const cleanBull = sp.HH && sp.HL && !sp.LL;
    const cleanBear = sp.LH && sp.LL && !sp.HH;
    if (cleanBull || cleanBear) s = Math.max(s, 85);
    else if (!sp.HH && !sp.HL && !sp.LH && !sp.LL) s = Math.min(s, 45);
    if (structural.bos.occurred && structural.bos.trigger) s = Math.max(s, 75);
  }
  return Math.round(Math.max(0, Math.min(100, s)));
}

function trendStrengthScore(
  structural: StructuralAnalysis | null,
  candleOverlap: "low" | "medium" | "high" | null,
): number {
  let s = 50;
  const m = structural?.momentum_strength;
  if (m === "strong") s = 88;
  else if (m === "weak") s = 40;
  else if (m === "neutral") s = 55;

  if (candleOverlap === "low") s += 8;
  else if (candleOverlap === "high") s -= 12;

  if (structural?.is_pullback_or_shift === "structural_shift") s += 4;
  else if (structural?.is_pullback_or_shift === "indeterminate") s -= 6;

  return Math.round(Math.max(0, Math.min(100, s)));
}

function confirmationScore(alignment: StrategyAlignment | null): number {
  if (!alignment) return 50;
  const total = alignment.passed.length + alignment.failed.length;
  if (total === 0) return 40; // entire strategy is non‑observable
  const ratio = alignment.passed.length / total;
  // Map 0..1 → 30..95 (pure pass → strong; pure fail → low)
  return Math.round(30 + ratio * 65);
}

function buildWhy(
  parts: { structure: number; trend: number; confirmation: number },
  structural: StructuralAnalysis | null,
  candleOverlap: "low" | "medium" | "high" | null,
  alignment: StrategyAlignment | null,
): string {
  const ranked = [
    { key: "structure", v: parts.structure },
    { key: "trend", v: parts.trend },
    { key: "confirmation", v: parts.confirmation },
  ].sort((a, b) => a.v - b.v);

  const weakest = ranked[0];
  const fragments: string[] = [];

  if (weakest.key === "structure") {
    if (!structural || (!structural.swing_points.HH && !structural.swing_points.LL)) {
      fragments.push("Structure clarity is the weakest input — no clean swing progression on the chart.");
    } else if (structural.bos.occurred) {
      fragments.push("Structure is in transition — a break is in play but the new regime is not confirmed.");
    } else {
      fragments.push("Structure clarity is moderate — swing points are partial.");
    }
  } else if (weakest.key === "trend") {
    const m = structural?.momentum_strength ?? "neutral";
    if (m === "weak") fragments.push("Trend strength is the weakest input — momentum is fading on the latest leg.");
    else if (candleOverlap === "high") fragments.push("Trend strength is the weakest input — candles overlap heavily, signalling indecision.");
    else fragments.push("Trend strength is the weakest input — directional conviction is limited.");
  } else {
    if (alignment && alignment.failed.length > 0) {
      fragments.push(`Confirmation is the weakest input — ${alignment.failed.length} of your rules failed on this chart.`);
    } else if (alignment && alignment.not_applicable.length >= alignment.rules.length / 2) {
      fragments.push("Confirmation is the weakest input — much of your strategy is not chart‑observable from this image alone.");
    } else {
      fragments.push("Confirmation is the weakest input — partial signals only.");
    }
  }

  // Add a positive anchor when something is genuinely strong.
  const strongest = ranked[ranked.length - 1];
  if (strongest.v >= 80) {
    if (strongest.key === "structure") fragments.push("Structure reads cleanly.");
    else if (strongest.key === "trend") fragments.push("Trend reads cleanly.");
    else fragments.push("Confirmation set is largely intact.");
  }

  return fragments.join(" ");
}

export function computeConfidenceBreakdown(args: {
  quality: Quality;
  structural: StructuralAnalysis | null;
  candle_overlap: "low" | "medium" | "high" | null;
  alignment: StrategyAlignment | null;
}): ConfidenceBreakdown {
  const structure_clarity = structureClarityScore(args.quality, args.structural);
  const trend_strength = trendStrengthScore(args.structural, args.candle_overlap);
  const confirmation_signals = confirmationScore(args.alignment);

  const overall = Math.round(
    structure_clarity * 0.4 + trend_strength * 0.35 + confirmation_signals * 0.25,
  );

  const why = buildWhy(
    { structure: structure_clarity, trend: trend_strength, confirmation: confirmation_signals },
    args.structural,
    args.candle_overlap,
    args.alignment,
  );

  return { overall, structure_clarity, trend_strength, confirmation_signals, why };
}
