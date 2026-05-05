// SenecaEdge Discipline Engine — Cumulative +10 / -10
// =====================================================
//
// SINGLE FORMULA. NO HIDDEN LOGIC. NO RECENCY WEIGHTING.
//
//   Start:        100
//   Clean trade:  +10  (trade with zero rule violations)
//   Violation:    -10  per rule_break entry on a trade
//   Clamp:        [0, 100]
//
// The score is CUMULATIVE across the user's lifetime trades. It is NOT a
// per-trade score and it is NOT recency-weighted. The number on screen is
// the result of replaying every logged trade's discipline impact on top
// of a 100-point baseline.
//
// Source of truth: `discipline_logs` (one row per logged trade). A trade
// is "clean" when followed_entry AND followed_exit AND followed_risk AND
// followed_behavior. Every `false` flag counts as one rule violation.
//
// Behavior Score = Discipline Score (no second formula).
// Rule Adherence = clean_trades / total_trades.

import { supabase } from "@/integrations/supabase/client";
import type { AnalyzerVerdict } from "@/lib/analyzerEvents";

// ── Constants ───────────────────────────────────────────────────────────

export const STARTING_SCORE = 100;
export const CLEAN_TRADE_DELTA = +10;
export const VIOLATION_DELTA = -10;
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

// Legacy constants kept so existing imports compile. Not used in the new
// formula but referenced by older trace components.
export const DECISION_WEIGHT = 1;
export const EXECUTION_WEIGHT = 1;
export const WINDOW_SIZE = 10;
export const RECENCY_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
export const EVENT_SCORE_MAX = 0;
export const EVENT_SCORE_MIN = 0;
export const SPAM_THRESHOLD = 999;
export const SPAM_PENALTY = 0;
export const CRITICAL_VIOLATIONS: string[] = [];

// ── Types ───────────────────────────────────────────────────────────────

export type DisciplineState =
  | "in_control" //  >= 80
  | "slipping"   //  60–79
  | "at_risk"    //  40–59
  | "locked";    //  < 40

export type EventClass =
  | "valid_clean"
  | "valid_weak"
  | "invalid"
  | "critical_invalid";

export type EventRow = {
  id: string;
  verdict: AnalyzerVerdict;
  violations: unknown;
  score_delta: number | null;
  created_at: string;
};

export type TradeLogRow = {
  id: string;
  trade_id: string;
  discipline_score: number;
  followed_entry: boolean;
  followed_exit: boolean;
  followed_risk: boolean;
  followed_behavior: boolean;
  created_at: string;
};

export type ScoreContribution = {
  source: "decision" | "execution";
  id: string;
  /** Signed delta applied to the cumulative score (+10 / -10 / -20 ...). */
  raw: number;
  /** Score AFTER this trade was applied (0–100). */
  value: number;
  weight: number;
  klass?: EventClass;
  reason: string;
  timestamp: string;
};

export type DisciplineBreakdown = {
  /** Final cumulative score 0–100. */
  score: number;
  state: DisciplineState;

  // Mirror fields — kept to satisfy existing UI consumers.
  // In the cumulative model, behavior == discipline.
  decision_score: number;
  decision_sample: number;
  decision_contributions: ScoreContribution[];

  execution_score: number;
  execution_sample: number;
  execution_contributions: ScoreContribution[];

  penalties: Array<{
    source: "decision" | "execution";
    impact: number;
    reason: string;
    timestamp: string;
  }>;

  execution_neutral: boolean;
  decision_neutral: boolean;

  // ── New SSOT-aligned fields ──
  total_trades: number;
  clean_trades: number;
  violation_count: number;
  /** Clean trades / total trades (0..1). 1 when no trades logged. */
  rule_adherence: number;
  /** Most recent trade contributions, newest-first, capped to 20. */
  recent_contributions: ScoreContribution[];
};

// ── Pure scoring helpers ────────────────────────────────────────────────

export function classifyEvent(
  _verdict: AnalyzerVerdict,
  _violations: unknown,
): EventClass {
  // Analyzer events no longer mutate the discipline score in the cumulative
  // model. Always returns a neutral class.
  return "valid_weak";
}

export function scoreForClass(_klass: EventClass): number {
  return 0;
}

export function eventScoreFor(
  _verdict: AnalyzerVerdict,
  _violations: unknown,
): number {
  return 0;
}

export function stateForScore(score: number): DisciplineState {
  if (score >= 80) return "in_control";
  if (score >= 60) return "slipping";
  if (score >= 40) return "at_risk";
  return "locked";
}

function clamp(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));
}

function violationsOnTrade(t: TradeLogRow): number {
  let n = 0;
  if (!t.followed_entry) n++;
  if (!t.followed_exit) n++;
  if (!t.followed_risk) n++;
  if (!t.followed_behavior) n++;
  return n;
}

function reasonForTrade(t: TradeLogRow, delta: number, after: number): string {
  if (delta > 0) return `Clean trade — all rules followed (+10 → ${after}/100).`;
  const broken: string[] = [];
  if (!t.followed_entry) broken.push("entry");
  if (!t.followed_exit) broken.push("exit");
  if (!t.followed_risk) broken.push("risk");
  if (!t.followed_behavior) broken.push("behavior");
  return `${broken.length} rule break${broken.length === 1 ? "" : "s"} — ${broken.join(", ")} (${delta} → ${after}/100).`;
}

// ── Composition (pure) ──────────────────────────────────────────────────

/**
 * Replay every trade in chronological order to produce the cumulative
 * discipline score. Pass `trades` newest-first (matches the DB query order
 * used elsewhere); we'll reverse internally for replay.
 */
export function buildBreakdown(
  _events: EventRow[],
  trades: TradeLogRow[],
): DisciplineBreakdown {
  const total = trades.length;

  // Chronological replay — oldest first.
  const chrono = [...trades].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let score = STARTING_SCORE;
  let cleanCount = 0;
  let violationCount = 0;

  const contribs: ScoreContribution[] = [];
  for (const t of chrono) {
    const v = violationsOnTrade(t);
    let delta: number;
    if (v === 0) {
      delta = CLEAN_TRADE_DELTA;
      cleanCount += 1;
    } else {
      delta = VIOLATION_DELTA * v;
      violationCount += v;
    }
    score = clamp(score + delta);
    contribs.push({
      source: "execution",
      id: t.id,
      raw: delta,
      value: score,
      weight: 1,
      reason: reasonForTrade(t, delta, score),
      timestamp: t.created_at,
    });
  }

  // Newest-first slice for UI.
  const recent = [...contribs].reverse().slice(0, 20);
  const adherence = total === 0 ? 1 : cleanCount / total;

  return {
    score,
    state: stateForScore(score),
    decision_score: score,
    decision_sample: total,
    decision_contributions: [],
    execution_score: score,
    execution_sample: total,
    execution_contributions: recent,
    penalties: [],
    execution_neutral: total === 0,
    decision_neutral: total === 0,
    total_trades: total,
    clean_trades: cleanCount,
    violation_count: violationCount,
    rule_adherence: adherence,
    recent_contributions: recent,
  };
}

// ── I/O ────────────────────────────────────────────────────────────────

export async function fetchScoringInputs(): Promise<{
  events: EventRow[];
  trades: TradeLogRow[];
}> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { events: [], trades: [] };

  const { data, error } = await supabase
    .from("discipline_logs")
    .select(
      "id,trade_id,discipline_score,followed_entry,followed_exit,followed_risk,followed_behavior,created_at",
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.warn("[discipline] failed to load discipline_logs:", error);
    return { events: [], trades: [] };
  }
  return { events: [], trades: (data ?? []) as unknown as TradeLogRow[] };
}

export async function loadDisciplineBreakdown(): Promise<DisciplineBreakdown> {
  const { events, trades } = await fetchScoringInputs();
  return buildBreakdown(events, trades);
}
