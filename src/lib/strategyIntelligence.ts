// Strategy Intelligence Layer
// ----------------------------------------------------------------------------
// Deterministic engine that interrogates a StrategyBlueprint and surfaces:
//   1. Contradictions (mutually-exclusive choices stated together)
//   2. Vague rules (qualitative language that isn't testable)
//   3. Missing logic (entry / confirmation / risk / invalidation / context)
//   4. Overlapping rules (candidates for compression)
//   5. Weighted score → A+/B+/C label (kept for backward compat)
//
// Pure & synchronous. No network. Safe to call on every render.
// AI fallback (LLM-judged vagueness) lives in `parse-strategy` edge fn,
// triggered only when this engine's confidence is low.

import type { StrategyBlueprint, StructuredRules } from "./dbStrategyBlueprints";

/* -------------------------------------------------------------------------- */
/*                              Extended schema                                */
/* -------------------------------------------------------------------------- */

// We extend StructuredRules with `invalidation` while keeping the DB column
// shape (jsonb) flexible. Reading code falls back to [] when absent.
export type StructuredRulesV2 = StructuredRules & {
  invalidation?: string[];
};

export const RULE_CATEGORIES_V2 = [
  "entry",
  "confirmation",
  "risk",
  "behavior",
  "context",
  "invalidation",
] as const;

export type RuleCategoryV2 = (typeof RULE_CATEGORIES_V2)[number];

export function readRules(bp: StrategyBlueprint): StructuredRulesV2 {
  const r = (bp.structured_rules ?? {}) as StructuredRulesV2;
  return {
    entry: r.entry ?? [],
    confirmation: r.confirmation ?? [],
    risk: r.risk ?? [],
    behavior: r.behavior ?? [],
    context: r.context ?? [],
    invalidation: r.invalidation ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/*                            1. Contradictions                                */
/* -------------------------------------------------------------------------- */

export type Contradiction = {
  id: string;
  category: RuleCategoryV2 | "general";
  severity: "high" | "medium";
  message: string;
  conflicting: string[]; // raw rule strings involved
};

const SESSION_TOKENS: Array<{ key: string; rx: RegExp }> = [
  { key: "london", rx: /\blondon\b/i },
  { key: "new_york", rx: /\b(new[\s-]?york|ny\b|new york session)\b/i },
  { key: "asia", rx: /\b(asia|asian|tokyo|sydney)\b/i },
];

const DIRECTION_LONG = /\b(only|exclusively)?\s*(long|buy|bullish|longs only)\b/i;
const DIRECTION_SHORT = /\b(only|exclusively)?\s*(short|sell|bearish|shorts only)\b/i;
const ONLY = /\b(only|exclusively|just|strictly)\b/i;

export function detectContradictions(rules: StructuredRulesV2): Contradiction[] {
  const out: Contradiction[] = [];
  const all = [
    ...(rules.entry ?? []),
    ...(rules.context ?? []),
    ...(rules.behavior ?? []),
    ...(rules.confirmation ?? []),
  ];

  // 1a. Mutually-exclusive sessions ("only London" + "only NY").
  const onlySessionRules = all.filter((r) => ONLY.test(r));
  const sessionsHit = new Map<string, string[]>();
  for (const r of onlySessionRules) {
    for (const s of SESSION_TOKENS) {
      if (s.rx.test(r)) {
        const arr = sessionsHit.get(s.key) ?? [];
        arr.push(r);
        sessionsHit.set(s.key, arr);
      }
    }
  }
  if (sessionsHit.size > 1) {
    const conflicting = Array.from(sessionsHit.values()).flat();
    out.push({
      id: "contradict-sessions",
      category: "context",
      severity: "high",
      message: `You said "only" for multiple sessions (${Array.from(sessionsHit.keys()).join(", ")}). Pick one, or remove "only" to allow all.`,
      conflicting,
    });
  }

  // 1b. Direction bias conflict (only long vs only short).
  const longHits = all.filter((r) => DIRECTION_LONG.test(r) && ONLY.test(r));
  const shortHits = all.filter((r) => DIRECTION_SHORT.test(r) && ONLY.test(r));
  if (longHits.length && shortHits.length) {
    out.push({
      id: "contradict-direction",
      category: "entry",
      severity: "high",
      message: "You restricted to longs only AND shorts only. These can't both be true.",
      conflicting: [...longHits, ...shortHits],
    });
  }

  // 1c. Risk rules with conflicting per-trade %.
  const riskPcts: Array<{ pct: number; rule: string }> = [];
  for (const r of rules.risk ?? []) {
    const m = r.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) {
      // crude: only treat as per-trade if rule mentions per-trade / risk
      if (/per[\s-]?trade|risk/i.test(r)) {
        riskPcts.push({ pct: parseFloat(m[1]), rule: r });
      }
    }
  }
  if (riskPcts.length >= 2) {
    const distinct = new Set(riskPcts.map((p) => p.pct));
    if (distinct.size > 1) {
      out.push({
        id: "contradict-risk-pct",
        category: "risk",
        severity: "medium",
        message: `Multiple per-trade risk values mentioned (${Array.from(distinct).join("%, ")}%). Choose one.`,
        conflicting: riskPcts.map((p) => p.rule),
      });
    }
  }

  // 1d. Trade limits conflict ("max 3 trades" + "max 5 trades").
  const tradeCaps: Array<{ n: number; rule: string }> = [];
  for (const r of [...(rules.behavior ?? []), ...(rules.risk ?? [])]) {
    const m = r.match(/\bmax(?:imum)?\s+(\d+)\s+(trade|setup)/i);
    if (m) tradeCaps.push({ n: parseInt(m[1], 10), rule: r });
  }
  if (tradeCaps.length >= 2 && new Set(tradeCaps.map((t) => t.n)).size > 1) {
    out.push({
      id: "contradict-trade-cap",
      category: "behavior",
      severity: "medium",
      message: `Conflicting daily trade caps (${tradeCaps.map((t) => t.n).join(", ")}). Pick one.`,
      conflicting: tradeCaps.map((t) => t.rule),
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*                              2. Vague rules                                  */
/* -------------------------------------------------------------------------- */

export type VagueRule = {
  category: RuleCategoryV2;
  rule: string;
  trigger: string; // the vague word that flagged it
  suggestion: string; // human-readable suggested rewrite prompt
};

// Words that almost always mean "I haven't defined this yet."
const VAGUE_TRIGGERS: Array<{ word: RegExp; suggestion: string }> = [
  { word: /\bclear(?:ly)?\b/i, suggestion: 'Replace "clear" with the exact pattern (e.g. "higher high + higher low on 15m").' },
  { word: /\bstrong\b/i, suggestion: 'Replace "strong" with a measurable threshold (e.g. "candle body ≥ 70% of range").' },
  { word: /\bgood\b/i, suggestion: 'Replace "good" with a binary condition.' },
  { word: /\bclean\b/i, suggestion: 'Replace "clean" with a structural definition (e.g. "no overlapping candles in last 5 bars").' },
  { word: /\bnice\b/i, suggestion: '"Nice" is subjective — define what it looks like.' },
  { word: /\bproper\b/i, suggestion: 'Define what "proper" means as a yes/no condition.' },
  { word: /\bobvious\b/i, suggestion: 'Replace "obvious" with the exact condition you check.' },
  { word: /\bsignificant\b/i, suggestion: 'Quantify "significant" (e.g. "≥ 1.5× ATR").' },
  { word: /\bsuitable\b/i, suggestion: '"Suitable" needs a concrete definition.' },
  { word: /\bif possible\b/i, suggestion: 'Either it\'s required or it isn\'t — drop "if possible".' },
];

export function detectVagueRules(rules: StructuredRulesV2): VagueRule[] {
  const out: VagueRule[] = [];
  for (const cat of RULE_CATEGORIES_V2) {
    const list = (rules[cat] ?? []) as string[];
    for (const r of list) {
      for (const t of VAGUE_TRIGGERS) {
        const m = r.match(t.word);
        if (m) {
          out.push({ category: cat, rule: r, trigger: m[0], suggestion: t.suggestion });
          break; // one finding per rule keeps UI clean
        }
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                            3. Missing logic                                  */
/* -------------------------------------------------------------------------- */

export type MissingArea = {
  category: RuleCategoryV2;
  prompt: string; // question to ask the user
};

export function detectMissing(rules: StructuredRulesV2): MissingArea[] {
  const out: MissingArea[] = [];
  if ((rules.entry ?? []).length === 0) {
    out.push({ category: "entry", prompt: "What exact condition triggers your entry?" });
  }
  if ((rules.confirmation ?? []).length === 0) {
    out.push({
      category: "confirmation",
      prompt: "What signal confirms the entry before you click buy/sell?",
    });
  }
  if ((rules.risk ?? []).length === 0) {
    out.push({ category: "risk", prompt: "Where does your stop-loss go and how much do you risk?" });
  }
  if ((rules.invalidation ?? []).length === 0) {
    out.push({
      category: "invalidation",
      prompt: "What condition invalidates this setup — i.e. tells you to NOT take it?",
    });
  }
  if ((rules.context ?? []).length === 0) {
    out.push({ category: "context", prompt: "Which sessions, instruments, or market conditions does this work in?" });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                          4. Overlap / compression                            */
/* -------------------------------------------------------------------------- */

export type OverlapSuggestion = {
  category: RuleCategoryV2;
  rules: string[]; // 2+ rules that overlap
  merged: string; // suggested single rule
};

const OVERLAP_PATTERNS: Array<{
  test: (rules: string[]) => string[] | null;
  merge: (matched: string[]) => string;
}> = [
  // supply & demand zone variants → "key supply or demand zone"
  {
    test: (rs) => {
      const supply = rs.find((r) => /supply\s*zone/i.test(r));
      const demand = rs.find((r) => /demand\s*zone/i.test(r));
      return supply && demand ? [supply, demand] : null;
    },
    merge: () => "Price reacts at a key supply or demand zone",
  },
  // multiple "confluence with X" rules → consolidate
  {
    test: (rs) => {
      const conf = rs.filter((r) => /\bconfluence\b/i.test(r));
      return conf.length >= 2 ? conf : null;
    },
    merge: (m) => `Multiple confluences required (${m.length})`,
  },
];

export function detectOverlaps(rules: StructuredRulesV2): OverlapSuggestion[] {
  const out: OverlapSuggestion[] = [];
  for (const cat of RULE_CATEGORIES_V2) {
    const list = (rules[cat] ?? []) as string[];
    for (const p of OVERLAP_PATTERNS) {
      const matched = p.test(list);
      if (matched && matched.length >= 2) {
        out.push({ category: cat, rules: matched, merged: p.merge(matched) });
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                         5. Weighted scoring                                  */
/* -------------------------------------------------------------------------- */

// Section 4 weights from spec: Entry 40 / Confirmation 25 / Context 15 / Risk 10 / Behavior 10
// Invalidation isn't in the spec's weighted list — we treat it as a hard
// gate (its absence drops final tier) instead of a weighted slice, so the
// math still maps cleanly to the existing A+/B+/C labels.
export const RULE_WEIGHTS: Record<RuleCategoryV2, number> = {
  entry: 40,
  confirmation: 25,
  context: 15,
  risk: 10,
  behavior: 10,
  invalidation: 0,
};

export type WeightedScore = {
  total: number; // 0-100
  perCategory: Record<RuleCategoryV2, { satisfied: number; total: number; pct: number }>;
  tier: "A+" | "B+" | "C" | "F";
  hasInvalidation: boolean;
};

/**
 * Score a blueprint by its CURRENT structured rules. Each non-empty rule
 * counts as 1 point inside its category; the category's contribution is
 * weight × (satisfied / total). With no per-rule pass/fail data here we
 * count "rule defined" as "rule satisfied at design time" — this measures
 * STRATEGY COMPLETENESS, not live trade discipline.
 */
export function computeWeightedScore(rules: StructuredRulesV2): WeightedScore {
  const per: WeightedScore["perCategory"] = {} as WeightedScore["perCategory"];
  let total = 0;
  for (const cat of RULE_CATEGORIES_V2) {
    const items = (rules[cat] ?? []) as string[];
    const t = items.length;
    const s = items.filter((r) => r.trim().length > 0).length;
    const pct = t === 0 ? 0 : s / t;
    per[cat] = { satisfied: s, total: t, pct };
    total += pct * RULE_WEIGHTS[cat];
  }
  // Completeness floor: presence of each weighted category contributes its
  // full weight. Missing category = 0 contribution.
  // (Already encoded above since empty cat → pct 0.)
  total = Math.round(total);

  const hasInvalidation = (rules.invalidation ?? []).length > 0;
  let tier: WeightedScore["tier"];
  if (total >= 90 && hasInvalidation) tier = "A+";
  else if (total >= 70) tier = "B+";
  else if (total >= 50) tier = "C";
  else tier = "F";

  return { total, perCategory: per, tier, hasInvalidation };
}

/* -------------------------------------------------------------------------- */
/*                              6. Aggregate                                    */
/* -------------------------------------------------------------------------- */

export type IntelligenceReport = {
  contradictions: Contradiction[];
  vague: VagueRule[];
  missing: MissingArea[];
  overlaps: OverlapSuggestion[];
  score: WeightedScore;
  /** True when there are NO blockers — UI can hide the interrogation step. */
  clean: boolean;
};

export function interrogate(bp: StrategyBlueprint): IntelligenceReport {
  const rules = readRules(bp);
  const contradictions = detectContradictions(rules);
  const vague = detectVagueRules(rules);
  const missing = detectMissing(rules);
  const overlaps = detectOverlaps(rules);
  const score = computeWeightedScore(rules);
  const clean =
    contradictions.length === 0 &&
    vague.length === 0 &&
    missing.length === 0 &&
    overlaps.length === 0;
  return { contradictions, vague, missing, overlaps, score, clean };
}

/* -------------------------------------------------------------------------- */
/*                  7. Strictness control / finalize gate                      */
/* -------------------------------------------------------------------------- */

export type StrictnessVerdict = {
  /** "ok" lets the user proceed; "warn" shows yellow; "block" stops finalize. */
  severity: "ok" | "warn" | "block";
  /** Human-readable reasons (one per blocker / warning). */
  reasons: string[];
  /** Critical missing categories that MUST be filled before finalize. */
  criticalMissing: RuleCategoryV2[];
};

const CRITICAL_MISSING: RuleCategoryV2[] = ["entry", "risk"];

/**
 * Decide whether the builder may advance past the Interrogation step.
 * Locked blueprints are grandfathered: their verdict is downgraded to "warn"
 * regardless of issues, so existing systems keep working untouched.
 */
export function evaluateStrictness(
  report: IntelligenceReport,
  opts: { isLocked?: boolean } = {},
): StrictnessVerdict {
  const reasons: string[] = [];
  const criticalMissing = report.missing
    .map((m) => m.category)
    .filter((c) => CRITICAL_MISSING.includes(c));

  if (report.contradictions.length > 0) {
    reasons.push(
      `${report.contradictions.length} contradiction${report.contradictions.length === 1 ? "" : "s"} — rules conflict.`,
    );
  }
  if (criticalMissing.length > 0) {
    reasons.push(
      `Missing required: ${criticalMissing.join(", ")}.`,
    );
  }
  if (report.vague.length > 2) {
    reasons.push(
      `${report.vague.length} vague rules — tighten or drop them.`,
    );
  }

  let severity: StrictnessVerdict["severity"] = "ok";
  if (reasons.length > 0) severity = "block";
  else if (report.vague.length > 0 || report.missing.length > 0 || report.overlaps.length > 0) {
    severity = "warn";
  }

  // Grandfather locked blueprints — never block them.
  if (opts.isLocked && severity === "block") severity = "warn";

  return { severity, reasons, criticalMissing };
}

/* -------------------------------------------------------------------------- */
/*                   8. Structured-output validation                           */
/* -------------------------------------------------------------------------- */

export type RuleAtomicityIssue = {
  category: RuleCategoryV2;
  rule: string;
  problem: "compound" | "non_binary" | "too_long" | "empty";
  hint: string;
};

const COMPOUND_JOINERS = /\b(and then|then also|plus|along with)\b/i;
const NON_BINARY = /\b(maybe|sometimes|usually|often|prefer|try to|if possible|depends)\b/i;

/**
 * Atomic = one condition. Binary = yes/no testable. Machine-readable = ≤12 words
 * and free of hedging language. Returns issues for Chart Analyzer compatibility.
 */
export function validateStructuredOutput(rules: StructuredRulesV2): RuleAtomicityIssue[] {
  const out: RuleAtomicityIssue[] = [];
  for (const cat of RULE_CATEGORIES_V2) {
    for (const rule of (rules[cat] ?? []) as string[]) {
      const trimmed = rule.trim();
      if (!trimmed) {
        out.push({ category: cat, rule, problem: "empty", hint: "Remove blank rule." });
        continue;
      }
      if (COMPOUND_JOINERS.test(trimmed)) {
        out.push({
          category: cat,
          rule,
          problem: "compound",
          hint: "Split into separate atomic rules.",
        });
        continue;
      }
      if (NON_BINARY.test(trimmed)) {
        out.push({
          category: cat,
          rule,
          problem: "non_binary",
          hint: "Replace hedging language with a yes/no condition.",
        });
        continue;
      }
      if (trimmed.split(/\s+/).length > 14) {
        out.push({
          category: cat,
          rule,
          problem: "too_long",
          hint: "Trim to ≤12 words.",
        });
      }
    }
  }
  return out;
}
