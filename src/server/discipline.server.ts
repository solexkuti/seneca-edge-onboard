// SenecaEdge — server-only discipline + enforcement helpers.
//
// Pure scoring logic, intentionally duplicated from src/lib/disciplineScore.ts
// so the server bundle does NOT pull in the browser supabase client. The
// formula MUST stay in sync with the client one.

export const DECISION_WEIGHT = 0.4;
export const EXECUTION_WEIGHT = 0.6;
export const WINDOW_SIZE = 10;
export const RECENCY_WEIGHTS = [
  1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2,
];
export const EVENT_SCORE_MAX = 2;
export const EVENT_SCORE_MIN = -10;
export const SPAM_THRESHOLD = 5;
export const SPAM_PENALTY = -10;

const CRITICAL_VIOLATIONS = [
  "htf_bias", "against htf", "against trend", "no_entry", "no entry",
  "no clear entry", "random_entry", "random entry", "forced",
  "forced trade", "critical",
];

export type DisciplineStateName = "in_control" | "slipping" | "at_risk" | "locked";
export type AnalyzerVerdict = "valid" | "weak" | "invalid";
export type EventClass = "valid_clean" | "valid_weak" | "invalid" | "critical_invalid";

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

export function classifyEvent(verdict: AnalyzerVerdict, violations: unknown): EventClass {
  if (verdict === "valid") return "valid_clean";
  if (verdict === "weak") return "valid_weak";
  if (isCritical(violations)) return "critical_invalid";
  if (violationCount(violations) >= 3) return "critical_invalid";
  return "invalid";
}

export function scoreForClass(klass: EventClass): number {
  switch (klass) {
    case "valid_clean": return 2;
    case "valid_weak": return 0;
    case "invalid": return -5;
    case "critical_invalid": return -10;
  }
}

export function stateForScore(score: number): DisciplineStateName {
  if (score >= 80) return "in_control";
  if (score >= 60) return "slipping";
  if (score >= 40) return "at_risk";
  return "locked";
}

function normalizeDecision(rawValues: number[], weights: number[]): number {
  if (rawValues.length === 0) return 50;
  let weightedSum = 0, maxPossible = 0, minPossible = 0;
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

function weightedAverage(values: number[], weights: number[]): number {
  let sum = 0, wsum = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] ?? 0;
    sum += values[i] * w;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : 0;
}

export type ComputedDiscipline = {
  score: number;
  state: DisciplineStateName;
  decision_score: number;
  execution_score: number;
  decision_sample: number;
  execution_sample: number;
};

export type EventInput = { verdict: AnalyzerVerdict; violations: unknown; created_at: string };
export type TradeInput = { discipline_score: number; created_at: string };

export function computeDisciplineFromRows(
  events: EventInput[],
  trades: TradeInput[],
): ComputedDiscipline {
  const evWindow = events.slice(0, WINDOW_SIZE);
  const rawScores = evWindow.map((e) =>
    scoreForClass(classifyEvent(e.verdict, e.violations)),
  );
  const evWeights = evWindow.map((_, i) => RECENCY_WEIGHTS[i] ?? 0);
  let decisionScore = normalizeDecision(rawScores, evWeights);

  // Anti-spam streak penalty
  let streak = 0;
  for (const e of evWindow) {
    const k = classifyEvent(e.verdict, e.violations);
    if (k === "invalid" || k === "critical_invalid") streak += 1;
    else break;
  }
  if (streak >= SPAM_THRESHOLD) {
    decisionScore = Math.max(0, decisionScore + SPAM_PENALTY);
  }

  const trWindow = trades.slice(0, WINDOW_SIZE);
  const tradeValues = trWindow.map((t) => Math.max(0, Math.min(100, t.discipline_score)));
  const trWeights = trWindow.map((_, i) => RECENCY_WEIGHTS[i] ?? 0);
  const executionScore = trWindow.length === 0 ? 50 : weightedAverage(tradeValues, trWeights);

  const dr = Math.max(0, Math.min(100, Math.round(decisionScore)));
  const er = Math.max(0, Math.min(100, Math.round(executionScore)));
  const score = Math.round(dr * DECISION_WEIGHT + er * EXECUTION_WEIGHT);

  return {
    score,
    state: stateForScore(score),
    decision_score: dr,
    execution_score: er,
    decision_sample: evWindow.length,
    execution_sample: trWindow.length,
  };
}
