// =============================================================================
// Strategy Schema — Single Source of Truth
// =============================================================================
//
// Phase 3: every output (UI checklist, PDF, Chart Analyzer JSON, summary) is
// derived from ONE canonical view of the blueprint. No per-output formatters,
// no copy-pasted ordering logic. If a rule appears in the canonical schema,
// it appears identically in every export.
//
// Rules of the road:
//  - Order is deterministic: defined by CATEGORY_ORDER below.
//  - Every rule gets a stable, deterministic id (cat_NNN).
//  - Atomicity / contradiction checks live in strategyIntelligence.ts and
//    operate on the same StructuredRulesV2 input — there is no second copy.
// =============================================================================

import type { StrategyBlueprint, ChecklistByTier } from "./dbStrategyBlueprints";
import {
  readRules,
  RULE_CATEGORIES_V2,
  type RuleCategoryV2,
  type StructuredRulesV2,
} from "./strategyIntelligence";
import type { StructuredRule, RuleType } from "./ruleEngine";

/* -------------------------------------------------------------------------- */
/*                              Canonical types                                */
/* -------------------------------------------------------------------------- */

/** Display order — used by UI, PDF, summary. Never reorder ad-hoc. */
export const CATEGORY_ORDER: RuleCategoryV2[] = [
  "context",
  "entry",
  "confirmation",
  "invalidation",
  "risk",
  "behavior",
];

export const CATEGORY_LABELS: Record<RuleCategoryV2, string> = {
  context: "Context",
  entry: "Entry",
  confirmation: "Confirmation",
  invalidation: "Invalidation",
  risk: "Risk",
  behavior: "Behavior",
};

/** Map intelligence categories → 4-category engine type for Chart Analyzer. */
const ENGINE_TYPE: Record<RuleCategoryV2, RuleType> = {
  context: "behavior",
  entry: "entry",
  confirmation: "entry",
  invalidation: "exit",
  risk: "risk",
  behavior: "behavior",
};

export type CanonicalRule = {
  /** Stable id like `entry_001`. Derived from category + index. */
  id: string;
  /** Intelligence-layer category (6 values). */
  category: RuleCategoryV2;
  /** 4-category engine type — what Chart Analyzer consumes. */
  type: RuleType;
  /** Human + machine-readable condition string. */
  condition: string;
  /** Tier this rule appears in (derived from blueprint.tier_strictness). */
  tier: "a_plus" | "b_plus" | "c";
  /** Optional structured params (timeframe, etc) — reserved for future. */
  params?: Record<string, unknown>;
};

export type StrategySummary = {
  name: string;
  account_types: string[];
  risk_profile: {
    risk_per_trade_pct: number | null;
    daily_loss_limit_pct: number | null;
    max_drawdown_pct: number | null;
  };
  /** Trading session(s) extracted from context rules, if present. */
  sessions: string[];
  /** First 3 entry rules + first invalidation, plain text. */
  key_rules: string[];
  behavior_limits: string[];
};

export type CanonicalStrategy = {
  schema_version: 3;
  blueprint_id: string;
  name: string;
  locked: boolean;
  rules: CanonicalRule[];
  /** Checklist derived from rules + tier_strictness. */
  checklist: ChecklistByTier;
  summary: StrategySummary;
  /** A flat machine-readable trading plan, derived in display order. */
  plan_lines: string[];
};

/* -------------------------------------------------------------------------- */
/*                              Builder                                        */
/* -------------------------------------------------------------------------- */

function rulesByCategory(rules: StructuredRulesV2): CanonicalRule[][] {
  // Build full ordered rule list with stable ids and assigned tiers.
  const out: CanonicalRule[][] = [];

  for (const cat of CATEGORY_ORDER) {
    const list = (rules[cat] ?? []).map((c) => c.trim()).filter(Boolean);
    const bucket: CanonicalRule[] = list.map((condition, idx) => ({
      id: `${cat}_${String(idx + 1).padStart(3, "0")}`,
      category: cat,
      type: ENGINE_TYPE[cat],
      condition,
      tier: assignTier(cat, idx, list.length),
    }));
    out.push(bucket);
  }
  return out;
}

/**
 * Tier assignment is deterministic:
 *  - First rule of each critical category (entry, risk, invalidation) → C (must-have).
 *  - Next half → B+.
 *  - Remaining → A+.
 *  - For non-critical (context, behavior), only confirmation appears in A+ unless
 *    user has many rules.
 */
function assignTier(
  cat: RuleCategoryV2,
  idx: number,
  total: number,
): "a_plus" | "b_plus" | "c" {
  const critical = cat === "entry" || cat === "risk" || cat === "invalidation";
  if (total <= 1) return critical ? "c" : "b_plus";
  if (critical) {
    if (idx === 0) return "c";
    if (idx < Math.ceil(total / 2)) return "b_plus";
    return "a_plus";
  }
  // confirmation, context, behavior
  if (idx < Math.ceil(total / 2)) return "b_plus";
  return "a_plus";
}

/** Inclusion rule: tier T includes everything from the lower tiers. */
function includesIn(tier: "a_plus" | "b_plus" | "c", ruleTier: "a_plus" | "b_plus" | "c") {
  if (tier === "c") return ruleTier === "c";
  if (tier === "b_plus") return ruleTier === "c" || ruleTier === "b_plus";
  return true; // a_plus includes everything
}

function buildChecklist(rules: CanonicalRule[]): ChecklistByTier {
  const list = (t: "a_plus" | "b_plus" | "c") =>
    rules.filter((r) => includesIn(t, r.tier)).map((r) => r.condition);
  return {
    a_plus: list("a_plus"),
    b_plus: list("b_plus"),
    c: list("c"),
  };
}

const SESSION_REGEX = /\b(london|new york|ny|tokyo|asia|asian|sydney|frankfurt|pre-?market|premarket|open|close)\b/gi;

function extractSessions(contextRules: string[]): string[] {
  const found = new Set<string>();
  for (const r of contextRules) {
    const m = r.match(SESSION_REGEX);
    if (!m) continue;
    for (const s of m) found.add(s.toLowerCase());
  }
  return Array.from(found);
}

function buildSummary(bp: StrategyBlueprint, rules: StructuredRulesV2): StrategySummary {
  const entry = (rules.entry ?? []).slice(0, 3);
  const invalidation = (rules.invalidation ?? []).slice(0, 1);
  return {
    name: bp.name || "Untitled Strategy",
    account_types: bp.account_types ?? [],
    risk_profile: {
      risk_per_trade_pct: bp.risk_per_trade_pct,
      daily_loss_limit_pct: bp.daily_loss_limit_pct,
      max_drawdown_pct: bp.max_drawdown_pct,
    },
    sessions: extractSessions(rules.context ?? []),
    key_rules: [...entry, ...invalidation],
    behavior_limits: (rules.behavior ?? []).slice(0, 5),
  };
}

function buildPlanLines(bp: StrategyBlueprint, byCat: CanonicalRule[][]): string[] {
  const lines: string[] = [];
  lines.push(bp.name || "Untitled Strategy");
  lines.push("");
  if ((bp.account_types ?? []).length) {
    lines.push(`ACCOUNT: ${bp.account_types.join(", ")}`);
  }
  const rp: string[] = [];
  if (bp.risk_per_trade_pct != null) rp.push(`risk ${bp.risk_per_trade_pct}%/trade`);
  if (bp.daily_loss_limit_pct != null) rp.push(`daily loss ${bp.daily_loss_limit_pct}%`);
  if (bp.max_drawdown_pct != null) rp.push(`max DD ${bp.max_drawdown_pct}%`);
  if (rp.length) lines.push(`RISK PROFILE: ${rp.join(" · ")}`);
  lines.push("");
  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    const cat = CATEGORY_ORDER[i];
    const items = byCat[i];
    if (!items.length) continue;
    lines.push(`${CATEGORY_LABELS[cat].toUpperCase()}:`);
    for (const r of items) lines.push(`  • ${r.condition}`);
    lines.push("");
  }
  return lines;
}

/**
 * Build the canonical strategy view. ALL outputs (UI, PDF, Chart Analyzer)
 * derive from this and only this.
 */
export function buildCanonicalStrategy(bp: StrategyBlueprint): CanonicalStrategy {
  const rules = readRules(bp);
  const byCat = rulesByCategory(rules);
  const flat = byCat.flat();
  return {
    schema_version: 3,
    blueprint_id: bp.id,
    name: bp.name || "Untitled Strategy",
    locked: !!bp.locked,
    rules: flat,
    checklist: buildChecklist(flat),
    summary: buildSummary(bp, rules),
    plan_lines: buildPlanLines(bp, byCat),
  };
}

/* -------------------------------------------------------------------------- */
/*                       Adapters for downstream consumers                     */
/* -------------------------------------------------------------------------- */

/** Engine-ready rules for Chart Analyzer / rule engine. */
export function canonicalToEngineRules(c: CanonicalStrategy): StructuredRule[] {
  return c.rules.map((r) => ({
    id: r.id,
    type: r.type,
    condition: r.condition,
    evaluation_type: "boolean" as const,
    result: false,
  }));
}

/** Compact JSON snapshot — what we'd persist or ship to the analyzer. */
export function canonicalToJson(c: CanonicalStrategy): string {
  return JSON.stringify(
    {
      schema_version: c.schema_version,
      name: c.name,
      locked: c.locked,
      rules: c.rules.map(({ id, type, category, condition, tier, params }) => ({
        id,
        type,
        category,
        condition,
        tier,
        params: params ?? {},
      })),
      summary: c.summary,
    },
    null,
    2,
  );
}
