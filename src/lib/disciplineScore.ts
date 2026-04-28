// Deterministic Discipline Scoring System
// =========================================
//
// One module. One formula. No hidden logic. No randomness. AI can EXPLAIN,
// never SCORE.
//
//   discipline_score = 0.4 * decision_score + 0.6 * execution_score
//
// Decision layer  ← last 10 analyzer_events
// Execution layer ← last 10 discipline_logs
//
// Both layers use the SAME recency weighting (newest = 1.0, oldest = 0.2)
// so contributions are predictable across the system.
//
// Per-event raw scores (4-tier classification, deterministic):
//
//   VALID_CLEAN       →  +2   (all rules passed, no warnings)
//   VALID_WEAK        →   0   (valid but missing confluence)
//   INVALID           →  -5   (1–2 rule violations)
//   CRITICAL_INVALID  → -10   (3+ violations OR against trend / no entry
//                              logic / forced or random setup)
//
// Decision score is normalized to 0–100 against the theoretical min/max of
// the *current* recency window so the user can always reason:
//
//     "I just logged CRITICAL_INVALID → I lost the most recent slot's
//      worth of points (≈ 1.0 / Σweights of -10 vs +2 range)."

import { supabase } from "@/integrations/supabase/client";
import type { AnalyzerVerdict } from "@/lib/analyzerEvents";

// ── Constants ───────────────────────────────────────────────────────────

export const DECISION_WEIGHT = 0.4;
export const EXECUTION_WEIGHT = 0.6;
export const WINDOW_SIZE = 10;

/** Recency weights, index 0 = most recent. Per spec §3: linear 1.0 → 0.2. */
export const RECENCY_WEIGHTS = [
  1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2,
];

/** Per-event score range (4-tier). */
export const EVENT_SCORE_MAX = 2; // VALID_CLEAN
export const EVENT_SCORE_MIN = -10; // CRITICAL_INVALID

/** Anti-spam: 5 consecutive INVALID or CRITICAL_INVALID → extra -10 once. */
export const SPAM_THRESHOLD = 5;
export const SPAM_PENALTY = -10;

/** Critical violation tags (case-insensitive substring match). Any of these
 *  in an event's `violations` array forces CRITICAL_INVALID (-10). */
export const CRITICAL_VIOLATIONS = [
  "htf_bias",
  "against htf",
  "against trend",
  "no_entry",
  "no entry",
  "no clear entry",
  "random_entry",
  "random entry",
  "forced",
  "forced trade",
  "critical",
];

// ── Types ───────────────────────────────────────────────────────────────

export type DisciplineState =
  | "in_control" // 80–100
  | "slipping" //   60–79
  | "at_risk" //    40–59
  | "locked"; //    0–39

export type EventClass =
  | "valid_clean"
  | "valid_weak"
  | "invalid"
  | "critical_invalid";

export type EventRow = {
  id: string;
  verdict: AnalyzerVerdict;
  violations: unknown;
  /** Pre-computed raw event score in [-10, +2]. Recomputed if absent. */
  score_delta: number | null;
  created_at: string;
};

export type TradeLogRow = {
  id: string;
  trade_id: string;
  discipline_score: number; // 0–100
  followed_entry: boolean;
  followed_exit: boolean;
  followed_risk: boolean;
  followed_behavior: boolean;
  created_at: string;
};

export type ScoreContribution = {
  source: "decision" | "execution";
  id: string;
  /** For decision: raw event score in [-10, +2]. For execution: 0–100. */
  raw: number;
  /** Display value normalized 0–100 (for progress UI). */
  value: number;
  weight: number;
  klass?: EventClass; // decision only
  reason: string;
  timestamp: string;
};

export type DisciplineBreakdown = {
  score: number; // final 0–100
  state: DisciplineState;

  decision_score: number; // 0–100 (already weighted+normalized)
  decision_sample: number;
  decision_contributions: ScoreContribution[];

  execution_score: number; // 0–100
  execution_sample: number;
  execution_contributions: ScoreContribution[];

  /** Penalty deltas already applied to the appropriate sub-score. */
  penalties: Array<{
    source: "decision" | "execution";
    impact: number;
    reason: string;
    timestamp: string;
  }>;

  /** True when there are no executed trades — execution defaults to 50. */
  execution_neutral: boolean;
  /** True when there are no analyzer events — decision defaults to 50. */
  decision_neutral: boolean;
};

// ── Pure scoring helpers (no I/O) ───────────────────────────────────────

function isCritical(violations: unknown): boolean {
  if (!Array.isArray(violations)) return false;
  for (const v of violations) {
    if (typeof v !== "string") continue;
    const s = v.toLowerCase();
    if (CRITICAL_VIOLATIONS.some((c) => s.includes(c))) return true;
  }
  return false;
}

function violationCount(violations: unknown): number {
  if (Array.isArray(violations)) return violations.length;
  if (violations && typeof violations === "object") {
    return Object.keys(violations as Record<string, unknown>).length;
  }
  return 0;
}

/**
 * Deterministic 4-tier classification (spec §2).
 *
 * DB verdict mapping:
 *   "valid"   → valid_clean
 *   "weak"    → valid_weak
 *   "invalid" → invalid OR critical_invalid (depending on violations)
 */
export function classifyEvent(
  verdict: AnalyzerVerdict,
  violations: unknown,
): EventClass {
  if (verdict === "valid") return "valid_clean";
  if (verdict === "weak") return "valid_weak";
  // verdict === "invalid"
  if (isCritical(violations)) return "critical_invalid";
  const n = violationCount(violations);
  if (n >= 3) return "critical_invalid";
  return "invalid";
}

/** Per-class raw score (spec §2). */
export function scoreForClass(klass: EventClass): number {
  switch (klass) {
    case "valid_clean":
      return 2;
    case "valid_weak":
      return 0;
    case "invalid":
      return -5;
    case "critical_invalid":
      return -10;
  }
}

/** Convenience: classify + score in one call. */
export function eventScoreFor(
  verdict: AnalyzerVerdict,
  violations: unknown,
): number {
  return scoreForClass(classifyEvent(verdict, violations));
}

/** Map score 0–100 → state thresholds (spec §1 / §10 boundaries). */
export function stateForScore(score: number): DisciplineState {
  if (score >= 80) return "in_control";
  if (score >= 60) return "slipping";
  if (score >= 40) return "at_risk";
  return "locked";
}

/** Weighted average of pre-normalized 0–100 values. */
function weightedAverage(values: number[], weights: number[]): number {
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] ?? 0;
    sum += values[i] * w;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : 0;
}

function reasonForClass(klass: EventClass, raw: number): string {
  switch (klass) {
    case "valid_clean":
      return `Clean setup — all rules passed (${raw >= 0 ? "+" : ""}${raw}).`;
    case "valid_weak":
      return `Weak setup — valid but missing confluence (${raw}).`;
    case "invalid":
      return `Invalid — 1–2 rule violations (${raw}).`;
    case "critical_invalid":
      return `Critical — against trend / no entry / random setup (${raw}).`;
  }
}

function reasonForTrade(t: TradeLogRow): string {
  const parts = [
    t.followed_entry ? "entry✓" : "entry✗",
    t.followed_exit ? "exit✓" : "exit✗",
    t.followed_risk ? "risk✓" : "risk✗",
    t.followed_behavior ? "behavior✓" : "behavior✗",
  ];
  return `${t.discipline_score}/100 — ${parts.join(" · ")}`;
}

// ── Decision layer normalization (spec §3) ──────────────────────────────
//
// weighted_sum  = Σ(event_raw   × weight)
// max_possible  = Σ(EVENT_MAX   × weight)   // all VALID_CLEAN
// min_possible  = Σ(EVENT_MIN   × weight)   // all CRITICAL_INVALID
//
// decision_score = (weighted_sum - min_possible) /
//                  (max_possible - min_possible) * 100

function normalizeDecision(rawValues: number[], weights: number[]): number {
  if (rawValues.length === 0) return 50; // §6 neutral baseline

  let weightedSum = 0;
  let maxPossible = 0;
  let minPossible = 0;
  for (let i = 0; i < rawValues.length; i++) {
    const w = weights[i] ?? 0;
    weightedSum += rawValues[i] * w;
    maxPossible += EVENT_SCORE_MAX * w;
    minPossible += EVENT_SCORE_MIN * w;
  }
  const range = maxPossible - minPossible;
  if (range === 0) return 50;
  const norm = ((weightedSum - minPossible) / range) * 100;
  return Math.max(0, Math.min(100, norm));
}

// ── Composition (pure) ──────────────────────────────────────────────────

/**
 * Combine raw event + trade rows into the full breakdown.
 * Pass rows newest-first.
 */
export function buildBreakdown(
  events: EventRow[],
  trades: TradeLogRow[],
): DisciplineBreakdown {
  const penalties: DisciplineBreakdown["penalties"] = [];

  // ── Decision layer ────────────────────────────────────────────────────
  const evWindow = events.slice(0, WINDOW_SIZE);
  const decisionContribs: ScoreContribution[] = evWindow.map((e, i) => {
    const klass = classifyEvent(e.verdict, e.violations);
    // Always recompute raw from class so DB drift can never desync the score.
    const raw = scoreForClass(klass);
    // Display value: map [-10, +2] → [0, 100] so progress bars look right.
    const value =
      ((raw - EVENT_SCORE_MIN) / (EVENT_SCORE_MAX - EVENT_SCORE_MIN)) * 100;
    return {
      source: "decision",
      id: e.id,
      raw,
      value,
      weight: RECENCY_WEIGHTS[i] ?? 0,
      klass,
      reason: reasonForClass(klass, raw),
      timestamp: e.created_at,
    };
  });

  let decisionScore = normalizeDecision(
    decisionContribs.map((c) => c.raw),
    decisionContribs.map((c) => c.weight),
  );
  const decisionNeutral = decisionContribs.length === 0;

  // §7 Anti-spam: 5+ consecutive INVALID *or* CRITICAL_INVALID → -10 once.
  let invalidStreak = 0;
  for (const c of decisionContribs) {
    if (c.klass === "invalid" || c.klass === "critical_invalid") {
      invalidStreak += 1;
    } else {
      break;
    }
  }
  if (invalidStreak >= SPAM_THRESHOLD) {
    decisionScore = Math.max(0, decisionScore + SPAM_PENALTY);
    penalties.push({
      source: "decision",
      impact: SPAM_PENALTY,
      reason: `Anti-spam — ${invalidStreak} invalid setups in a row.`,
      timestamp: evWindow[0]?.created_at ?? new Date().toISOString(),
    });
  }

  // ── Execution layer ───────────────────────────────────────────────────
  const trWindow = trades.slice(0, WINDOW_SIZE);
  const executionContribs: ScoreContribution[] = trWindow.map((t, i) => {
    const v = Math.max(0, Math.min(100, t.discipline_score));
    return {
      source: "execution",
      id: t.id,
      raw: v,
      value: v,
      weight: RECENCY_WEIGHTS[i] ?? 0,
      reason: reasonForTrade(t),
      timestamp: t.created_at,
    };
  });

  const executionNeutral = executionContribs.length === 0;
  const executionScore = executionNeutral
    ? 50
    : weightedAverage(
        executionContribs.map((c) => c.value),
        executionContribs.map((c) => c.weight),
      );

  // ── Final ─────────────────────────────────────────────────────────────
  const decisionRounded = Math.max(0, Math.min(100, Math.round(decisionScore)));
  const executionRounded = Math.max(0, Math.min(100, Math.round(executionScore)));
  const score = Math.round(
    decisionRounded * DECISION_WEIGHT + executionRounded * EXECUTION_WEIGHT,
  );

  return {
    score,
    state: stateForScore(score),
    decision_score: decisionRounded,
    decision_sample: decisionContribs.length,
    decision_contributions: decisionContribs,
    execution_score: executionRounded,
    execution_sample: executionContribs.length,
    execution_contributions: executionContribs,
    penalties,
    execution_neutral: executionNeutral,
    decision_neutral: decisionNeutral,
  };
}

// ── I/O: load the rows the breakdown needs ─────────────────────────────

export async function fetchScoringInputs(): Promise<{
  events: EventRow[];
  trades: TradeLogRow[];
}> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { events: [], trades: [] };

  const [evRes, trRes] = await Promise.all([
    supabase
      .from("analyzer_events")
      .select("id,verdict,violations,score_delta,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(WINDOW_SIZE),
    supabase
      .from("discipline_logs")
      .select(
        "id,trade_id,discipline_score,followed_entry,followed_exit,followed_risk,followed_behavior,created_at",
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(WINDOW_SIZE),
  ]);

  const events = (evRes.data ?? []) as unknown as EventRow[];
  const trades = (trRes.data ?? []) as unknown as TradeLogRow[];
  return { events, trades };
}

export async function loadDisciplineBreakdown(): Promise<DisciplineBreakdown> {
  const { events, trades } = await fetchScoringInputs();
  return buildBreakdown(events, trades);
}
