// SenecaEdge Behavior Engine — deterministic SSOT for ALL behavior scoring.
// ========================================================================
//
// CORE MODEL
//   Start overall score: 100
//   Violation penalty:  -10 for every violation attached to a trade
//   Clean recovery:     +5 for every clean trade
//   Clamp:              0..100
//
// No averaging, no EMA, no normalization, no severity weighting, no AI
// estimation. Dashboard, history, replay, mentor and alerts must consume this
// module (or the SSOT object built from it) for behavior values.

export type ViolationId = string;

export const STARTING_OVERALL = 100;
export const MIN_OVERALL = 0;
export const MAX_OVERALL = 100;
export const VIOLATION_PENALTY = 10;
export const CLEAN_TRADE_RECOVERY = 5;

export const FIXED_PENALTY_BY_VIOLATION: Record<string, number> = {
  no_setup: VIOLATION_PENALTY,
  fomo: VIOLATION_PENALTY,
  revenge_risk: VIOLATION_PENALTY,
  ignored_sl: VIOLATION_PENALTY,
  oversized: VIOLATION_PENALTY,
  emotional_entry: VIOLATION_PENALTY,
};

// Risk-policy synthetic violations. All carry the same fixed -10 penalty.
export const RISK_VIOLATION_IDS = {
  minor: "minor_risk",
  oversize: "oversized_risk",
  high: "high_risk",
  revenge: "revenge_risk",
} as const;

function clamp(n: number): number {
  return Math.max(MIN_OVERALL, Math.min(MAX_OVERALL, Math.round(n)));
}

export function rawPenaltyFor(rule: string): number {
  return FIXED_PENALTY_BY_VIOLATION[rule] ?? VIOLATION_PENALTY;
}

/** Risk policy classifier — returns the violation id (or null when within policy). */
export function classifyRiskRatio(actual: number | null, preferred: number | null): string | null {
  if (actual == null || preferred == null) return null;
  if (!Number.isFinite(actual) || !Number.isFinite(preferred)) return null;
  if (preferred <= 0 || actual <= 0) return null;
  const ratio = actual / preferred;
  if (ratio <= 1.10) return null;
  if (ratio < 1.25) return RISK_VIOLATION_IDS.minor;
  if (ratio < 1.50) return RISK_VIOLATION_IDS.oversize;
  if (ratio < 2.00) return RISK_VIOLATION_IDS.high;
  return RISK_VIOLATION_IDS.revenge;
}

function uniqueViolations(input: ScoredTradeInput): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of input.rulesBroken ?? []) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  const riskId = classifyRiskRatio(input.actualRisk ?? null, input.preferredRisk ?? null);
  if (riskId && !seen.has(riskId)) ids.unshift(riskId);
  return ids;
}

export type ScoredTradeInput = {
  /** Rule violation ids on this trade. Pass actual+preferred to auto-append risk-policy violation. */
  rulesBroken: string[];
  actualRisk?: number | null;
  preferredRisk?: number | null;
};

export type TradeScoreResult = {
  /** Per-trade score: 100 - (10 × violations), clamped 0..100. */
  score: number;
  /** All violation ids actually counted. */
  violations: string[];
  /** Per-violation breakdown. Every applied penalty is exactly 10. */
  breakdown: Array<{ id: string; raw: number; applied: number }>;
  /** True when there are zero counted violations. */
  isClean: boolean;
  tier: "controlled" | "drift" | "unstable" | "impulsive";
  tierColor: "green" | "yellow" | "orange" | "red";
  riskViolationId: string | null;
};

export function scoreTrade(input: ScoredTradeInput): TradeScoreResult {
  const violations = uniqueViolations(input);
  const riskViolationId = classifyRiskRatio(input.actualRisk ?? null, input.preferredRisk ?? null);
  const breakdown = violations.map((id) => ({
    id,
    raw: rawPenaltyFor(id),
    applied: VIOLATION_PENALTY,
  }));
  const score = clamp(STARTING_OVERALL - breakdown.length * VIOLATION_PENALTY);
  const isClean = violations.length === 0;

  return {
    score,
    violations,
    breakdown,
    isClean,
    ...tierFromTradeScore(score),
    riskViolationId,
  };
}

export function tierFromTradeScore(score: number): {
  tier: TradeScoreResult["tier"];
  tierColor: TradeScoreResult["tierColor"];
} {
  if (score >= 95) return { tier: "controlled", tierColor: "green" };
  if (score >= 80) return { tier: "drift", tierColor: "yellow" };
  if (score >= 60) return { tier: "unstable", tierColor: "orange" };
  return { tier: "impulsive", tierColor: "red" };
}

export type BehaviorState =
  | "controlled" // 90–100
  | "drifting"   // 75–89
  | "unstable"   // 60–74
  | "impulsive"  // 40–59
  | "collapsed"; // 0–39

export function stateFromOverall(overall: number): BehaviorState {
  if (overall >= 90) return "controlled";
  if (overall >= 75) return "drifting";
  if (overall >= 60) return "unstable";
  if (overall >= 40) return "impulsive";
  return "collapsed";
}

/** Back-compat helper: direct arithmetic, not EMA. */
export function nextOverall(prev: number, tradeScore: number): number {
  const penalty = Math.max(0, STARTING_OVERALL - clamp(tradeScore));
  return clamp(penalty === 0 ? prev + CLEAN_TRADE_RECOVERY : prev - penalty);
}

export type ReplayTradeInput = {
  id: string;
  executed_at: string;
  rulesBroken: string[];
  actualRisk?: number | null;
  preferredRisk?: number | null;
};

export type ReplayContribution = {
  id: string;
  timestamp: string;
  tradeScore: number;
  overallBefore: number;
  overallAfter: number;
  /** Actual score movement after clamping. */
  delta: number;
  /** Raw ledger movement before clamping: +5 clean, -10 per violation. */
  rawDelta: number;
  violations: string[];
  isClean: boolean;
  cleanStreakAfter: number;
  state: BehaviorState;
  reason: string;
};

export type ReplayResult = {
  overall: number;
  overallRaw: number;
  state: BehaviorState;
  totalTrades: number;
  cleanTrades: number;
  violationCount: number;
  ruleAdherence: number;
  cleanStreak: number;
  longestStreak: number;
  contributions: ReplayContribution[];
};

export function replay(trades: ReplayTradeInput[]): ReplayResult {
  const chrono = [...trades].sort(
    (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
  );

  let overall = STARTING_OVERALL;
  let cleanCount = 0;
  let violationCount = 0;
  let streak = 0;
  let longest = 0;
  const contribs: ReplayContribution[] = [];

  for (const t of chrono) {
    const before = overall;
    const result = scoreTrade({
      rulesBroken: t.rulesBroken,
      actualRisk: t.actualRisk,
      preferredRisk: t.preferredRisk,
    });

    const rawDelta = result.isClean
      ? CLEAN_TRADE_RECOVERY
      : -result.violations.length * VIOLATION_PENALTY;
    overall = clamp(before + rawDelta);

    if (result.isClean) {
      cleanCount += 1;
      streak += 1;
      longest = Math.max(longest, streak);
    } else {
      violationCount += result.violations.length;
      streak = 0;
    }

    const delta = overall - before;
    contribs.push({
      id: t.id,
      timestamp: t.executed_at,
      tradeScore: result.score,
      overallBefore: before,
      overallAfter: overall,
      delta,
      rawDelta,
      violations: result.violations,
      isClean: result.isClean,
      cleanStreakAfter: streak,
      state: stateFromOverall(overall),
      reason: result.isClean
        ? `Clean execution (+${CLEAN_TRADE_RECOVERY}) — overall ${before} → ${overall}.`
        : `${result.violations.length} violation${result.violations.length === 1 ? "" : "s"} (${result.violations.join(", ")}) × -${VIOLATION_PENALTY} — overall ${before} → ${overall}.`,
    });
  }

  const totalTrades = chrono.length;
  const adherence = totalTrades === 0 ? 1 : cleanCount / totalTrades;
  return {
    overall,
    overallRaw: overall,
    state: stateFromOverall(overall),
    totalTrades,
    cleanTrades: cleanCount,
    violationCount,
    ruleAdherence: adherence,
    cleanStreak: streak,
    longestStreak: longest,
    contributions: contribs.reverse().slice(0, 50),
  };
}

/** Human-friendly transition label. Returns "stable at N" when before==after. */
export function transitionLabel(before: number, after: number): string {
  const a = Math.round(before);
  const b = Math.round(after);
  if (a === b) return `Behavior stable at ${b}`;
  return `${a} → ${b}`;
}

export const BEHAVIOR_STATE_COPY: Record<BehaviorState, { label: string; tone: "ok" | "drift" | "warn" | "risk" | "collapse" }> = {
  controlled: { label: "Controlled", tone: "ok" },
  drifting: { label: "Drifting", tone: "drift" },
  unstable: { label: "Unstable", tone: "warn" },
  impulsive: { label: "Impulsive", tone: "risk" },
  collapsed: { label: "Collapsed", tone: "collapse" },
};
