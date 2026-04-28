// ============================================================================
// Deterministic Rule Engine
// ----------------------------------------------------------------------------
// This module is the SINGLE source of truth for trade validation.
// It is intentionally pure, synchronous, and free of any AI / network calls.
//
// CRITICAL CONSTRAINT:
// AI must NEVER:
//   - modify rule results
//   - influence scoring
//   - override validation
//   - infer missing confirmations
//
// The AI layer (see `ruleExplain.ts`) consumes the *output* of this engine
// for human-readable text only. It cannot import or mutate anything here
// in a way that changes a result.
// ============================================================================

export type RuleType = "entry" | "exit" | "risk" | "behavior";

export type EvaluationType = "boolean" | "range" | "sequence";

/**
 * A single structured rule, stored exactly as defined by the user
 * in the Strategy Builder. `result` is filled at evaluation time by the
 * deterministic engine — never by the AI.
 */
export type StructuredRule = {
  id: string;
  type: RuleType;
  condition: string;
  evaluation_type: EvaluationType;
  /** Filled by the engine when evaluating a trade. */
  result: boolean;
};

/**
 * The four fixed categories. Each category contributes exactly 25 points,
 * giving a maximum total of 100. Categories are aggregated as logical AND:
 * a category passes only when ALL its rules pass.
 */
export const RULE_CATEGORIES: readonly RuleType[] = [
  "entry",
  "exit",
  "risk",
  "behavior",
] as const;

export const POINTS_PER_CATEGORY = 25;
export const MAX_SCORE = POINTS_PER_CATEGORY * RULE_CATEGORIES.length; // 100

export type DisciplineClass = "fully_disciplined" | "mostly_disciplined" | "undisciplined";

export type Tier = "A+" | "B+" | "C" | "F";

export type ValidationOutput = {
  valid: boolean;
  score: number;
  tier: Tier;
  violations: string[];
  /** Per-category pass/fail snapshot for UI rendering. */
  categories: Record<RuleType, { passed: boolean; rules: StructuredRule[] }>;
  discipline: DisciplineClass;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Aggregate per-category result: a category passes iff every rule in it passes. */
export function categoryPassed(rules: StructuredRule[]): boolean {
  if (rules.length === 0) return true; // no rules defined → vacuously satisfied
  return rules.every((r) => r.result === true);
}

/** Pure deterministic score. Sum of 25 per fully-passing category. */
export function computeScore(rules: StructuredRule[]): number {
  let score = 0;
  for (const cat of RULE_CATEGORIES) {
    const subset = rules.filter((r) => r.type === cat);
    if (categoryPassed(subset)) score += POINTS_PER_CATEGORY;
  }
  return score;
}

export function classifyDiscipline(score: number): DisciplineClass {
  if (score >= 100) return "fully_disciplined";
  if (score >= 75) return "mostly_disciplined";
  return "undisciplined";
}

/**
 * Tier system (deterministic):
 *   A+  → all 4 categories pass
 *   B+  → exactly 1 category fails
 *   C   → exactly 2 categories fail (minimum threshold)
 *   F   → 3 or more categories fail (below minimum)
 */
export function computeTier(rules: StructuredRule[]): Tier {
  const failingCategories = RULE_CATEGORIES.filter(
    (cat) => !categoryPassed(rules.filter((r) => r.type === cat)),
  ).length;
  if (failingCategories === 0) return "A+";
  if (failingCategories === 1) return "B+";
  if (failingCategories === 2) return "C";
  return "F";
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a trade against its evaluated rules.
 * `rules` MUST already have `result` filled — this engine does not infer.
 *
 * Throws if any rule has a non-boolean result (failsafe against AI mutation).
 */
export function validateTrade(rules: StructuredRule[]): ValidationOutput {
  // Failsafe: every rule MUST have an explicit boolean result.
  for (const r of rules) {
    if (typeof r.result !== "boolean") {
      throw new Error(
        `Rule "${r.id}" has no boolean result. AI cannot infer missing confirmations.`,
      );
    }
  }

  const categories = {} as ValidationOutput["categories"];
  const violations: string[] = [];

  for (const cat of RULE_CATEGORIES) {
    const subset = rules.filter((r) => r.type === cat);
    const passed = categoryPassed(subset);
    categories[cat] = { passed, rules: subset };
    if (!passed) {
      for (const r of subset) {
        if (!r.result) violations.push(`${cat}: ${r.condition}`);
      }
    }
  }

  const score = computeScore(rules);
  const tier = computeTier(rules);
  const discipline = classifyDiscipline(score);

  return {
    valid: violations.length === 0,
    score,
    tier,
    violations,
    categories,
    discipline,
  };
}

// ---------------------------------------------------------------------------
// Failsafe: completeness check (used before evaluation)
// ---------------------------------------------------------------------------

export type CompletenessIssue = {
  area: RuleType | "general";
  reason: string;
};

/**
 * Verifies the rule set is well-formed enough to be enforced.
 * If this returns issues, the system MUST block execution and request
 * AI-assisted clarification (see `ruleExplain.ts`).
 */
export function checkCompleteness(rules: StructuredRule[]): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  if (rules.length === 0) {
    issues.push({ area: "general", reason: "No rules defined." });
    return issues;
  }
  for (const cat of RULE_CATEGORIES) {
    const subset = rules.filter((r) => r.type === cat);
    if (subset.length === 0) {
      issues.push({ area: cat, reason: `No ${cat} rule defined.` });
    } else {
      for (const r of subset) {
        if (!r.condition || r.condition.trim().length < 4) {
          issues.push({ area: cat, reason: `Rule "${r.id}" condition is too vague.` });
        }
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a checklist template from a rule set. Each rule starts with
 * `result: false` so the user must explicitly confirm each one.
 * The engine never auto-confirms.
 */
export function buildChecklist(rules: Omit<StructuredRule, "result">[]): StructuredRule[] {
  return rules.map((r) => ({ ...r, result: false }));
}

/** Apply a partial set of confirmations by rule id. Pure. */
export function applyConfirmations(
  rules: StructuredRule[],
  confirmations: Record<string, boolean>,
): StructuredRule[] {
  return rules.map((r) =>
    Object.prototype.hasOwnProperty.call(confirmations, r.id)
      ? { ...r, result: !!confirmations[r.id] }
      : r,
  );
}
