// Deterministic Discipline Scoring System
// =========================================
//
// One module. One formula. No hidden logic.
//
//   discipline_score = 0.4 * decision_score + 0.6 * execution_score
//
// Decision score  ← last 10 analyzer_events, weighted by recency
// Execution score ← last 10 discipline_logs,  weighted by recency
//
// This module is the ONLY place these scores are computed. Every surface
// (TraderState, AnalyzerLockScreen, Recovery, /hub/state, edge function)
// must read from the helpers exported here so the number behaves like a
// mirror of the user's actual behavior.

import { supabase } from "@/integrations/supabase/client";
import type { AnalyzerVerdict } from "@/lib/analyzerEvents";

// ── Constants ───────────────────────────────────────────────────────────

export const DECISION_WEIGHT = 0.4;
export const EXECUTION_WEIGHT = 0.6;
export const WINDOW_SIZE = 10;

/** Recency weights, index 0 = most recent. Length must be ≥ WINDOW_SIZE. */
export const RECENCY_WEIGHTS = [
  1.0, 0.85, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.2,
];

/** Per-event score range used for analyzer_events. */
export const EVENT_SCORE_MIN = -20;
export const EVENT_SCORE_MAX = 5;

/** Anti-gaming: extra penalty applied on top of an invalid event when the
 *  user has 5+ invalid analyses in a row. */
export const SPAM_THRESHOLD = 5;
export const SPAM_PENALTY = -10;

/** Trade avoidance: applied to execution layer when the user analyzes but
 *  never executes for a long stretch. */
export const TRADE_AVOIDANCE_HOURS = 72;
export const TRADE_AVOIDANCE_PENALTY = -5;

/** Critical violation tags (case-insensitive substring match). Any of these
 *  in an event's `violations` array forces SEVERE severity (-20). */
export const CRITICAL_VIOLATIONS = [
  "htf_bias",
  "against htf",
  "no_entry",
  "no clear entry",
  "random_entry",
  "random entry",
];

// ── Types ───────────────────────────────────────────────────────────────

export type DisciplineState =
  | "in_control" // 80–100
  | "slipping" //   60–79
  | "at_risk" //    40–59
  | "locked"; //    0–39

export type EventRow = {
  id: string;
  verdict: AnalyzerVerdict;
  violations: unknown;
  /** Pre-computed event_score in [-20, +5]. Optional — recomputed if absent. */
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
  value: number; // normalized 0–100
  weight: number; // recency weight
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
 * Deterministic event score in [-20, +5].
 *
 *   valid                                           → +5
 *   weak                                            →   0  (neutral)
 *   invalid + 1 rule broken                         →  -5
 *   invalid + 2 rules broken                        → -10
 *   invalid + 3+ rules OR any critical violation    → -20
 */
export function eventScoreFor(
  verdict: AnalyzerVerdict,
  violations: unknown,
): number {
  if (verdict === "valid") return 5;
  if (verdict === "weak") return 0;

  if (isCritical(violations)) return -20;
  const n = violationCount(violations);
  if (n >= 3) return -20;
  if (n === 2) return -10;
  return -5; // 0 or 1 rule broken still counts as invalid → minor
}

/** Map [-20, +5] → [0, 100] linearly. */
export function normalizeEventScore(s: number): number {
  const clamped = Math.max(EVENT_SCORE_MIN, Math.min(EVENT_SCORE_MAX, s));
  return ((clamped - EVENT_SCORE_MIN) / (EVENT_SCORE_MAX - EVENT_SCORE_MIN)) *
    100;
}

/** Map score 0–100 → state thresholds. */
export function stateForScore(score: number): DisciplineState {
  if (score >= 80) return "in_control";
  if (score >= 60) return "slipping";
  if (score >= 40) return "at_risk";
  return "locked";
}

/** Weighted average. `values[0]` and `weights[0]` are the most recent. */
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

function reasonForEvent(e: EventRow, raw: number): string {
  if (e.verdict === "valid") return "Valid setup logged (+5).";
  if (e.verdict === "weak") return "Weak setup — neutral (0).";
  if (isCritical(e.violations)) {
    return `Critical violation (${raw}). Trading against bias / random entry.`;
  }
  const n = violationCount(e.violations);
  if (n >= 3) return `Severe — ${n} rules broken (${raw}).`;
  if (n === 2) return `Moderate — 2 rules broken (${raw}).`;
  return `Minor — 1 rule broken (${raw}).`;
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
    const raw = e.score_delta ?? eventScoreFor(e.verdict, e.violations);
    const value = normalizeEventScore(raw);
    return {
      source: "decision",
      id: e.id,
      value,
      weight: RECENCY_WEIGHTS[i] ?? 0,
      reason: reasonForEvent(e, raw),
      timestamp: e.created_at,
    };
  });

  // Anti-gaming: 5+ invalid in a row → extra -10 on the decision layer.
  let invalidStreak = 0;
  for (const e of evWindow) {
    if (e.verdict === "invalid") invalidStreak += 1;
    else break;
  }
  let decisionScore = decisionContribs.length === 0
    ? 50 // no evidence → neutral
    : weightedAverage(
        decisionContribs.map((c) => c.value),
        decisionContribs.map((c) => c.weight),
      );

  if (invalidStreak >= SPAM_THRESHOLD) {
    decisionScore = Math.max(0, decisionScore + SPAM_PENALTY);
    penalties.push({
      source: "decision",
      impact: SPAM_PENALTY,
      reason: `Analyzer spam — ${invalidStreak} invalid setups in a row.`,
      timestamp: evWindow[0]?.created_at ?? new Date().toISOString(),
    });
  }

  // ── Execution layer ───────────────────────────────────────────────────
  const trWindow = trades.slice(0, WINDOW_SIZE);
  const executionContribs: ScoreContribution[] = trWindow.map((t, i) => ({
    source: "execution",
    id: t.id,
    value: Math.max(0, Math.min(100, t.discipline_score)),
    weight: RECENCY_WEIGHTS[i] ?? 0,
    reason: reasonForTrade(t),
    timestamp: t.created_at,
  }));

  const executionNeutral = executionContribs.length === 0;
  let executionScore = executionNeutral
    ? 50 // no trades → neutral default per spec §5.2
    : weightedAverage(
        executionContribs.map((c) => c.value),
        executionContribs.map((c) => c.weight),
      );

  // Trade avoidance penalty: analyzed recently but no trades for >72h.
  if (
    !executionNeutral &&
    evWindow.length > 0 &&
    trWindow.length > 0
  ) {
    const lastEvent = new Date(evWindow[0].created_at).getTime();
    const lastTrade = new Date(trWindow[0].created_at).getTime();
    const gapHours = (lastEvent - lastTrade) / (1000 * 60 * 60);
    if (gapHours >= TRADE_AVOIDANCE_HOURS) {
      executionScore = Math.max(0, executionScore + TRADE_AVOIDANCE_PENALTY);
      penalties.push({
        source: "execution",
        impact: TRADE_AVOIDANCE_PENALTY,
        reason: `No trades for ${Math.round(gapHours)}h despite analyses — avoidance decay.`,
        timestamp: evWindow[0].created_at,
      });
    }
  } else if (
    executionNeutral &&
    evWindow.length > 0
  ) {
    // Analyzed but never traded → also nudge the neutral baseline down.
    const lastEvent = new Date(evWindow[0].created_at).getTime();
    const ageHours = (Date.now() - lastEvent) / (1000 * 60 * 60);
    if (ageHours >= TRADE_AVOIDANCE_HOURS) {
      executionScore = Math.max(0, executionScore + TRADE_AVOIDANCE_PENALTY);
      penalties.push({
        source: "execution",
        impact: TRADE_AVOIDANCE_PENALTY,
        reason: "Analyses logged but no trade executed — avoidance decay.",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Final ─────────────────────────────────────────────────────────────
  decisionScore = Math.max(0, Math.min(100, Math.round(decisionScore)));
  executionScore = Math.max(0, Math.min(100, Math.round(executionScore)));
  const score = Math.round(
    decisionScore * DECISION_WEIGHT + executionScore * EXECUTION_WEIGHT,
  );

  return {
    score,
    state: stateForScore(score),
    decision_score: decisionScore,
    decision_sample: decisionContribs.length,
    decision_contributions: decisionContribs,
    execution_score: executionScore,
    execution_sample: executionContribs.length,
    execution_contributions: executionContribs,
    penalties,
    execution_neutral: executionNeutral,
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
