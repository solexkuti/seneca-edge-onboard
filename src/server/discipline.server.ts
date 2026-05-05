// SenecaEdge — server-only discipline helpers.
//
// SINGLE FORMULA, identical to src/lib/disciplineScore.ts:
//   start 100, +10 clean trade, -10 per rule break, clamp [0, 100].
//
// `events` are no longer used in the score formula; the parameter is kept
// for back-compat with older call sites.

export const STARTING_SCORE = 100;
export const CLEAN_TRADE_DELTA = +10;
export const VIOLATION_DELTA = -10;
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

// Legacy constants — referenced by older imports.
export const DECISION_WEIGHT = 1;
export const EXECUTION_WEIGHT = 1;
export const WINDOW_SIZE = 10;
export const RECENCY_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
export const EVENT_SCORE_MAX = 0;
export const EVENT_SCORE_MIN = 0;
export const SPAM_THRESHOLD = 999;
export const SPAM_PENALTY = 0;

export type DisciplineStateName = "in_control" | "slipping" | "at_risk" | "locked";
export type AnalyzerVerdict = "valid" | "weak" | "invalid";
export type EventClass = "valid_clean" | "valid_weak" | "invalid" | "critical_invalid";

export function classifyEvent(_v: AnalyzerVerdict, _x: unknown): EventClass {
  return "valid_weak";
}
export function scoreForClass(_k: EventClass): number {
  return 0;
}

export function stateForScore(score: number): DisciplineStateName {
  if (score >= 80) return "in_control";
  if (score >= 60) return "slipping";
  if (score >= 40) return "at_risk";
  return "locked";
}

function clamp(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));
}

export type ComputedDiscipline = {
  score: number;
  state: DisciplineStateName;
  decision_score: number;
  execution_score: number;
  decision_sample: number;
  execution_sample: number;
};

export type EventInput = {
  verdict: AnalyzerVerdict;
  violations: unknown;
  created_at: string;
};

export type TradeInput = {
  followed_entry?: boolean;
  followed_exit?: boolean;
  followed_risk?: boolean;
  followed_behavior?: boolean;
  discipline_score?: number;
  created_at: string;
};

function violationsOn(t: TradeInput): number {
  let n = 0;
  if (t.followed_entry === false) n++;
  if (t.followed_exit === false) n++;
  if (t.followed_risk === false) n++;
  if (t.followed_behavior === false) n++;
  return n;
}

export function computeDisciplineFromRows(
  _events: EventInput[],
  trades: TradeInput[],
): ComputedDiscipline {
  // Replay chronologically (oldest first).
  const chrono = [...trades].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let score = STARTING_SCORE;
  for (const t of chrono) {
    const v = violationsOn(t);
    score = clamp(score + (v === 0 ? CLEAN_TRADE_DELTA : VIOLATION_DELTA * v));
  }

  const total = trades.length;
  return {
    score,
    state: stateForScore(score),
    decision_score: score,
    execution_score: score,
    decision_sample: total,
    execution_sample: total,
  };
}
