// =============================================================================
// Strategy Alignment — per-rule pass/fail/N-A matching against the canonical
// strategy. This is the *new* analyzer evaluation layer (Phase: Chart Analyzer
// redesign). Lives alongside legacy chartRuleCheck for back-compat with the
// stored breakdown shape, but the result UI consumes this exclusively.
//
// Hard rules:
//  - Deterministic. AI never decides pass/fail here.
//  - Rules that the chart cannot observe → "not_applicable" (NOT auto-pass).
//  - Verdict is descriptive (Aligned / Partially Aligned / Not Aligned),
//    never an order to act.
// =============================================================================

import type { CanonicalStrategy, CanonicalRule } from "./strategySchema";
import type { ChartFeaturesPair, ChartFeatures, ChartRegion } from "./chartRuleCheck";

export type AlignmentStatus = "passed" | "failed" | "not_applicable";

export type RuleAlignment = {
  rule_id: string;
  category: CanonicalRule["category"];
  condition: string;
  tier: CanonicalRule["tier"];
  status: AlignmentStatus;
  reason: string;
  regions?: ChartRegion[];
};

export type StrategyAlignment = {
  rules: RuleAlignment[];
  passed: RuleAlignment[];
  failed: RuleAlignment[];
  not_applicable: RuleAlignment[];
  /** % match — passed / (passed + failed). N/A excluded. */
  match_pct: number;
  /** Weighted score 0–100 used to derive the trade grade. */
  weighted_score: number;
  grade: "A+" | "B+" | "C+";
  verdict: "aligned" | "partially_aligned" | "not_aligned";
  insight: string;
  behavioral_note: string | null;
};

const lc = (s: string) => s.toLowerCase();

/**
 * Tier weights for the weighted score.
 * "c" rules are must-haves → highest weight.
 */
const TIER_WEIGHT: Record<CanonicalRule["tier"], number> = {
  c: 3,
  b_plus: 2,
  a_plus: 1,
};

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

/**
 * Decide pass/fail/NA for a single canonical rule against the chart features.
 * Each category has its own observability heuristics.
 */
function evaluateRule(
  rule: CanonicalRule,
  exec: ChartFeatures,
  higher: ChartFeatures | null,
): RuleAlignment {
  const t = lc(rule.condition);
  const base: Omit<RuleAlignment, "status" | "reason" | "regions"> = {
    rule_id: rule.id,
    category: rule.category,
    condition: rule.condition,
    tier: rule.tier,
  };

  // ── ENTRY / CONFIRMATION ────────────────────────────────────────────────
  if (rule.category === "entry" || rule.category === "confirmation") {
    const kinds: ChartRegion["kind"][] = [];
    if (t.includes("bos") || t.includes("break of structure")) {
      kinds.push("bos");
      const passed = exec.structure === "break_of_structure";
      return {
        ...base,
        status: passed ? "passed" : "failed",
        reason: passed
          ? "Break of structure visible on chart."
          : `Break of structure required — chart shows ${exec.structure ?? "no clear structure"}.`,
        regions: kinds.length ? pickRegions(exec, "exec", kinds) : undefined,
      };
    }
    if (t.includes("liquidity") || t.includes("sweep")) {
      kinds.push("sweep");
      const passed = exec.liquidity && exec.liquidity !== "none" && exec.liquidity !== "unclear";
      return {
        ...base,
        status: passed ? "passed" : "failed",
        reason: passed
          ? "Liquidity sweep visible on chart."
          : "No liquidity sweep visible on chart.",
        regions: kinds.length ? pickRegions(exec, "exec", kinds) : undefined,
      };
    }
    if (t.includes("retest") || t.includes("pullback")) {
      kinds.push("key_zone");
      const passed =
        exec.structure === "consolidation" ||
        exec.structure === "break_of_structure";
      return {
        ...base,
        status: passed ? "passed" : "failed",
        reason: passed
          ? "Retest/pullback context plausible from chart."
          : "Retest/pullback condition not visible.",
        regions: kinds.length ? pickRegions(exec, "exec", kinds) : undefined,
      };
    }
    if (
      t.includes("trend") ||
      t.includes("uptrend") ||
      t.includes("downtrend") ||
      t.includes("bullish") ||
      t.includes("bearish")
    ) {
      kinds.push("trend");
      const trend = exec.trend ?? "unclear";
      const wantUp = t.includes("uptrend") || t.includes("bullish");
      const wantDown = t.includes("downtrend") || t.includes("bearish");
      let passed = trend !== "unclear";
      if (wantUp) passed = trend === "uptrend";
      if (wantDown) passed = trend === "downtrend";
      return {
        ...base,
        status: passed ? "passed" : "failed",
        reason: passed
          ? `Trend reads as ${trend}.`
          : `Required trend not present — chart trend is ${trend}.`,
        regions: kinds.length ? pickRegions(exec, "exec", kinds) : undefined,
      };
    }
    // Confirmation candles, indicator triggers, etc. — not observable from a
    // static screenshot. Mark as N/A so the user sees it was not auto-passed.
    return {
      ...base,
      status: "not_applicable",
      reason: "Not directly observable from a static chart — confirm manually.",
    };
  }

  // ── INVALIDATION ────────────────────────────────────────────────────────
  if (rule.category === "invalidation") {
    if (t.includes("structure") || t.includes("bos")) {
      const passed =
        exec.structure !== "none" && exec.structure !== "unclear";
      return {
        ...base,
        status: passed ? "passed" : "failed",
        reason: passed
          ? "Structure clear enough to define invalidation."
          : "Structure unclear — invalidation level cannot be defined.",
      };
    }
    return {
      ...base,
      status: "not_applicable",
      reason: "Invalidation level needs to be set manually on the chart.",
    };
  }

  // ── RISK ────────────────────────────────────────────────────────────────
  if (rule.category === "risk") {
    if (t.includes("volatil")) {
      const passed = exec.volatility === "normal" || exec.volatility === "low";
      return {
        ...base,
        status: passed ? "passed" : "failed",
        reason: passed
          ? "Volatility within acceptable range."
          : "Volatility elevated — recheck stop placement.",
      };
    }
    // Risk-per-trade %, RR ratios, position sizing — numeric rules a chart
    // image cannot verify. N/A by design.
    return {
      ...base,
      status: "not_applicable",
      reason: "Numeric risk rule — verify on your trade ticket, not the chart.",
    };
  }

  // ── CONTEXT (sessions, days, news) ──────────────────────────────────────
  if (rule.category === "context") {
    if (higher && (t.includes("higher") || t.includes("htf") || t.includes("alignment"))) {
      const conflict =
        (exec.trend === "uptrend" && higher.trend === "downtrend") ||
        (exec.trend === "downtrend" && higher.trend === "uptrend");
      const trendClear = exec.trend !== "unclear" && higher.trend !== "unclear";
      const passed = trendClear && !conflict;
      return {
        ...base,
        status: passed ? "passed" : "failed",
        reason: !trendClear
          ? "Trend unclear on one of the timeframes."
          : conflict
            ? `Mismatched: exec ${exec.trend} vs higher ${higher.trend}.`
            : `Aligned: ${exec.trend} on both timeframes.`,
      };
    }
    return {
      ...base,
      status: "not_applicable",
      reason: "Context rule (session/news) — verify outside the chart.",
    };
  }

  // ── BEHAVIOR ────────────────────────────────────────────────────────────
  return {
    ...base,
    status: "not_applicable",
    reason: "Behavioral rule — only you can confirm this.",
  };
}

function gradeFor(score: number): "A+" | "B+" | "C+" {
  if (score >= 80) return "A+";
  if (score >= 55) return "B+";
  return "C+";
}

function verdictFor(score: number): "aligned" | "partially_aligned" | "not_aligned" {
  if (score >= 80) return "aligned";
  if (score >= 50) return "partially_aligned";
  return "not_aligned";
}

function buildInsight(a: {
  passed: RuleAlignment[];
  failed: RuleAlignment[];
  notApplicable: RuleAlignment[];
  verdict: "aligned" | "partially_aligned" | "not_aligned";
}): string {
  const { passed, failed, verdict } = a;
  if (verdict === "aligned" && failed.length === 0) {
    const top = passed.slice(0, 2).map((r) => r.condition).join(" · ");
    return `Setup matches your defined system. Strongest alignments: ${top || "—"}.`;
  }
  if (verdict === "not_aligned") {
    const broken = failed.slice(0, 2).map((r) => r.condition).join("; ");
    return broken
      ? `Setup does not align with your system. Key conflicts: ${broken}.`
      : "Setup does not align with your system.";
  }
  const broken = failed.slice(0, 2).map((r) => r.condition).join("; ");
  return broken
    ? `Setup partially aligns. Outstanding conditions: ${broken}.`
    : "Setup partially aligns. Some conditions could not be verified from the chart.";
}

function buildBehavioralNote(failed: RuleAlignment[]): string | null {
  const cats = new Set(failed.map((r) => r.category));
  if (cats.has("confirmation")) {
    return "This setup lacks confirmation conditions defined in your strategy.";
  }
  if (cats.has("entry")) {
    return "Core entry conditions from your strategy are not present.";
  }
  if (cats.has("invalidation")) {
    return "Invalidation level is not clearly defined for this setup.";
  }
  if (cats.has("context")) {
    return "Context conditions (e.g. higher-timeframe alignment) are not satisfied.";
  }
  return null;
}

export function evaluateAlignment(
  canonical: CanonicalStrategy,
  features: ChartFeaturesPair,
): StrategyAlignment {
  const exec = features.exec ?? {};
  const higher = features.higher ?? null;

  const rules = canonical.rules.map((r) => evaluateRule(r, exec, higher));

  const passed = rules.filter((r) => r.status === "passed");
  const failed = rules.filter((r) => r.status === "failed");
  const notApplicable = rules.filter((r) => r.status === "not_applicable");

  const total = passed.length + failed.length;
  const match_pct = total === 0 ? 0 : Math.round((passed.length / total) * 100);

  // Weighted score (0–100). Each rule contributes its tier weight when passed
  // and zero when failed. N/A rules are excluded from both numerator and
  // denominator so a strategy of mostly-unobservable rules can't auto-grade A+.
  let num = 0;
  let den = 0;
  for (const r of [...passed, ...failed]) {
    const w = TIER_WEIGHT[r.tier];
    den += w;
    if (r.status === "passed") num += w;
  }
  const weighted_score = den === 0 ? 0 : Math.round((num / den) * 100);

  const grade = gradeFor(weighted_score);
  const verdict = verdictFor(weighted_score);
  const insight = buildInsight({ passed, failed, notApplicable, verdict });
  const behavioral_note = buildBehavioralNote(failed);

  return {
    rules,
    passed,
    failed,
    not_applicable: notApplicable,
    match_pct,
    weighted_score,
    grade,
    verdict,
    insight,
    behavioral_note,
  };
}

export const VERDICT_LABEL: Record<StrategyAlignment["verdict"], string> = {
  aligned: "Aligned",
  partially_aligned: "Partially Aligned",
  not_aligned: "Not Aligned",
};

export const ANALYZER_DISCLAIMER =
  "This analysis is for informational purposes only and does not constitute financial advice. Market conditions can change, and all trading involves risk.";
