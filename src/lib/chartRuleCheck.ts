// Deterministic rule check for the Chart Analyzer.
// Maps AI-extracted chart features against the user's strategy rules using
// keyword matching. AI never decides validity — this file does.

import type { StructuredRules } from "@/lib/dbStrategyBlueprints";

export type ChartFeatures = {
  trend?: "uptrend" | "downtrend" | "ranging" | "unclear";
  structure?: "break_of_structure" | "consolidation" | "none" | "unclear";
  liquidity?: "above_highs" | "below_lows" | "both" | "none" | "unclear";
  volatility?: "high" | "normal" | "low" | "unclear";
  quality?: "clear" | "messy" | "unclear";
};

export type ChartFeaturesPair = {
  exec: ChartFeatures;
  higher?: ChartFeatures | null;
};

export type RuleBreakdown = {
  entry: { passed: boolean; reasons: string[] };
  structure: { passed: boolean; reasons: string[] };
  risk: { passed: boolean; reasons: string[] };
  timing: { passed: boolean; reasons: string[] };
  overall: "valid" | "weak" | "invalid";
  score: number; // 0-100
  low_confidence: boolean;
  confidence_note?: string;
};

// Detect low-confidence inputs that should force a downgrade.
export function isLowConfidence(
  features: ChartFeaturesPair,
  chartConfidence: number,
): { low: boolean; note?: string } {
  if (chartConfidence > 0 && chartConfidence < 70) {
    return { low: true, note: "Chart validation confidence is low." };
  }
  const exec = features.exec ?? {};
  const unclearFields = (Object.values(exec) as string[]).filter(
    (v) => v === "unclear",
  ).length;
  if (exec.quality === "messy" || exec.quality === "unclear" || unclearFields >= 2) {
    return { low: true, note: "Analysis confidence is low due to unclear chart structure." };
  }
  return { low: false };
}

const lc = (s: string) => s.toLowerCase();

function entryCheck(rules: string[], f: ChartFeatures): { passed: boolean; reasons: string[] } {
  if (rules.length === 0) return { passed: true, reasons: ["No entry rules defined"] };
  const reasons: string[] = [];
  let pass = true;
  for (const r of rules) {
    const t = lc(r);
    if (t.includes("bos") || t.includes("break of structure")) {
      if (f.structure !== "break_of_structure") {
        pass = false;
        reasons.push(`Entry needs Break of Structure — chart shows ${f.structure ?? "unknown"}`);
      } else reasons.push("Break of Structure visible");
    }
    if (t.includes("retest")) {
      if (f.structure !== "consolidation" && f.structure !== "break_of_structure") {
        pass = false;
        reasons.push("Retest condition not visible");
      }
    }
    if (t.includes("liquidity") || t.includes("sweep")) {
      if (f.liquidity === "none" || f.liquidity === "unclear") {
        pass = false;
        reasons.push("Liquidity condition not visible");
      }
    }
  }
  if (reasons.length === 0) reasons.push("Entry rules not directly observable on chart");
  return { passed: pass, reasons };
}

function structureCheck(f: ChartFeatures): { passed: boolean; reasons: string[] } {
  if (f.quality === "messy" || f.quality === "unclear") {
    return { passed: false, reasons: ["Chart structure is unclear or messy"] };
  }
  if (f.structure === "none") {
    return { passed: false, reasons: ["No clear structure on the execution timeframe"] };
  }
  return { passed: true, reasons: ["Structure is readable"] };
}

function riskCheck(rules: string[], f: ChartFeatures): { passed: boolean; reasons: string[] } {
  if (rules.length === 0) {
    return { passed: true, reasons: ["No explicit risk rules — confirm SL/TP manually"] };
  }
  if (f.volatility === "high") {
    return {
      passed: false,
      reasons: ["High volatility — recheck stop placement against risk rule"],
    };
  }
  return { passed: true, reasons: ["Risk conditions plausible from chart"] };
}

function timingCheck(
  exec: ChartFeatures,
  higher?: ChartFeatures | null,
): { passed: boolean; reasons: string[] } {
  if (!higher) {
    return {
      passed: true,
      reasons: ["No higher timeframe provided — alignment not enforced"],
    };
  }
  if (exec.trend === "unclear" || higher.trend === "unclear") {
    return { passed: false, reasons: ["Trend unclear on one of the timeframes"] };
  }
  if (
    (exec.trend === "uptrend" && higher.trend === "downtrend") ||
    (exec.trend === "downtrend" && higher.trend === "uptrend")
  ) {
    return {
      passed: false,
      reasons: [`Timeframes mismatched: exec ${exec.trend} vs higher ${higher.trend}`],
    };
  }
  return { passed: true, reasons: [`Aligned: ${exec.trend} on both timeframes`] };
}

export function evaluateChartAgainstStrategy(
  features: ChartFeaturesPair,
  rules: StructuredRules,
): RuleBreakdown {
  const exec = features.exec ?? {};
  const higher = features.higher ?? null;

  const entryRules = [...(rules.entry ?? []), ...(rules.confirmation ?? [])];
  const riskRules = rules.risk ?? [];

  const entry = entryCheck(entryRules, exec);
  const structure = structureCheck(exec);
  const risk = riskCheck(riskRules, exec);
  const timing = timingCheck(exec, higher);

  const passes = [entry, structure, risk, timing].filter((c) => c.passed).length;
  const score = passes * 25;
  let overall: "valid" | "weak" | "invalid";
  if (score >= 100) overall = "valid";
  else if (score >= 50) overall = "weak";
  else overall = "invalid";

  return { entry, structure, risk, timing, overall, score };
}
