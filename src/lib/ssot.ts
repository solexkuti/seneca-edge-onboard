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

export type BalanceSource = "manual" | "synced";

export type SsotAccount = {
  balance: number | null;
  equity: number | null;
  source: BalanceSource;
  updated_at: string | null;
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

export type Ssot = {
  loading: boolean;
  user_id: string | null;
  account: SsotAccount;
  trades: SsotTrade[];
  metrics: SsotMetrics;
  behavior: SsotBehavior;
  /** Underlying discipline breakdown — kept for legacy UI consumers. */
  discipline: DisciplineBreakdown;
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

// ── I/O ────────────────────────────────────────────────────────────────

async function loadAccount(userId: string): Promise<SsotAccount> {
  // Active account row in the new accounts table is authoritative.
  const { data: acct } = await supabase
    .from("accounts")
    .select("balance,equity,source,updated_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (acct) {
    return {
      balance: acct.balance ?? null,
      equity: acct.equity ?? null,
      source: (acct.source as BalanceSource) ?? "manual",
      updated_at: acct.updated_at ?? null,
    };
  }
  // Legacy fallback for profiles still on the old columns.
  const { data, error } = await supabase
    .from("profiles")
    .select("account_balance,account_equity,balance_source,balance_updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return EMPTY_ACCOUNT;
  return {
    balance: data.account_balance ?? null,
    equity: data.account_equity ?? null,
    source: (data.balance_source as BalanceSource) ?? "manual",
    updated_at: data.balance_updated_at ?? null,
  };
}

async function loadTrades(userId: string): Promise<SsotTrade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(
      "id,asset,market,direction,entry_price,exit_price,stop_loss,take_profit,rr,risk_r,pnl,result,session,executed_at,closed_at",
    )
    .eq("user_id", userId)
    .eq("trade_type", "executed")
    .order("executed_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return data as unknown as SsotTrade[];
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
      metrics: EMPTY_METRICS,
      behavior: {
        discipline_score: empty.score,
        rule_adherence: 1,
        clean_trades: 0,
        total_trades: 0,
        violation_count: 0,
        recent_violations: [],
      },
      discipline: empty,
    };
  }

  const [account, trades, breakdown, worstBreak, views] = await Promise.all([
    loadAccount(uid),
    loadTrades(uid),
    loadDisciplineBreakdown(), // still needed for the breakdown UI (per-trade contributions)
    loadWorstRuleBreak(uid),
    loadComputedViews(uid),
  ]);

  const bestSession = bestSessionFromTrades(trades);
  const metrics = metricsFromViews(views, bestSession);
  metrics.worst_rule_break = worstBreak;

  // Behavior numbers come from the discipline + rule_adherence views (SSOT).
  const disciplineScore = Number(views.discipline?.discipline_score ?? breakdown.score);
  const cleanTrades = Number(views.discipline?.clean_trades ?? breakdown.clean_trades);
  const totalLogs = Number(views.discipline?.total_trades ?? breakdown.total_trades);
  const violationCount = Number(views.discipline?.violation_count ?? breakdown.violation_count);
  const adherence = Number(
    views.adherence?.adherence ?? breakdown.rule_adherence ?? 1,
  );

  return {
    loading: false,
    user_id: uid,
    account,
    trades,
    metrics,
    behavior: {
      discipline_score: disciplineScore,
      rule_adherence: adherence,
      clean_trades: cleanTrades,
      total_trades: totalLogs,
      violation_count: violationCount,
      recent_violations: [],
    },
    // Keep authoritative score from view, retain breakdown contributions for the trace UI.
    discipline: { ...breakdown, score: disciplineScore, rule_adherence: adherence },
  };
}
