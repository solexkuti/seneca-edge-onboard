// Deterministic rule check for the Chart Analyzer.
// Maps AI-extracted chart features against the user's strategy rules using
// keyword matching. AI never decides validity — this file does.

import type { StructuredRules } from "@/lib/dbStrategyBlueprints";

// Citation: a normalized rectangle on a chart image (0–1 coords).
// `chart` selects which image the box belongs to.
// `kind` is the semantic feature label so the UI can color/label it.
export type ChartRegion = {
  chart: "exec" | "higher";
  kind: "bos" | "sweep" | "key_zone" | "stop_tp" | "trend";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ChartFeatures = {
  trend?: "uptrend" | "downtrend" | "ranging" | "unclear";
  structure?: "break_of_structure" | "consolidation" | "none" | "unclear";
  liquidity?: "above_highs" | "below_lows" | "both" | "none" | "unclear";
  volatility?: "high" | "normal" | "low" | "unclear";
  quality?: "clear" | "messy" | "unclear";
  // Optional AI-supplied citations on this chart image.
  regions?: ChartRegion[];
};

export type ChartFeaturesPair = {
  exec: ChartFeatures;
  higher?: ChartFeatures | null;
};

export type RuleCheck = {
  rule: string; // the user's actual strategy rule text (or a synthetic label)
  passed: boolean;
  reason: string;
  // Optional citations into the chart image(s) backing this check.
  regions?: ChartRegion[];
};

export type SectionResult = {
  passed: boolean;
  reasons: string[];
  checks: RuleCheck[]; // per-rule breakdown referencing strategy rules
};


export type RuleBreakdown = {
  entry: SectionResult;
  structure: SectionResult;
  risk: SectionResult;
  timing: SectionResult;
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

// Pull regions of given kinds from a chart, tagging the chart label so the UI
// knows which preview to overlay.
function pickRegions(
  f: ChartFeatures,
  chart: "exec" | "higher",
  kinds: ChartRegion["kind"][],
): ChartRegion[] {
  const all = f.regions ?? [];
  return all
    .filter((r) => kinds.includes(r.kind))
    .map((r) => ({ ...r, chart }));
}

function entryCheck(rules: string[], f: ChartFeatures): SectionResult {
  if (rules.length === 0) {
    return {
      passed: true,
      reasons: ["No entry rules defined"],
      checks: [
        { rule: "No entry rules defined", passed: true, reason: "Nothing to evaluate" },
      ],
    };
  }
  const checks: RuleCheck[] = [];
  for (const r of rules) {
    const t = lc(r);
    let passed = true;
    const subReasons: string[] = [];
    const kinds: ChartRegion["kind"][] = [];

    if (t.includes("bos") || t.includes("break of structure")) {
      kinds.push("bos");
      if (f.structure !== "break_of_structure") {
        passed = false;
        subReasons.push(
          `Needs Break of Structure — chart shows ${f.structure ?? "unknown"}`,
        );
      } else {
        subReasons.push("Break of Structure visible on chart");
      }
    }
    if (t.includes("retest")) {
      kinds.push("key_zone");
      if (f.structure !== "consolidation" && f.structure !== "break_of_structure") {
        passed = false;
        subReasons.push("Retest condition not visible");
      } else {
        subReasons.push("Retest condition plausible");
      }
    }
    if (t.includes("liquidity") || t.includes("sweep")) {
      kinds.push("sweep");
      if (f.liquidity === "none" || f.liquidity === "unclear") {
        passed = false;
        subReasons.push("Liquidity sweep not visible");
      } else {
        subReasons.push("Liquidity condition visible");
      }
    }

    const regions = kinds.length ? pickRegions(f, "exec", kinds) : undefined;

    if (subReasons.length === 0) {
      // No keyword hit — can't deterministically verify from chart alone.
      checks.push({
        rule: r,
        passed: true,
        reason: "Not directly observable on chart — confirm manually",
      });
    } else {
      checks.push({ rule: r, passed, reason: subReasons.join("; "), regions });
    }
  }
  const passed = checks.every((c) => c.passed);
  const reasons = checks.map((c) => `${c.passed ? "✓" : "✗"} ${c.rule} — ${c.reason}`);
  return { passed, reasons, checks };
}

function structureCheck(f: ChartFeatures): SectionResult {
  const structureRegions = pickRegions(f, "exec", ["bos", "key_zone"]);
  const checks: RuleCheck[] = [
    {
      rule: "Chart structure must be readable",
      passed: !(f.quality === "messy" || f.quality === "unclear"),
      reason:
        f.quality === "messy" || f.quality === "unclear"
          ? `Chart quality is ${f.quality}`
          : "Chart quality is clear",
    },
    {
      rule: "Visible market structure on execution timeframe",
      passed: f.structure !== "none" && f.structure !== "unclear",
      reason:
        f.structure === "none"
          ? "No clear structure detected"
          : f.structure === "unclear"
            ? "Structure unclear"
            : `Structure: ${f.structure}`,
      regions: structureRegions.length ? structureRegions : undefined,
    },
  ];
  const passed = checks.every((c) => c.passed);
  const reasons = checks.map((c) => `${c.passed ? "✓" : "✗"} ${c.rule} — ${c.reason}`);
  return { passed, reasons, checks };
}

function riskCheck(rules: string[], f: ChartFeatures): SectionResult {
  if (rules.length === 0) {
    const c: RuleCheck = {
      rule: "No explicit risk rules defined",
      passed: true,
      reason: "Confirm SL/TP placement manually",
    };
    return { passed: true, reasons: [`✓ ${c.rule} — ${c.reason}`], checks: [c] };
  }
  const checks: RuleCheck[] = rules.map((r) => {
    if (f.volatility === "high") {
      return {
        rule: r,
        passed: false,
        reason: "High volatility — recheck stop placement against this rule",
      };
    }
    return {
      rule: r,
      passed: true,
      reason: "Volatility looks normal — risk plausible from chart",
    };
  });
  const passed = checks.every((c) => c.passed);
  const reasons = checks.map((c) => `${c.passed ? "✓" : "✗"} ${c.rule} — ${c.reason}`);
  return { passed, reasons, checks };
}

function timingCheck(
  exec: ChartFeatures,
  higher?: ChartFeatures | null,
): SectionResult {
  if (!higher) {
    const c: RuleCheck = {
      rule: "Higher timeframe alignment",
      passed: true,
      reason: "No higher timeframe provided — alignment not enforced",
    };
    return { passed: true, reasons: [`✓ ${c.rule} — ${c.reason}`], checks: [c] };
  }
  const checks: RuleCheck[] = [];
  const trendClear = exec.trend !== "unclear" && higher.trend !== "unclear";
  checks.push({
    rule: "Trend must be readable on both timeframes",
    passed: trendClear,
    reason: trendClear
      ? `Exec ${exec.trend}, higher ${higher.trend}`
      : "Trend unclear on one of the timeframes",
  });
  const conflict =
    (exec.trend === "uptrend" && higher.trend === "downtrend") ||
    (exec.trend === "downtrend" && higher.trend === "uptrend");
  checks.push({
    rule: "Execution trend aligned with higher timeframe",
    passed: trendClear && !conflict,
    reason: !trendClear
      ? "Cannot confirm — trend unclear"
      : conflict
        ? `Mismatched: exec ${exec.trend} vs higher ${higher.trend}`
        : `Aligned: ${exec.trend} on both timeframes`,
  });
  const passed = checks.every((c) => c.passed);
  const reasons = checks.map((c) => `${c.passed ? "✓" : "✗"} ${c.rule} — ${c.reason}`);
  return { passed, reasons, checks };
}

export function evaluateChartAgainstStrategy(
  features: ChartFeaturesPair,
  rules: StructuredRules,
  chartConfidence = 100,
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

  // Confidence handling — never upgrade to "valid" when inputs are unclear.
  const conf = isLowConfidence(features, chartConfidence);
  if (conf.low && overall === "valid") overall = "weak";

  return {
    entry,
    structure,
    risk,
    timing,
    overall,
    score,
    low_confidence: conf.low,
    confidence_note: conf.note,
  };
}
