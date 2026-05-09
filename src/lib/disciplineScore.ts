// SenecaEdge Discipline Engine — deterministic behavior ledger.
// ==============================================================
//
// SINGLE FORMULA, shared with src/lib/behaviorEngine.ts:
//   Start:        100
//   Clean trade:  +5
//   Violation:    -10 per rule_break / synthetic risk violation
//   Clamp:        [0, 100]
//
// No averaging, no EMA, no normalization. This module is a legacy-compatible
// adapter around the centralized behavior engine so older UI can still consume
// DisciplineBreakdown without recomputing behavior independently.

import { supabase } from "@/integrations/supabase/client";
import type { AnalyzerVerdict } from "@/lib/analyzerEvents";
import {
  CLEAN_TRADE_RECOVERY,
  STARTING_OVERALL,
  VIOLATION_PENALTY,
  replay,
  stateFromOverall,
  type ReplayTradeInput,
} from "@/lib/behaviorEngine";

// ── Constants ───────────────────────────────────────────────────────────

export const STARTING_SCORE = STARTING_OVERALL;
export const CLEAN_TRADE_DELTA = CLEAN_TRADE_RECOVERY;
export const VIOLATION_DELTA = -VIOLATION_PENALTY;
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

// Legacy constants kept so existing imports compile. They are neutral in the
// deterministic ledger model.
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
  | "in_control" // >= 80
  | "slipping"   // 60–79
  | "at_risk"    // 40–59
  | "locked";    // < 40

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
  trade_id?: string;
  created_at?: string;
  executed_at?: string;
  rules_broken?: string[] | null;
  actual_risk_pct?: number | null;
  preferred_risk_pct?: number | null;
  followed_entry?: boolean;
  followed_exit?: boolean;
  followed_risk?: boolean;
  followed_behavior?: boolean;
  discipline_score?: number | null;
};

export type ScoreContribution = {
  source: "decision" | "execution";
  id: string;
  /** Signed score movement after clamping. */
  raw: number;
  /** Score AFTER this trade was applied (0–100). */
  value: number;
  weight: number;
  klass?: EventClass;
  reason: string;
  timestamp: string;
};

export type DisciplineBreakdown = {
  score: number;
  state: DisciplineState;
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
  total_trades: number;
  clean_trades: number;
  violation_count: number;
  /** Clean trades / total trades (0..1). 1 when no trades logged. */
  rule_adherence: number;
  /** Most recent trade contributions, newest-first, capped to 20. */
  recent_contributions: ScoreContribution[];
};

// ── Pure scoring helpers ────────────────────────────────────────────────

export function classifyEvent(_verdict: AnalyzerVerdict, _violations: unknown): EventClass {
  return "valid_weak";
}

export function scoreForClass(_klass: EventClass): number {
  return 0;
}

export function eventScoreFor(_verdict: AnalyzerVerdict, _violations: unknown): number {
  return 0;
}

export function stateForScore(score: number): DisciplineState {
  if (score >= 80) return "in_control";
  if (score >= 60) return "slipping";
  if (score >= 40) return "at_risk";
  return "locked";
}

function rulesFromLegacyFlags(t: TradeLogRow): string[] {
  const out: string[] = [];
  if (t.followed_entry === false) out.push("entry_rule");
  if (t.followed_exit === false) out.push("exit_rule");
  if (t.followed_risk === false) out.push("risk_rule");
  if (t.followed_behavior === false) out.push("behavior_rule");
  return out;
}

function toReplayInput(t: TradeLogRow): ReplayTradeInput {
  const rules = Array.isArray(t.rules_broken) ? t.rules_broken : rulesFromLegacyFlags(t);
  return {
    id: t.id,
    executed_at: String(t.executed_at ?? t.created_at ?? new Date().toISOString()),
    rulesBroken: rules,
    actualRisk: t.actual_risk_pct ?? null,
    preferredRisk: t.preferred_risk_pct ?? null,
  };
}

// ── Composition (pure) ──────────────────────────────────────────────────

export function buildBreakdown(_events: EventRow[], trades: TradeLogRow[]): DisciplineBreakdown {
  const result = replay(trades.map(toReplayInput));
  const recent = result.contributions.map((c) => ({
    source: "execution" as const,
    id: c.id,
    raw: c.delta,
    value: c.overallAfter,
    weight: 1,
    reason: c.reason,
    timestamp: c.timestamp,
  })).slice(0, 20);

  return {
    score: result.overall,
    state: stateForScore(result.overall),
    decision_score: result.overall,
    decision_sample: result.totalTrades,
    decision_contributions: [],
    execution_score: result.overall,
    execution_sample: result.totalTrades,
    execution_contributions: recent,
    penalties: result.contributions
      .filter((c) => !c.isClean)
      .map((c) => ({ source: "execution" as const, impact: c.rawDelta, reason: c.reason, timestamp: c.timestamp })),
    execution_neutral: result.totalTrades === 0,
    decision_neutral: result.totalTrades === 0,
    total_trades: result.totalTrades,
    clean_trades: result.cleanTrades,
    violation_count: result.violationCount,
    rule_adherence: result.ruleAdherence,
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
    .from("trades")
    .select("id,rules_broken,actual_risk_pct,preferred_risk_pct,executed_at")
    .eq("user_id", uid)
    .eq("trade_type", "executed")
    .order("executed_at", { ascending: false })
    .limit(500);

  if (error) {
    console.warn("[discipline] failed to load trades:", error);
    return { events: [], trades: [] };
  }
  return { events: [], trades: (data ?? []) as unknown as TradeLogRow[] };
}

export async function loadDisciplineBreakdown(): Promise<DisciplineBreakdown> {
  const { events, trades } = await fetchScoringInputs();
  return buildBreakdown(events, trades);
}
