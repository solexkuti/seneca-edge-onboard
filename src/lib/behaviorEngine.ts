// SenecaEdge Behavior Engine — Single Source of Truth for ALL scoring.
// =====================================================================
//
// One module. One formula. No UI-side math. Every trade score, behavior
// score, state transition, color tier, streak, risk classification and
// pressure label MUST come from here. Any component (dashboard, journal,
// mentor, alerts) that needs a number imports from this file.
//
// MODEL SUMMARY
// -------------
//   • Trade Score (per execution, instant):
//       100 - stackedPenalties(rulesBroken + riskViolation?)
//       Stacking: primary 100%, secondary 50%, third 25%, fourth+ 10%.
//       Clamp 0..100.
//
//   • Behavior Score (overall, gradual EMA):
//       overall = prev * 0.9 + tradeScore * 0.1
//       Start 100. Clamp 0..100. Round on display only.
//
//   • Risk policy violation (auto-injected when actualRisk > preferredRisk):
//       ratio = actualRisk / preferredRisk
//       1.10–1.25  → minor_risk      (−5)
//       1.25–1.50  → oversized       (−10)
//       1.50–2.00  → high_risk       (−18)
//       ≥ 2.00     → revenge_risk    (−25)
//
//   • Per-trade color tier (from trade score, NOT overall):
//       95–100 green | 80–94 yellow | 60–79 orange | <60 red
//
//   • Behavior state (from overall score):
//       90–100 controlled | 75–89 drifting | 60–74 unstable
//       40–59 impulsive   | 0–39 collapsed
//
//   • Clean streak: increments ONLY when penalties == 0 (no risk override).
//     Any violation (rule or risk) resets to 0.

// ── Penalty weights (raw, before stacking reduction) ───────────────────

export type ViolationId = string;

const PENALTY_WEIGHTS: Array<{ match: RegExp; id: string; weight: number }> = [
  { match: /ignored?[_\s-]?sl|no[_\s-]?sl|abandon/i,             id: "ignored_sl",     weight: 40 },
  { match: /revenge(?!_risk)/i,                                   id: "revenge_trade",  weight: 35 },
  { match: /risk[_\s-]?override|broke[_\s-]?risk[_\s-]?rule/i,    id: "risk_override",  weight: 30 },
  { match: /oversiz|over[_\s-]?lever|doubled/i,                   id: "oversized",      weight: 25 },
  { match: /moved?[_\s-]?sl/i,                                    id: "moved_sl",       weight: 25 },
  { match: /no[_\s-]?setup|invalid[_\s-]?setup/i,                 id: "no_setup",       weight: 20 },
  { match: /fomo/i,                                               id: "fomo",           weight: 20 },
  { match: /emotional|tilt/i,                                     id: "emotional",      weight: 15 },
  { match: /hesitat/i,                                            id: "hesitation",     weight: 10 },
  { match: /early[_\s-]?entry/i,                                  id: "early_entry",    weight: 10 },
  { match: /late[_\s-]?entry/i,                                   id: "late_entry",     weight: 10 },
];

// Risk-policy synthetic violations (injected by the engine, never user-tagged).
export const RISK_VIOLATION_IDS = {
  minor:    "minor_risk",
  oversize: "oversized_risk",
  high:     "high_risk",
  revenge:  "revenge_risk",
} as const;

const RISK_VIOLATION_WEIGHT: Record<string, number> = {
  [RISK_VIOLATION_IDS.minor]:    5,
  [RISK_VIOLATION_IDS.oversize]: 10,
  [RISK_VIOLATION_IDS.high]:     18,
  [RISK_VIOLATION_IDS.revenge]:  25,
};

const STACK_MULTIPLIERS = [1, 0.5, 0.25, 0.1] as const;
const FALLBACK_PENALTY = 10;

// ── Pure helpers ───────────────────────────────────────────────────────

export function rawPenaltyFor(rule: string): number {
  if (RISK_VIOLATION_WEIGHT[rule] != null) return RISK_VIOLATION_WEIGHT[rule];
  const r = rule.toLowerCase();
  for (const p of PENALTY_WEIGHTS) if (p.match.test(r)) return p.weight;
  return FALLBACK_PENALTY;
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

export type ScoredTradeInput = {
  /** All rule violation ids on this trade (already includes any synthetic risk id, OR pass actual+preferred and we compute it). */
  rulesBroken: string[];
  /** Optional — if both provided, engine auto-appends a risk violation id. */
  actualRisk?: number | null;
  preferredRisk?: number | null;
};

export type TradeScoreResult = {
  /** Final per-trade score 0..100 (rounded). */
  score: number;
  /** All violation ids actually counted (rules + auto-appended risk id). */
  violations: string[];
  /** Per-violation breakdown after stacking reduction, sorted by severity desc. */
  breakdown: Array<{ id: string; raw: number; applied: number }>;
  /** True when score == 100 AND zero violations. */
  isClean: boolean;
  /** Per-trade color tier — derived only from this trade. */
  tier: "controlled" | "drift" | "unstable" | "impulsive";
  tierColor: "green" | "yellow" | "orange" | "red";
  /** Auto-injected risk-policy id, when applicable. */
  riskViolationId: string | null;
};

export function scoreTrade(input: ScoredTradeInput): TradeScoreResult {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of input.rulesBroken ?? []) {
    if (!r) continue;
    const k = String(r);
    if (seen.has(k)) continue;
    seen.add(k);
    ids.push(k);
  }
  const riskId = classifyRiskRatio(input.actualRisk ?? null, input.preferredRisk ?? null);
  if (riskId && !seen.has(riskId)) {
    ids.push(riskId);
    seen.add(riskId);
  }

  const ranked = ids
    .map((id) => ({ id, raw: rawPenaltyFor(id) }))
    .sort((a, b) => b.raw - a.raw);

  let total = 0;
  const breakdown = ranked.map((p, i) => {
    const mult = STACK_MULTIPLIERS[Math.min(i, STACK_MULTIPLIERS.length - 1)];
    const applied = Math.round(p.raw * mult);
    total += applied;
    return { id: p.id, raw: p.raw, applied };
  });

  const score = Math.max(0, Math.min(100, 100 - total));
  const isClean = ids.length === 0 && score === 100;

  return {
    score,
    violations: ids,
    breakdown,
    isClean,
    ...tierFromTradeScore(score),
    riskViolationId: riskId,
  };
}

export function tierFromTradeScore(score: number): {
  tier: TradeScoreResult["tier"];
  tierColor: TradeScoreResult["tierColor"];
} {
  if (score >= 95) return { tier: "controlled", tierColor: "green" };
  if (score >= 80) return { tier: "drift",      tierColor: "yellow" };
  if (score >= 60) return { tier: "unstable",   tierColor: "orange" };
  return            { tier: "impulsive",  tierColor: "red"    };
}

// ── Overall EMA + behavior state ───────────────────────────────────────

export const STARTING_OVERALL = 100;
export const EMA_PREV = 0.9;
export const EMA_NEW = 0.1;

export type BehaviorState =
  | "controlled" //  90–100
  | "drifting"   //  75–89
  | "unstable"   //  60–74
  | "impulsive"  //  40–59
  | "collapsed"; //  0–39

export function stateFromOverall(overall: number): BehaviorState {
  if (overall >= 90) return "controlled";
  if (overall >= 75) return "drifting";
  if (overall >= 60) return "unstable";
  if (overall >= 40) return "impulsive";
  return "collapsed";
}

export function nextOverall(prev: number, tradeScore: number): number {
  const next = prev * EMA_PREV + tradeScore * EMA_NEW;
  return Math.max(0, Math.min(100, next));
}

// ── Replay across many trades ──────────────────────────────────────────

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
  delta: number;
  violations: string[];
  isClean: boolean;
  cleanStreakAfter: number;
  state: BehaviorState;
  reason: string;
};

export type ReplayResult = {
  /** Final overall (rounded). */
  overall: number;
  /** Final overall (raw float — for chained EMA). */
  overallRaw: number;
  state: BehaviorState;
  totalTrades: number;
  cleanTrades: number;
  violationCount: number;
  /** clean / total — 1 when total = 0. */
  ruleAdherence: number;
  cleanStreak: number;
  longestStreak: number;
  /** Newest-first, capped 50. */
  contributions: ReplayContribution[];
};

export function replay(trades: ReplayTradeInput[]): ReplayResult {
  const chrono = [...trades].sort(
    (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
  );

  let overallRaw = STARTING_OVERALL;
  let cleanCount = 0;
  let violationCount = 0;
  let streak = 0;
  let longest = 0;
  const contribs: ReplayContribution[] = [];

  for (const t of chrono) {
    const before = overallRaw;
    const result = scoreTrade({
      rulesBroken: t.rulesBroken,
      actualRisk: t.actualRisk,
      preferredRisk: t.preferredRisk,
    });
    overallRaw = nextOverall(before, result.score);

    if (result.isClean) {
      cleanCount += 1;
      streak += 1;
      if (streak > longest) longest = streak;
    } else {
      violationCount += result.violations.length;
      streak = 0;
    }

    contribs.push({
      id: t.id,
      timestamp: t.executed_at,
      tradeScore: result.score,
      overallBefore: Math.round(before),
      overallAfter: Math.round(overallRaw),
      delta: Math.round(overallRaw) - Math.round(before),
      violations: result.violations,
      isClean: result.isClean,
      cleanStreakAfter: streak,
      state: stateFromOverall(overallRaw),
      reason: result.isClean
        ? `Clean execution — overall ${Math.round(before)} → ${Math.round(overallRaw)}.`
        : `${result.violations.length} violation${result.violations.length === 1 ? "" : "s"} (${result.violations.join(", ")}) — trade ${result.score}/100, overall ${Math.round(before)} → ${Math.round(overallRaw)}.`,
    });
  }

  const totalTrades = chrono.length;
  const overall = Math.round(overallRaw);
  return {
    overall,
    overallRaw,
    state: stateFromOverall(overall),
    totalTrades,
    cleanTrades: cleanCount,
    violationCount,
    ruleAdherence: totalTrades === 0 ? 1 : cleanCount / totalTrades,
    cleanStreak: streak,
    longestStreak: longest,
    contributions: contribs.reverse().slice(0, 50),
  };
}

// ── Display helpers ────────────────────────────────────────────────────

/** Human-friendly transition label. Returns "stable at N" when before==after. */
export function transitionLabel(before: number, after: number): string {
  const a = Math.round(before);
  const b = Math.round(after);
  if (a === b) return `Behavior stable at ${b}`;
  return `${a} → ${b}`;
}

export const BEHAVIOR_STATE_COPY: Record<BehaviorState, { label: string; tone: "ok" | "drift" | "warn" | "risk" | "collapse" }> = {
  controlled: { label: "Controlled", tone: "ok"       },
  drifting:   { label: "Drifting",   tone: "drift"    },
  unstable:   { label: "Unstable",   tone: "warn"     },
  impulsive:  { label: "Impulsive",  tone: "risk"     },
  collapsed:  { label: "Collapsed",  tone: "collapse" },
};
