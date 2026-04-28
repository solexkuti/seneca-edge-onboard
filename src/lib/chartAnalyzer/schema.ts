// ============================================================================
// Chart Analyzer — Strategy Schema (MANDATORY JSON SCHEMA)
// ----------------------------------------------------------------------------
// All strategies MUST be converted to this strict JSON shape before they
// can be used by the analyzer. This module is pure types + a builder. No AI.
// ============================================================================

export type AnalyzerTimeframes = {
  execution: string; // e.g. "5m", "15m"
  higher: string;    // e.g. "1h", "4h"
};

export type EntryRuleType = "structure" | "indicator" | "price_action";

export type Validation =
  | { method: "pattern_detect"; params: { pattern: PatternKey } }
  | { method: "level_match"; params: { level: LevelKey } }
  | { method: "sequence_check"; params: { sequence: SequenceKey } }
  | { method: "numeric_check"; params: { max_risk_percent: number } }
  | { method: "user_input_check"; params?: Record<string, never> };

export type PatternKey =
  | "engulfing"
  | "rejection"
  | "consolidation"
  | "break_of_structure"
  | "liquidity_sweep";

export type LevelKey = "fibonacci" | "key_level";

export type SequenceKey = "trend_then_bos" | "sweep_then_rejection";

export type EntryRule = {
  id: string;
  label: string;
  type: EntryRuleType;
  condition: string;
  validation: Validation;
  required: boolean;
};

export type ConfirmationRule = {
  id: string;
  label: string;
  type: "confluence";
  condition: string;
  validation: Validation;
  required: boolean;
};

export type RiskRule = {
  id: string;
  label: string;
  type: "risk";
  condition: string;
  validation: Extract<Validation, { method: "numeric_check" }>;
  required: boolean;
};

export type BehaviorRule = {
  id: string;
  label: string;
  type: "behavior";
  condition: string;
  validation: Extract<Validation, { method: "user_input_check" }>;
  required: boolean;
};

export type AnalyzerStrategy = {
  strategy_id: string;
  name: string;
  timeframes: AnalyzerTimeframes;
  rules: {
    entry: EntryRule[];
    confirmation: ConfirmationRule[];
    risk: RiskRule[];
    behavior: BehaviorRule[];
  };
  tiers: {
    A: { required_rules: "all" };
    B: { allowed_failures: number };
    C: { min_score: number };
  };
};

export const DEFAULT_TIERS: AnalyzerStrategy["tiers"] = {
  A: { required_rules: "all" },
  B: { allowed_failures: 1 },
  C: { min_score: 50 },
};

/**
 * Build a sane default analyzer strategy from a blueprint's category arrays.
 * This is purely mechanical — no AI, no inference of validation methods
 * the user didn't choose. We pick conservative deterministic validators
 * (pattern_detect / level_match) and keep `condition` exactly as written.
 */
export function buildAnalyzerStrategy(input: {
  strategyId: string;
  name: string;
  timeframes: AnalyzerTimeframes;
  entry: string[];
  confirmation: string[];
  risk: string[];
  behavior: string[];
  maxRiskPercent: number;
}): AnalyzerStrategy {
  const entry: EntryRule[] = input.entry.map((cond, i) => ({
    id: `entry-${i + 1}`,
    label: cond,
    type: "structure",
    condition: cond,
    validation: guessEntryValidation(cond),
    required: true,
  }));

  const confirmation: ConfirmationRule[] = input.confirmation.map((cond, i) => ({
    id: `conf-${i + 1}`,
    label: cond,
    type: "confluence",
    condition: cond,
    validation: guessEntryValidation(cond),
    required: true,
  }));

  const risk: RiskRule[] = input.risk.length
    ? input.risk.map((cond, i) => ({
        id: `risk-${i + 1}`,
        label: cond,
        type: "risk",
        condition: cond,
        validation: { method: "numeric_check", params: { max_risk_percent: input.maxRiskPercent } },
        required: true,
      }))
    : [
        {
          id: "risk-default",
          label: `Risk per trade ≤ ${input.maxRiskPercent}%`,
          type: "risk",
          condition: `Risk per trade must not exceed ${input.maxRiskPercent}%`,
          validation: { method: "numeric_check", params: { max_risk_percent: input.maxRiskPercent } },
          required: true,
        },
      ];

  const behavior: BehaviorRule[] = input.behavior.map((cond, i) => ({
    id: `beh-${i + 1}`,
    label: cond,
    type: "behavior",
    condition: cond,
    validation: { method: "user_input_check" },
    required: true,
  }));

  return {
    strategy_id: input.strategyId,
    name: input.name,
    timeframes: input.timeframes,
    rules: { entry, confirmation, risk, behavior },
    tiers: DEFAULT_TIERS,
  };
}

// Cheap, deterministic keyword routing for which extracted observation
// each rule should be matched against. NOT an AI inference — just a lookup.
function guessEntryValidation(condition: string): Validation {
  const c = condition.toLowerCase();
  if (/(fib|fibonacci|retrace|retracement|0\.6|0\.7|golden)/.test(c))
    return { method: "level_match", params: { level: "fibonacci" } };
  if (/(key level|support|resistance|order block|ob|s\/r)/.test(c))
    return { method: "level_match", params: { level: "key_level" } };
  if (/(sweep|liquidity|stop hunt|run on (high|low)s?)/.test(c))
    return { method: "pattern_detect", params: { pattern: "liquidity_sweep" } };
  if (/(bos|break of structure|break.*structure|breakout)/.test(c))
    return { method: "pattern_detect", params: { pattern: "break_of_structure" } };
  if (/(engulf)/.test(c)) return { method: "pattern_detect", params: { pattern: "engulfing" } };
  if (/(reject|wick|pinbar|pin bar)/.test(c))
    return { method: "pattern_detect", params: { pattern: "rejection" } };
  if (/(consolidat|range|tight)/.test(c))
    return { method: "pattern_detect", params: { pattern: "consolidation" } };
  if (/(trend|sweep.*reject|sweep then)/.test(c))
    return { method: "sequence_check", params: { sequence: "sweep_then_rejection" } };
  // Fallback — match against generic BOS so it can still pass when AI sees structure.
  return { method: "pattern_detect", params: { pattern: "break_of_structure" } };
}
