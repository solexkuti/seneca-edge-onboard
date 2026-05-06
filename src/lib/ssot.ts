// SenecaEdge SSOT — Single Source of Truth
// =========================================
//
// Every UI surface (dashboard, behavior breakdown, mentor, alerts, snapshot,
// trends) MUST derive its numbers from this module. No component is allowed
// to compute win rate / profit factor / drawdown / expectancy on its own.
//
// Composition:
//   account     ← profiles.account_balance + balance_source
//   trades[]    ← public.trades (executed only)
//   metrics     ← derived from trades (win rate, avg R, PF, drawdown, expectancy)
//   behavior    ← discipline_logs replay → discipline score, rule adherence
//
// AI mentor + alerts read this object. They never query the DB themselves.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  loadDisciplineBreakdown,
  type DisciplineBreakdown,
} from "@/lib/disciplineScore";
import { getRate } from "@/lib/fxService";
import { replay as replayBehavior, type ReplayTradeInput } from "@/lib/behaviorEngine";

export type BalanceSource = "manual" | "synced";

export type MetricDisplayMode = "rr_only" | "rr_plus_currency" | "currency_only";

export type SsotAccount = {
  balance: number | null;
  equity: number | null;
  source: BalanceSource;
  updated_at: string | null;
  /** Canonical BASE currency for this account (used for monetary_pnl_base). */
  currency: string;
  /** User's chosen DISPLAY currency. May differ from base. */
  display_currency: string;
  /** RR / RR+currency / currency-only metric rendering preference. */
  metric_display_mode: MetricDisplayMode;
  risk_per_trade: number | null;
};

export type SsotTrade = {
  id: string;
  asset: string | null;
  market: string;
  direction: "long" | "short";
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rr: number | null;
  risk_r: number | null;
  pnl: number | null;
  result: "win" | "loss" | "breakeven" | null;
  session: "London" | "NY" | "Asia" | null;
  executed_at: string;
  closed_at: string | null;
  trade_type: "executed" | "missed";
  missed_reason: string | null;
  missed_potential_r: number | null;
  rules_broken: string[];
  notes: string | null;
  /** Immutable FX snapshot — frozen at trade close. */
  monetary_pnl_base: number | null;
  monetary_pnl_converted_snapshot: number | null;
  exchange_rate_at_close: number | null;
  display_currency_at_close: string | null;
  /** Actual % risk used on this execution. */
  actual_risk_pct: number | null;
  /** Preferred % risk per the user's strategy/account policy at the time. */
  preferred_risk_pct: number | null;
};

export function tradeMonetaryConverted(
  trade: { rr: number | null; monetary_pnl_converted_snapshot: number | null; monetary_pnl_base: number | null },
  analytics: { exchange_rate: number },
  riskPerTrade: number | null,
): number | null {
  if (trade.monetary_pnl_converted_snapshot != null) return trade.monetary_pnl_converted_snapshot;
  if (trade.monetary_pnl_base != null) return trade.monetary_pnl_base * analytics.exchange_rate;
  if (trade.rr == null || riskPerTrade == null || !Number.isFinite(riskPerTrade) || riskPerTrade <= 0) return null;
  return trade.rr * riskPerTrade * analytics.exchange_rate;
}


export type SsotViolation = {
  id: string;
  trade_id: string;
  type: string;
  impact_r: number;
  session: string | null;
  occurred_at: string;
};

export type SsotSessionStat = {
  session: "London" | "NY" | "Asia";
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_r: number;
  assets: string[];
  violations: number;
  missed: number;
};

export type SsotMetrics = {
  total_trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  win_rate: number;        // 0..1
  avg_r: number;           // mean of rr where result = win/loss
  profit_factor: number;   // sum(wins R) / |sum(losses R)|, ∞ when no losses
  expectancy_r: number;    // win_rate*avg_win_r - loss_rate*avg_loss_r
  max_drawdown_r: number;  // peak-to-trough on cumulative R
  total_r: number;
  best_session: SsotTrade["session"] | null;
  worst_rule_break: string | null;
};

export type SsotBehavior = {
  discipline_score: number;          // 0..100
  rule_adherence: number;            // 0..1 → clean / total
  clean_trades: number;
  total_trades: number;
  violation_count: number;
  recent_violations: { type: string; count: number }[];
};

export type SsotAnalytics = {
  base_currency: string;
  display_currency: string;
  exchange_rate: number;            // base → display
  total_r: number;
  expectancy_r: number;
  avg_r: number;
  max_drawdown_r: number;
  /** R × risk_per_trade in BASE currency. Null when risk basis missing. */
  total_pnl_base: number | null;
  total_pnl_converted: number | null;
  expectancy_currency: number | null;
  avg_r_currency: number | null;
  max_drawdown_currency: number | null;
  /** Immutable starting capital from profiles.account_balance (base ccy). */
  starting_balance_base: number | null;
  /** starting_balance + total_pnl_base. Live equity, base ccy. */
  equity_base: number | null;
  equity_converted: number | null;
};

export type Ssot = {
  loading: boolean;
  user_id: string | null;
  account: SsotAccount;
  /** All executed trades, newest-first. */
  trades: SsotTrade[];
  /** Missed setups (trade_type='missed'), newest-first. */
  missed: SsotTrade[];
  metrics: SsotMetrics;
  behavior: SsotBehavior;
  violations: SsotViolation[];
  session_performance: SsotSessionStat[];
  execution_type: {
    controlled_pct: number;
    semi_controlled_pct: number;
    impulsive_pct: number;
    controlled: number;
    semi_controlled: number;
    impulsive: number;
    missed: number;
    executed_total: number;
  };
  /** Centralized monetary analytics. Single source for all live currency renders. */
  analytics: SsotAnalytics;
  /** Underlying discipline breakdown — kept for legacy UI consumers. */
  discipline: DisciplineBreakdown;
};

export const EMPTY_ANALYTICS: SsotAnalytics = {
  base_currency: "USD",
  display_currency: "USD",
  exchange_rate: 1,
  total_r: 0,
  expectancy_r: 0,
  avg_r: 0,
  max_drawdown_r: 0,
  total_pnl_base: null,
  total_pnl_converted: null,
  expectancy_currency: null,
  avg_r_currency: null,
  max_drawdown_currency: null,
  starting_balance_base: null,
  equity_base: null,
  equity_converted: null,
};

export const EMPTY_METRICS: SsotMetrics = {
  total_trades: 0,
  wins: 0,
  losses: 0,
  breakevens: 0,
  win_rate: 0,
  avg_r: 0,
  profit_factor: 0,
  expectancy_r: 0,
  max_drawdown_r: 0,
  total_r: 0,
  best_session: null,
  worst_rule_break: null,
};

export const EMPTY_ACCOUNT: SsotAccount = {
  balance: null,
  equity: null,
  source: "manual",
  updated_at: null,
  currency: "USD",
  display_currency: "USD",
  metric_display_mode: "rr_plus_currency",
  risk_per_trade: null,
};

// ── Pure computations ──────────────────────────────────────────────────

export function computeMetrics(trades: SsotTrade[]): SsotMetrics {
  const total = trades.length;
  if (total === 0) return EMPTY_METRICS;

  let wins = 0,
    losses = 0,
    breakevens = 0;
  let sumWinR = 0,
    sumLossR = 0;
  let sumR = 0,
    sampledR = 0;

  // Chronological for drawdown
  const chrono = [...trades].sort(
    (a, b) =>
      new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
  );

  // Cumulative R + drawdown
  let peak = 0,
    cum = 0,
    maxDD = 0;
  const sessionR: Record<string, number> = {};

  for (const t of chrono) {
    const r = t.rr ?? null;
    if (r != null && Number.isFinite(r)) {
      cum += r;
      sumR += r;
      sampledR += 1;
      peak = Math.max(peak, cum);
      maxDD = Math.max(maxDD, peak - cum);
    }
    if (t.result === "win") {
      wins += 1;
      if (r != null) sumWinR += r;
    } else if (t.result === "loss") {
      losses += 1;
      if (r != null) sumLossR += r; // r is typically negative for losses
    } else if (t.result === "breakeven") {
      breakevens += 1;
    }
    if (t.session && r != null) {
      sessionR[t.session] = (sessionR[t.session] ?? 0) + r;
    }
  }

  const decided = wins + losses;
  const win_rate = decided > 0 ? wins / decided : 0;
  const avg_r = sampledR > 0 ? sumR / sampledR : 0;
  const grossLoss = Math.abs(Math.min(0, sumLossR));
  const grossWin = Math.max(0, sumWinR);
  const profit_factor =
    grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const avgWinR = wins > 0 ? sumWinR / wins : 0;
  const avgLossR = losses > 0 ? sumLossR / losses : 0;
  const expectancy_r = win_rate * avgWinR - (1 - win_rate) * Math.abs(avgLossR);

  let best_session: SsotTrade["session"] | null = null;
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(sessionR)) {
    if (v > bestVal) {
      bestVal = v;
      best_session = k as SsotTrade["session"];
    }
  }

  return {
    total_trades: total,
    wins,
    losses,
    breakevens,
    win_rate,
    avg_r,
    profit_factor,
    expectancy_r,
    max_drawdown_r: maxDD,
    total_r: sumR,
    best_session,
    worst_rule_break: null, // populated by behavior loader
  };
}

// ── Currency / monetary helpers ────────────────────────────────────────

export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
  JPY: "¥",
  CAD: "$",
  AUD: "$",
  CHF: "CHF ",
};

/** Format a number as currency using the SSOT account currency. */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "USD",
  opts: { showSign?: boolean } = {},
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const sym = CURRENCY_SYMBOL[currency] ?? "";
  const sign = amount > 0 && opts.showSign ? "+" : amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const digits = currency === "JPY" ? 0 : 2;
  return `${sign}${sym}${abs.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Convert an R value to monetary using risk_per_trade. Returns null when risk basis is missing. */
export function rToCurrency(r: number | null, riskPerTrade: number | null): number | null {
  if (r == null || !Number.isFinite(r)) return null;
  if (riskPerTrade == null || !Number.isFinite(riskPerTrade) || riskPerTrade <= 0) return null;
  return r * riskPerTrade;
}


// ── I/O ────────────────────────────────────────────────────────────────

async function loadAccount(userId: string): Promise<SsotAccount> {
  const { data: prof } = await supabase
    .from("profiles")
    .select(
      "account_balance,account_equity,balance_source,balance_updated_at,currency,risk_per_trade,display_currency,metric_display_mode",
    )
    .eq("id", userId)
    .maybeSingle();
  const p = (prof as Record<string, unknown> | null) ?? {};
  const profileCurrency = ((p.currency as string | null) ?? "USD") || "USD";
  const profileRisk = (p.risk_per_trade as number | null) ?? null;
  const displayCurrency = ((p.display_currency as string | null) ?? profileCurrency) || profileCurrency;
  const metricMode = ((p.metric_display_mode as MetricDisplayMode | null) ?? "rr_plus_currency");

  const { data: acct } = await supabase
    .from("accounts")
    .select("balance,equity,source,updated_at,currency,risk_per_trade")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (acct) {
    const a = acct as Record<string, unknown>;
    return {
      balance: (a.balance as number | null) ?? null,
      equity: (a.equity as number | null) ?? null,
      source: ((a.source as BalanceSource) ?? "manual") as BalanceSource,
      updated_at: (a.updated_at as string | null) ?? null,
      currency: ((a.currency as string | null) ?? profileCurrency) || "USD",
      display_currency: displayCurrency,
      metric_display_mode: metricMode,
      risk_per_trade: (a.risk_per_trade as number | null) ?? profileRisk,
    };
  }
  if (!prof) {
    return {
      ...EMPTY_ACCOUNT,
      currency: profileCurrency,
      display_currency: displayCurrency,
      metric_display_mode: metricMode,
      risk_per_trade: profileRisk,
    };
  }
  return {
    balance: (p.account_balance as number | null) ?? null,
    equity: (p.account_equity as number | null) ?? null,
    source: ((p.balance_source as BalanceSource) ?? "manual"),
    updated_at: (p.balance_updated_at as string | null) ?? null,
    currency: profileCurrency,
    display_currency: displayCurrency,
    metric_display_mode: metricMode,
    risk_per_trade: profileRisk,
  };
}

async function loadAllTrades(userId: string): Promise<SsotTrade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(
      "id,asset,market,direction,entry_price,exit_price,stop_loss,take_profit,rr,risk_r,pnl,result,session,executed_at,closed_at,trade_type,missed_reason,missed_potential_r,rules_broken,notes,monetary_pnl_base,monetary_pnl_converted_snapshot,exchange_rate_at_close,display_currency_at_close",
    )
    .eq("user_id", userId)
    .order("executed_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return (data as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    asset: (r.asset as string | null) ?? null,
    market: String(r.market ?? ""),
    direction: r.direction as "long" | "short",
    entry_price: r.entry_price as number | null,
    exit_price: r.exit_price as number | null,
    stop_loss: r.stop_loss as number | null,
    take_profit: r.take_profit as number | null,
    rr: r.rr as number | null,
    risk_r: r.risk_r as number | null,
    pnl: r.pnl as number | null,
    result: r.result as SsotTrade["result"],
    session: r.session as SsotTrade["session"],
    executed_at: String(r.executed_at),
    closed_at: r.closed_at as string | null,
    trade_type: (r.trade_type as "executed" | "missed") ?? "executed",
    missed_reason: (r.missed_reason as string | null) ?? null,
    missed_potential_r: (r.missed_potential_r as number | null) ?? null,
    rules_broken: Array.isArray(r.rules_broken) ? (r.rules_broken as string[]) : [],
    notes: (r.notes as string | null) ?? null,
    monetary_pnl_base: (r.monetary_pnl_base as number | null) ?? null,
    monetary_pnl_converted_snapshot: (r.monetary_pnl_converted_snapshot as number | null) ?? null,
    exchange_rate_at_close: (r.exchange_rate_at_close as number | null) ?? null,
    display_currency_at_close: (r.display_currency_at_close as string | null) ?? null,
  }));
}

async function loadViolations(userId: string): Promise<SsotViolation[]> {
  const { data, error } = await supabase
    .from("rule_violations")
    .select("id,trade_id,type,impact_r,session,occurred_at")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    trade_id: String(r.trade_id),
    type: String(r.type),
    impact_r: Number(r.impact_r ?? 0),
    session: (r.session as string | null) ?? null,
    occurred_at: String(r.occurred_at),
  }));
}

function buildSessionPerformance(
  executed: SsotTrade[],
  missed: SsotTrade[],
  violations: SsotViolation[],
): SsotSessionStat[] {
  const sessions: Array<"London" | "NY" | "Asia"> = ["London", "NY", "Asia"];
  return sessions.map((s) => {
    const sx = executed.filter((t) => t.session === s);
    const wins = sx.filter((t) => t.result === "win").length;
    const losses = sx.filter((t) => t.result === "loss").length;
    const decided = wins + losses;
    const totalR = sx.reduce((a, t) => a + (typeof t.rr === "number" ? t.rr : 0), 0);
    const assets = Array.from(
      new Set(sx.map((t) => t.asset || t.market).filter(Boolean) as string[]),
    ).slice(0, 6);
    return {
      session: s,
      total_trades: sx.length,
      wins,
      losses,
      win_rate: decided > 0 ? wins / decided : 0,
      total_r: totalR,
      assets,
      violations: violations.filter((v) => v.session === s).length,
      missed: missed.filter((t) => t.session === s).length,
    };
  });
}

function buildExecutionType(
  executed: SsotTrade[],
  missed: SsotTrade[],
): Ssot["execution_type"] {
  const total = executed.length;
  if (total === 0) {
    return {
      controlled_pct: 0,
      semi_controlled_pct: 0,
      impulsive_pct: 0,
      controlled: 0,
      semi_controlled: 0,
      impulsive: 0,
      missed: missed.length,
      executed_total: 0,
    };
  }
  let controlled = 0;
  let semi = 0;
  let impulsive = 0;
  for (const t of executed) {
    const n = t.rules_broken?.length ?? 0;
    if (n === 0) controlled += 1;
    else if (n === 1) semi += 1;
    else impulsive += 1;
  }
  return {
    controlled_pct: Math.round((controlled / total) * 100),
    semi_controlled_pct: Math.round((semi / total) * 100),
    impulsive_pct: Math.round((impulsive / total) * 100),
    controlled,
    semi_controlled: semi,
    impulsive,
    missed: missed.length,
    executed_total: total,
  };
}

async function loadWorstRuleBreak(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("rule_violations")
    .select("type")
    .eq("user_id", userId)
    .limit(500);
  if (error || !data || data.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const row of data) {
    const t = (row as { type: string }).type;
    counts[t] = (counts[t] ?? 0) + 1;
  }
  let worst: string | null = null;
  let n = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > n) {
      n = v;
      worst = k;
    }
  }
  return worst;
}

type ViewBundle = {
  metrics: Database["public"]["Views"]["metrics"]["Row"] | null;
  expectancy: Database["public"]["Views"]["expectancy"]["Row"] | null;
  drawdown: Database["public"]["Views"]["drawdown"]["Row"] | null;
  adherence: Database["public"]["Views"]["rule_adherence"]["Row"] | null;
  discipline: Database["public"]["Views"]["discipline"]["Row"] | null;
};

async function loadComputedViews(userId: string): Promise<ViewBundle> {
  const [m, e, d, a, disc] = await Promise.all([
    supabase.from("metrics").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("expectancy").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("drawdown").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("rule_adherence").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("discipline").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    metrics: m.data ?? null,
    expectancy: e.data ?? null,
    drawdown: d.data ?? null,
    adherence: a.data ?? null,
    discipline: disc.data ?? null,
  };
}

function metricsFromViews(v: ViewBundle, bestSession: SsotTrade["session"] | null): SsotMetrics {
  const m = v.metrics;
  if (!m || !m.total_trades) return { ...EMPTY_METRICS, best_session: bestSession };
  const pf = Number(m.profit_factor ?? 0);
  return {
    total_trades: Number(m.total_trades ?? 0),
    wins: Number(m.wins ?? 0),
    losses: Number(m.losses ?? 0),
    breakevens: Number(m.breakevens ?? 0),
    win_rate: Number(m.win_rate ?? 0),
    avg_r: Number(m.avg_r ?? 0),
    profit_factor: pf >= 999999 ? Infinity : pf,
    expectancy_r: Number(v.expectancy?.expectancy_r ?? 0),
    max_drawdown_r: Number(v.drawdown?.max_drawdown_r ?? 0),
    total_r: Number(m.total_r ?? 0),
    best_session: bestSession,
    worst_rule_break: null,
  };
}

function bestSessionFromTrades(trades: SsotTrade[]): SsotTrade["session"] | null {
  const sessionR: Record<string, number> = {};
  for (const t of trades) {
    if (t.session && t.rr != null) {
      sessionR[t.session] = (sessionR[t.session] ?? 0) + t.rr;
    }
  }
  let best: SsotTrade["session"] | null = null;
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(sessionR)) {
    if (v > bestVal) {
      bestVal = v;
      best = k as SsotTrade["session"];
    }
  }
  return best;
}

export async function loadSsot(): Promise<Ssot> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  if (!uid) {
    const empty = await loadDisciplineBreakdown();
    return {
      loading: false,
      user_id: null,
      account: EMPTY_ACCOUNT,
      trades: [],
      missed: [],
      metrics: EMPTY_METRICS,
      behavior: {
        discipline_score: empty.score,
        rule_adherence: 1,
        clean_trades: 0,
        total_trades: 0,
        violation_count: 0,
        recent_violations: [],
      },
      violations: [],
      session_performance: buildSessionPerformance([], [], []),
      execution_type: buildExecutionType([], []),
      analytics: EMPTY_ANALYTICS,
      discipline: empty,
    };
  }

  const [account, allTrades, breakdown, worstBreak, violations] = await Promise.all([
    loadAccount(uid),
    loadAllTrades(uid),
    loadDisciplineBreakdown(),
    loadWorstRuleBreak(uid),
    loadViolations(uid),
  ]);
  // metricsFromViews / loadComputedViews kept available but unused — metrics
  // are now computed directly from trades to keep collapsed and expanded
  // numbers identical and to avoid stale view-driven drawdown.
  void metricsFromViews;
  void loadComputedViews;

  const executed = allTrades.filter((t) => t.trade_type === "executed");
  const missed = allTrades.filter((t) => t.trade_type === "missed");

  const bestSession = bestSessionFromTrades(executed);
  // Compute metrics directly from trades — no stale views.
  const metrics: SsotMetrics = { ...computeMetrics(executed), best_session: bestSession };
  metrics.worst_rule_break = worstBreak;

  // Derive violation rows from trades.rules_broken so impact = trade R for
  // every (trade, rule) row, keeping aggregate and per-rule drilldowns identical.
  const derivedViolations: SsotViolation[] = [];
  for (const t of executed) {
    const broken = t.rules_broken ?? [];
    if (broken.length === 0) continue;
    const tradeR = typeof t.rr === "number" ? t.rr : 0;
    for (const type of broken) {
      derivedViolations.push({
        id: `${t.id}:${type}`,
        trade_id: t.id,
        type,
        impact_r: tradeR,
        session: t.session ?? null,
        occurred_at: t.executed_at,
      });
    }
  }
  // Prefer derived (always coherent with trades). Fallback to DB rows if no trades have rules_broken.
  const ssotViolations = derivedViolations.length > 0 ? derivedViolations : violations;

  // ── Behavior engine — weighted per-trade + EMA overall.
  // Source: src/lib/behaviorEngine.ts (single source of truth for ALL scoring).
  // NOTE: actualRisk per trade is wired in Phase 2 (journal flow capture).
  const replayInputs: ReplayTradeInput[] = executed.map((t) => ({
    id: t.id,
    executed_at: t.executed_at,
    rulesBroken: t.rules_broken ?? [],
    actualRisk: null,
    preferredRisk: account.risk_per_trade,
  }));
  const behaviorReplay = replayBehavior(replayInputs);
  const disciplineScore = behaviorReplay.overall;
  const cleanTrades = behaviorReplay.cleanTrades;
  const violationCount = behaviorReplay.violationCount;
  const totalLogs = executed.length;
  const adherence = behaviorReplay.ruleAdherence;

  // Top recent violations grouped by type
  const recentCounts: Record<string, number> = {};
  for (const v of ssotViolations.slice(0, 50)) {
    recentCounts[v.type] = (recentCounts[v.type] ?? 0) + 1;
  }
  const recent_violations = Object.entries(recentCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Centralized monetary analytics (live, base→display conversion).
  const baseCcy = account.currency || "USD";
  const dispCcy = account.display_currency || baseCcy;
  let exchangeRate = 1;
  if (baseCcy !== dispCcy) {
    const r = await getRate(baseCcy, dispCcy);
    if (r != null && Number.isFinite(r)) exchangeRate = r;
  }
  const risk = account.risk_per_trade;
  const hasRisk = risk != null && Number.isFinite(risk) && risk > 0;
  const totalPnlBase = hasRisk ? metrics.total_r * (risk as number) : null;
  const expectancyBase = hasRisk ? metrics.expectancy_r * (risk as number) : null;
  const avgRBase = hasRisk ? metrics.avg_r * (risk as number) : null;
  const ddBase = hasRisk ? -Math.abs(metrics.max_drawdown_r) * (risk as number) : null;
  const startingBalanceBase = account.balance;
  const equityBase =
    startingBalanceBase != null && totalPnlBase != null
      ? startingBalanceBase + totalPnlBase
      : startingBalanceBase;
  const conv = (n: number | null): number | null =>
    n == null ? null : n * exchangeRate;
  const analytics: SsotAnalytics = {
    base_currency: baseCcy,
    display_currency: dispCcy,
    exchange_rate: exchangeRate,
    total_r: metrics.total_r,
    expectancy_r: metrics.expectancy_r,
    avg_r: metrics.avg_r,
    max_drawdown_r: metrics.max_drawdown_r,
    total_pnl_base: totalPnlBase,
    total_pnl_converted: conv(totalPnlBase),
    expectancy_currency: conv(expectancyBase),
    avg_r_currency: conv(avgRBase),
    max_drawdown_currency: conv(ddBase),
    starting_balance_base: startingBalanceBase,
    equity_base: equityBase,
    equity_converted: conv(equityBase),
  };

  return {
    loading: false,
    user_id: uid,
    account,
    trades: executed,
    missed,
    metrics,
    behavior: {
      discipline_score: disciplineScore,
      rule_adherence: adherence,
      clean_trades: cleanTrades,
      total_trades: totalLogs,
      violation_count: violationCount,
      recent_violations,
    },
    violations: ssotViolations,
    session_performance: buildSessionPerformance(executed, missed, ssotViolations),
    execution_type: buildExecutionType(executed, missed),
    analytics,
    discipline: {
      ...breakdown,
      score: disciplineScore,
      decision_score: disciplineScore,
      execution_score: disciplineScore,
      rule_adherence: adherence,
      total_trades: totalLogs,
      clean_trades: cleanTrades,
      violation_count: violationCount,
      decision_neutral: totalLogs === 0,
      execution_neutral: totalLogs === 0,
      recent_contributions: behaviorReplay.contributions.map((c) => ({
        source: "execution" as const,
        id: c.id,
        raw: c.delta,
        value: c.overallAfter,
        weight: 1,
        reason: c.reason,
        timestamp: c.timestamp,
      })).slice(0, 20),
    },
  };
}
