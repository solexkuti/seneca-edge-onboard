// Layer 2 — Market Condition Classifier (deterministic).
//
// Inputs come from:
//   * Layer 1 structural analysis (swing points, BOS, momentum)
//   * Feature extraction (trend, candle_overlap, volatility)
//
// Outputs a single market condition label + bias + clarity, with a "why"
// reasoning array so the UI can show the user how the classification was
// derived. No AI involvement — this is pure logic the user can audit.

export type SwingPoints = {
  HH: boolean;
  HL: boolean;
  LH: boolean;
  LL: boolean;
};

export type StructuralAnalysis = {
  swing_points: SwingPoints;
  bos: {
    occurred: boolean;
    direction: "bullish" | "bearish" | null;
    trigger: string | null;
  };
  momentum_strength: "strong" | "weak" | "neutral";
  key_zones: { kind: "support" | "resistance" | "supply" | "demand"; note: string }[];
  is_pullback_or_shift: "pullback" | "structural_shift" | "indeterminate";
  summary: string;
};

export type MarketConditionInput = {
  structural: StructuralAnalysis | null;
  candle_overlap: "low" | "medium" | "high" | null;
  trend: "bullish" | "bearish" | "range" | "unknown" | null;
};

export type MarketCondition = {
  label: "trending" | "choppy" | "transitional";
  bias: "bullish" | "bearish" | "neutral";
  clarity: "high" | "medium" | "low";
  reasoning: string[];
  signals: {
    candle_overlap: "low" | "medium" | "high";
    swing_progression: "clear" | "mixed" | "absent";
    direction_flips: "few" | "some" | "frequent";
  };
};

const LABEL_LABEL: Record<MarketCondition["label"], string> = {
  trending: "Trending",
  choppy: "Choppy / Consolidation",
  transitional: "Transitional / Weak trend",
};
const BIAS_LABEL: Record<MarketCondition["bias"], string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};
const CLARITY_LABEL: Record<MarketCondition["clarity"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const MARKET_CONDITION_LABEL = LABEL_LABEL;
export const MARKET_BIAS_LABEL = BIAS_LABEL;
export const MARKET_CLARITY_LABEL = CLARITY_LABEL;

function deriveSwingProgression(
  s: SwingPoints | null,
): "clear" | "mixed" | "absent" {
  if (!s) return "absent";
  const bullClean = s.HH && s.HL && !s.LL;
  const bearClean = s.LH && s.LL && !s.HH;
  if (bullClean || bearClean) return "clear";
  const any = s.HH || s.HL || s.LH || s.LL;
  if (!any) return "absent";
  return "mixed";
}

function deriveDirectionFlips(
  swing: "clear" | "mixed" | "absent",
  overlap: "low" | "medium" | "high",
): "few" | "some" | "frequent" {
  if (swing === "absent" && overlap === "high") return "frequent";
  if (swing === "mixed" || overlap === "high") return "some";
  return "few";
}

function deriveBias(s: SwingPoints | null, trend: MarketConditionInput["trend"]): MarketCondition["bias"] {
  if (s) {
    if (s.HH && s.HL && !s.LL) return "bullish";
    if (s.LH && s.LL && !s.HH) return "bearish";
  }
  if (trend === "bullish") return "bullish";
  if (trend === "bearish") return "bearish";
  return "neutral";
}

function deriveClarity(
  swing: "clear" | "mixed" | "absent",
  overlap: "low" | "medium" | "high",
): MarketCondition["clarity"] {
  if (swing === "clear" && overlap === "low") return "high";
  if (swing === "absent" || overlap === "high") return "low";
  return "medium";
}

/** Deterministic Layer 2 classifier. */
export function classifyMarketCondition(input: MarketConditionInput): MarketCondition {
  const overlap = input.candle_overlap ?? "medium";
  const swing = deriveSwingProgression(input.structural?.swing_points ?? null);
  const flips = deriveDirectionFlips(swing, overlap);
  const bias = deriveBias(input.structural?.swing_points ?? null, input.trend);
  const clarity = deriveClarity(swing, overlap);

  const momentum = input.structural?.momentum_strength ?? "neutral";
  const bosOccurred = !!input.structural?.bos.occurred;

  const reasoning: string[] = [];

  // Choppy: ≥2 of (high overlap, swing absent, frequent flips)
  const chopFlags = [
    overlap === "high",
    swing === "absent",
    flips === "frequent",
  ].filter(Boolean).length;

  let label: MarketCondition["label"];

  if (chopFlags >= 2) {
    label = "choppy";
    if (overlap === "high") reasoning.push("High candle overlap — bodies stacking inside one another rather than expanding.");
    if (swing === "absent") reasoning.push("No clean HH/HL or LH/LL progression — swing structure is absent.");
    if (flips === "frequent") reasoning.push("Frequent direction flips — no side holding control.");
  } else if (bosOccurred || (momentum === "weak" && swing === "mixed")) {
    label = "transitional";
    if (bosOccurred) {
      const dir = input.structural?.bos.direction;
      reasoning.push(
        dir
          ? `Break of structure detected (${dir}) — the prior regime is no longer in effect.`
          : "Break of structure detected — the prior regime is no longer in effect.",
      );
    }
    if (momentum === "weak") {
      reasoning.push("Momentum reads weak — displacement is fading on the latest leg.");
    }
    if (swing === "mixed") {
      reasoning.push("Swing progression is mixed — direction has not re‑established cleanly.");
    }
    if (reasoning.length === 0) {
      reasoning.push("Conditions sit between trend and chop — the move lacks conviction.");
    }
  } else {
    label = "trending";
    if (swing === "clear") {
      reasoning.push(
        bias === "bullish"
          ? "Clean HH/HL progression — bullish structure is intact."
          : bias === "bearish"
            ? "Clean LH/LL progression — bearish structure is intact."
            : "Clean swing progression visible.",
      );
    }
    if (momentum === "strong") {
      reasoning.push("Momentum reads strong — full‑body candles with follow‑through.");
    }
    if (overlap === "low") {
      reasoning.push("Low candle overlap — each leg is doing structural work.");
    }
    if (reasoning.length === 0) {
      reasoning.push("Structure and momentum align with a directional regime.");
    }
  }

  return {
    label,
    bias,
    clarity,
    reasoning,
    signals: {
      candle_overlap: overlap,
      swing_progression: swing,
      direction_flips: flips,
    },
  };
}
