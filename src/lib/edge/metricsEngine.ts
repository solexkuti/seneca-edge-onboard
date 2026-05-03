// BehaviorMetricsEngine — central derived-intelligence layer.
//
// Layer 2 in the Seneca Edge architecture:
//   Layer 1: raw data (trades, missed trades, rule_violations)
//   Layer 2: this file — pure computation
//   Layer 3: UI subscribes via useEdgeData
//
// All functions here are pure and safe with empty inputs. When there are
// no trades, baseline values are returned so the dashboard always renders.

import type { RuleViolationRow, TradeRow } from "./types";
import { isExecuted, isMissed } from "./types";

// ---------------- Types ----------------

export type PerformanceMetrics = {
  total_trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  win_rate: number;        // 0..1
  total_R: number;
  avg_R: number;
  avg_win_R: number;       // mean R of winning trades (>=0)
  avg_loss_R: number;      // mean |R| of losing trades (>=0)
  profit_factor: number;   // sum(wins) / |sum(losses)|, Infinity if no losses but wins
  expectancy: number;      // win_rate*avg_win - (1-win_rate)*avg_loss
  max_drawdown_R: number;  // peak-to-trough on the cumulative R curve, >=0
};

export type EquityPoint = {
  t: number;        // ms timestamp
  label: string;    // localized short label
  total_R: number;  // cumulative R after this trade
};

export type ViolationGroup = {
  rule: string;
  count: number;
  impact_R: number;          // signed (negative when costly)
  last_occurred_at: string | null;
};

export type BehaviorMetrics = {
  discipline_score: number;  // 0..100
  rule_adherence: number;    // 0..1
  total_violations: number;
  violations: ViolationGroup[]; // sorted by |impact_R| desc
  missed_count: number;
  missed_R: number;
};

export type TrendData = {
  equity_curve: EquityPoint[];   // chronological. Always has at least 1 point.
  rolling_win_rate: number[];    // last-10 win rate over time, 0..1
};

export type DerivedMetrics = {
  has_data: boolean;
  performance_metrics: PerformanceMetrics;
  behavior_metrics: BehaviorMetrics;
  trend_data: TrendData;
};

// ---------------- Helpers ----------------

const safeNum = (n: number | null | undefined, fallback = 0): number =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;

/** Closed R for a trade. Mirrors engine.ts so both layers agree. */
function tradeR(t: TradeRow): number {
  if (typeof t.rr === "number" && Number.isFinite(t.rr)) return t.rr;
  if (
    typeof t.pnl === "number" &&
    typeof t.risk_r === "number" &&
    t.risk_r !== 0
  ) {
    return t.pnl / Math.abs(t.risk_r);
  }
  if (t.result === "win") return 1;
  if (t.result === "loss") return -1;
  return 0;
}

// ---------------- Empty / baseline ----------------

const EMPTY_PERFORMANCE: PerformanceMetrics = {
  total_trades: 0,
  wins: 0,
  losses: 0,
  breakevens: 0,
  win_rate: 0,
  total_R: 0,
  avg_R: 0,
  avg_win_R: 0,
  avg_loss_R: 0,
  profit_factor: 0,
  expectancy: 0,
  max_drawdown_R: 0,
};

const EMPTY_BEHAVIOR: BehaviorMetrics = {
  discipline_score: 100,
  rule_adherence: 1,
  total_violations: 0,
  violations: [],
  missed_count: 0,
  missed_R: 0,
};

const EMPTY_TREND: TrendData = {
  equity_curve: [{ t: Date.now(), label: "", total_R: 0 }],
  rolling_win_rate: [],
};

export const EMPTY_DERIVED: DerivedMetrics = {
  has_data: false,
  performance_metrics: EMPTY_PERFORMANCE,
  behavior_metrics: EMPTY_BEHAVIOR,
  trend_data: EMPTY_TREND,
};

// ---------------- Performance ----------------

export function computePerformanceMetrics(trades: TradeRow[]): PerformanceMetrics {
  const executed = trades.filter(isExecuted);
  const closed = executed.filter(
    (t) => t.result === "win" || t.result === "loss" || t.result === "breakeven",
  );

  if (closed.length === 0) return { ...EMPTY_PERFORMANCE };

  const wins = closed.filter((t) => t.result === "win");
  const losses = closed.filter((t) => t.result === "loss");
  const breakevens = closed.filter((t) => t.result === "breakeven");

  const sumWinR = wins.reduce((s, t) => s + Math.max(0, tradeR(t)), 0);
  const sumLossR = losses.reduce((s, t) => s + tradeR(t), 0); // negative
  const totalR = closed.reduce((s, t) => s + tradeR(t), 0);

  const decided = wins.length + losses.length;
  const winRate = decided === 0 ? 0 : wins.length / decided;
  const avgWinR = wins.length === 0 ? 0 : sumWinR / wins.length;
  const avgLossR = losses.length === 0 ? 0 : Math.abs(sumLossR) / losses.length;
  const lossAbs = Math.abs(sumLossR);
  const profitFactor =
    lossAbs === 0 ? (sumWinR > 0 ? Number.POSITIVE_INFINITY : 0) : sumWinR / lossAbs;
  const expectancy = winRate * avgWinR - (1 - winRate) * avgLossR;

  // Max drawdown on cumulative R curve (chronological)
  const chrono = [...closed].sort((a, b) =>
    a.executed_at < b.executed_at ? -1 : 1,
  );
  let peak = 0;
  let cum = 0;
  let maxDD = 0;
  for (const t of chrono) {
    cum += tradeR(t);
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    total_trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    win_rate: winRate,
    total_R: totalR,
    avg_R: closed.length === 0 ? 0 : totalR / closed.length,
    avg_win_R: avgWinR,
    avg_loss_R: avgLossR,
    profit_factor: profitFactor,
    expectancy,
    max_drawdown_R: maxDD,
  };
}

// ---------------- Trend ----------------

export function computeTrendData(trades: TradeRow[]): TrendData {
  const closed = trades
    .filter(isExecuted)
    .filter((t) => t.result === "win" || t.result === "loss" || t.result === "breakeven")
    .sort((a, b) => (a.executed_at < b.executed_at ? -1 : 1));

  if (closed.length === 0) return { ...EMPTY_TREND };

  let cum = 0;
  const equity_curve: EquityPoint[] = [
    { t: new Date(closed[0].executed_at).getTime(), label: "Start", total_R: 0 },
  ];
  for (const t of closed) {
    cum += tradeR(t);
    const ts = new Date(t.executed_at).getTime();
    equity_curve.push({
      t: ts,
      label: new Date(ts).toLocaleDateString(),
      total_R: Number(cum.toFixed(3)),
    });
  }

  // Rolling 10-trade win rate
  const window = 10;
  const rolling: number[] = [];
  for (let i = 0; i < closed.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = closed.slice(start, i + 1);
    const decided = slice.filter(
      (t) => t.result === "win" || t.result === "loss",
    );
    const w = decided.filter((t) => t.result === "win").length;
    rolling.push(decided.length === 0 ? 0 : w / decided.length);
  }

  return { equity_curve, rolling_win_rate: rolling };
}

// ---------------- Behavior ----------------

export function computeBehaviorMetrics(
  trades: TradeRow[],
  violations: RuleViolationRow[],
): BehaviorMetrics {
  const executed = trades.filter(isExecuted);
  const missed = trades.filter(isMissed);

  if (executed.length === 0 && missed.length === 0 && violations.length === 0) {
    return { ...EMPTY_BEHAVIOR };
  }

  // Group violations by rule type
  const groups = new Map<string, ViolationGroup>();
  for (const v of violations) {
    const key = (v.type || "unknown").toLowerCase();
    const cur =
      groups.get(key) ??
      ({
        rule: key,
        count: 0,
        impact_R: 0,
        last_occurred_at: null as string | null,
      } as ViolationGroup);
    cur.count += 1;
    cur.impact_R += safeNum(v.impact_r, 0);
    if (!cur.last_occurred_at || v.occurred_at > cur.last_occurred_at) {
      cur.last_occurred_at = v.occurred_at;
    }
    groups.set(key, cur);
  }
  const grouped = Array.from(groups.values()).sort(
    (a, b) => Math.abs(b.impact_R) - Math.abs(a.impact_R) || b.count - a.count,
  );

  // Rule adherence: % of executed trades with no rules_broken
  const cleanCount = executed.filter(
    (t) => (t.rules_broken ?? []).length === 0,
  ).length;
  const ruleAdherence =
    executed.length === 0 ? 1 : cleanCount / executed.length;

  // Discipline score: start at 100, weight adherence + recent execution.
  // Mirrors engine.ts so the two stay aligned.
  const sortedDesc = [...executed].sort((a, b) =>
    a.executed_at < b.executed_at ? 1 : -1,
  );
  const recent = sortedDesc.slice(0, 10);
  const recentClean = recent.filter(
    (t) => (t.rules_broken ?? []).length === 0,
  ).length;
  const recentScore =
    recent.length === 0 ? 100 : (recentClean / recent.length) * 100;
  const disciplineScore =
    executed.length === 0
      ? 100
      : Math.round(0.6 * ruleAdherence * 100 + 0.4 * recentScore);

  const missedR = missed.reduce(
    (s, t) => s + safeNum(t.missed_potential_r, 0),
    0,
  );

  return {
    discipline_score: Math.max(0, Math.min(100, disciplineScore)),
    rule_adherence: ruleAdherence,
    total_violations: violations.length,
    violations: grouped,
    missed_count: missed.length,
    missed_R: missedR,
  };
}

// ---------------- Top-level engine ----------------

export function buildDerivedMetrics(
  trades: TradeRow[],
  violations: RuleViolationRow[],
): DerivedMetrics {
  if (trades.length === 0 && violations.length === 0) {
    return { ...EMPTY_DERIVED };
  }
  return {
    has_data: trades.length > 0,
    performance_metrics: computePerformanceMetrics(trades),
    behavior_metrics: computeBehaviorMetrics(trades, violations),
    trend_data: computeTrendData(trades),
  };
}

// ---------------- Color helpers (state → color) ----------------

export type StateTone = "profit" | "loss" | "warn" | "neutral";

export const STATE_COLOR: Record<StateTone, string> = {
  profit: "#22C55E",
  loss: "#EF4444",
  warn: "#FACC15",
  neutral: "#A1A1AA",
};

export function toneForScore(score: number): StateTone {
  if (score >= 75) return "profit";
  if (score >= 50) return "warn";
  return "loss";
}

export function toneForR(r: number): StateTone {
  if (r > 0) return "profit";
  if (r < 0) return "loss";
  return "neutral";
}

export function toneForRate(rate: number): StateTone {
  // rate is 0..1
  if (rate >= 0.55) return "profit";
  if (rate >= 0.45) return "warn";
  return "loss";
}

export function toneForProfitFactor(pf: number): StateTone {
  if (!Number.isFinite(pf)) return pf > 0 ? "profit" : "neutral";
  if (pf >= 1.5) return "profit";
  if (pf >= 1.0) return "warn";
  return "loss";
}
