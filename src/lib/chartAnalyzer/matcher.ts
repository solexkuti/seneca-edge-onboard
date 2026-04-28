// ============================================================================
// Deterministic Rule Matching Engine
// ----------------------------------------------------------------------------
// Compares AI-extracted structured observations against the strategy's
// strict JSON rules. Pure functions only — no AI, no randomness, no I/O.
// AI cannot influence anything in this file.
// ============================================================================

import type {
  AnalyzerStrategy,
  EntryRule,
  ConfirmationRule,
  RiskRule,
  BehaviorRule,
  Validation,
  PatternKey,
  LevelKey,
  SequenceKey,
} from "./schema";
import type { DualExtraction, StructuredExtraction } from "./extraction";

export type RuleResult = {
  rule_id: string;
  passed: boolean;
  evidence: string;
};

export type AnalyzerOutput = {
  valid: boolean;
  score: number; // 0..100
  tier: "A" | "B" | "C";
  summary: string;
  breakdown: Array<{
    rule_id: string;
    result: "pass" | "fail";
    explanation: string;
  }>;
  warnings: string[];
};

export type UserInputs = {
  /** Risk planned by the trader for this trade, as percent of account. */
  risk_percent: number;
  /** Behaviour confirmations keyed by rule id, set by the user. */
  behavior: Record<string, boolean>;
};

// ---------------------------------------------------------------------------
// Per-validator evaluators (deterministic, side-effect free)
// ---------------------------------------------------------------------------

function evalPattern(pattern: PatternKey, ext: StructuredExtraction): { ok: boolean; ev: string } {
  switch (pattern) {
    case "engulfing":
      return { ok: ext.price_action.engulfing, ev: ext.notes?.engulfing ?? "engulfing pattern" };
    case "rejection":
      return { ok: ext.price_action.rejection, ev: ext.notes?.rejection ?? "rejection wick" };
    case "consolidation":
      return {
        ok: ext.price_action.consolidation,
        ev: ext.notes?.consolidation ?? "consolidation",
      };
    case "break_of_structure":
      return {
        ok: ext.structure.break_of_structure,
        ev: ext.notes?.break_of_structure ?? "break of structure",
      };
    case "liquidity_sweep":
      return {
        ok: ext.structure.liquidity_sweep,
        ev: ext.notes?.liquidity_sweep ?? "liquidity sweep",
      };
  }
}

function evalLevel(level: LevelKey, ext: StructuredExtraction): { ok: boolean; ev: string } {
  if (level === "fibonacci")
    return {
      ok: ext.levels.fibonacci_detected,
      ev: ext.notes?.fibonacci_detected ?? "fib zone present",
    };
  return {
    ok: ext.levels.key_levels.length > 0,
    ev: `${ext.levels.key_levels.length} key level(s) detected`,
  };
}

function evalSequence(seq: SequenceKey, ext: StructuredExtraction): { ok: boolean; ev: string } {
  if (seq === "trend_then_bos") {
    const ok = ext.structure.trend !== "range" && ext.structure.break_of_structure;
    return { ok, ev: `${ext.structure.trend} trend + BOS=${ext.structure.break_of_structure}` };
  }
  // sweep_then_rejection
  const ok = ext.structure.liquidity_sweep && ext.price_action.rejection;
  return { ok, ev: `sweep=${ext.structure.liquidity_sweep}, rejection=${ext.price_action.rejection}` };
}

function evalRule(
  validation: Validation,
  exec: StructuredExtraction,
  higher: StructuredExtraction,
  user: UserInputs,
  ruleId: string,
): RuleResult {
  switch (validation.method) {
    case "pattern_detect": {
      // Patterns are evaluated on the EXECUTION timeframe.
      const r = evalPattern(validation.params.pattern, exec);
      return { rule_id: ruleId, passed: r.ok, evidence: `[exec] ${r.ev}` };
    }
    case "level_match": {
      // Levels can satisfy from either timeframe; higher timeframe preferred.
      const h = evalLevel(validation.params.level, higher);
      if (h.ok) return { rule_id: ruleId, passed: true, evidence: `[higher] ${h.ev}` };
      const e = evalLevel(validation.params.level, exec);
      return { rule_id: ruleId, passed: e.ok, evidence: `[exec] ${e.ev}` };
    }
    case "sequence_check": {
      // Sequences require alignment between higher timeframe context and execution.
      const h = evalSequence(validation.params.sequence, higher);
      const e = evalSequence(validation.params.sequence, exec);
      const ok = h.ok && e.ok;
      return {
        rule_id: ruleId,
        passed: ok,
        evidence: ok ? `aligned: ${h.ev} & ${e.ev}` : `not aligned: higher=${h.ev}; exec=${e.ev}`,
      };
    }
    case "numeric_check": {
      const ok = user.risk_percent <= validation.params.max_risk_percent;
      return {
        rule_id: ruleId,
        passed: ok,
        evidence: `risk=${user.risk_percent}% vs max ${validation.params.max_risk_percent}%`,
      };
    }
    case "user_input_check": {
      const ok = !!user.behavior[ruleId];
      return {
        rule_id: ruleId,
        passed: ok,
        evidence: ok ? "user confirmed" : "user did not confirm",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Main analyzer entry
// ---------------------------------------------------------------------------

export function analyzeAgainstStrategy(
  strategy: AnalyzerStrategy,
  extraction: DualExtraction,
  user: UserInputs,
): AnalyzerOutput {
  const allRules: Array<EntryRule | ConfirmationRule | RiskRule | BehaviorRule> = [
    ...strategy.rules.entry,
    ...strategy.rules.confirmation,
    ...strategy.rules.risk,
    ...strategy.rules.behavior,
  ];

  const required = allRules.filter((r) => r.required);
  if (required.length === 0) {
    return {
      valid: false,
      score: 0,
      tier: "C",
      summary: "Strategy has no required rules. Cannot evaluate.",
      breakdown: [],
      warnings: ["No required rules defined."],
    };
  }

  const results = required.map((r) =>
    evalRule(r.validation, extraction.execution, extraction.higher, user, r.id),
  );

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const score = Math.round((passed / total) * 100);
  const failures = total - passed;

  // Tier classification (deterministic):
  //   A → all rules passed
  //   B → 1 failure allowed
  //   C → at or above min_score threshold (default 50)
  let tier: "A" | "B" | "C";
  if (failures === 0) tier = "A";
  else if (failures <= strategy.tiers.B.allowed_failures) tier = "B";
  else tier = "C";

  const valid = score >= strategy.tiers.C.min_score;

  const labelById = new Map(allRules.map((r) => [r.id, r.label] as const));
  const breakdown = results.map((r) => ({
    rule_id: r.rule_id,
    result: (r.passed ? "pass" : "fail") as "pass" | "fail",
    explanation: `${labelById.get(r.rule_id) ?? r.rule_id} — ${r.evidence}`,
  }));

  const warnings: string[] = [];
  if (!valid) warnings.push(`Score ${score} is below the minimum tier threshold (${strategy.tiers.C.min_score}).`);
  if (failures > 0)
    warnings.push(
      `${failures} of ${total} required rule(s) failed. Re-evaluate before taking the trade.`,
    );

  const summary = `Tier ${tier} — ${passed}/${total} required rules passed (${score}/100).`;

  return { valid, score, tier, summary, breakdown, warnings };
}
