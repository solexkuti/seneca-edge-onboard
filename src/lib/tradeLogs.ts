// Trade Performance Engine — single source of truth for performance metrics.
//
// Reads/writes the `trade_logs` table. All metrics are derived from real,
// stored entries — no placeholders, no fake numbers. Empty state is honored
// throughout: callers must check `entries.length === 0` and render the
// "Log your first trade" copy instead of zero values.

import { supabase } from "@/integrations/supabase/client";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";

export type Market = "forex" | "crypto" | "indices" | "stocks" | "metals" | "other";
export type Direction = "buy" | "sell";
export type Outcome = "win" | "loss" | "breakeven";
export type SessionTag = "London" | "NY" | "Asia" | "Sydney" | "Other";

export type TradeLog = {
  id: string;
  user_id: string;

  // Trade core
  market: Market;
  pair: string;
  direction: Direction;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_percent: number | null;

  // Performance
  rr: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  outcome: Outcome;

  // Timing
  opened_at: string;          // ISO timestamptz
  closed_at: string | null;   // ISO timestamptz
  timezone: string | null;    // IANA tz at the time of logging
  session_tag: SessionTag | null;

  // Behavior
  rules_followed: boolean;
  mistakes: string[];
  confidence_rating: number | null;
  emotional_state: string | null;

  // Journal
  note: string | null;
  screenshot_url: string | null;

  // Data quality — "low" is set by the price-correction engine when the user
  // submitted a trade after rejecting a flagged-input suggestion. Default
  // "normal" for all clean submissions.
  data_quality: "normal" | "low";

  // System
  created_at: string;
  updated_at: string;
};

export type NewTradeLog = Omit<
  TradeLog,
  "id" | "user_id" | "created_at" | "updated_at"
>;

// ── IO ────────────────────────────────────────────────────────────────

export async function insertTradeLog(input: NewTradeLog): Promise<TradeLog> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("trade_logs")
    .insert({ ...input, user_id: uid })
    .select("*")
    .single();
  if (error) throw error;
  // Notify every consumer (dashboard SSOT, behavior, history, mentor) that a
  // new trade exists. Without this, useSsot stays on stale data after a save.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(JOURNAL_EVENT));
  }
  return data as unknown as TradeLog;
}

export async function fetchTradeLogs(opts: {
  limit?: number;
  since?: string; // ISO
  until?: string; // ISO
} = {}): Promise<TradeLog[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];

  let q = supabase
    .from("trade_logs")
    .select("*")
    .eq("user_id", uid)
    .order("opened_at", { ascending: false });

  if (opts.since) q = q.gte("opened_at", opts.since);
  if (opts.until) q = q.lte("opened_at", opts.until);
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as TradeLog[];
}

// ── Time-range helpers ────────────────────────────────────────────────

export type TimeRange = "today" | "week" | "month" | "all";

export function rangeBoundaries(range: TimeRange): { since: string | null; until: string | null } {
  if (range === "all") return { since: null, until: null };
  const now = new Date();
  const since = new Date(now);
  if (range === "today") {
    since.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    since.setDate(since.getDate() - 7);
  } else {
    since.setDate(since.getDate() - 30);
  }
  return { since: since.toISOString(), until: null };
}

// ── Metric calculations (deterministic, real-data only) ───────────────

export type Metrics = {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;       // 0..1, null when no decided trades
  netPnlR: number;              // sum of R across all trades
  avgRR: number | null;         // mean R per trade
  profitFactor: number | null;  // |sum wins R| / |sum losses R|, null when no losses
  largestWinR: number | null;
  largestLossR: number | null;
};

const EMPTY_METRICS: Metrics = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  winRate: null,
  netPnlR: 0,
  avgRR: null,
  profitFactor: null,
  largestWinR: null,
  largestLossR: null,
};

/** Pull a numeric R for a trade. Falls back to ±1R when rr is missing but
 * outcome is decided — matches existing behavioral journal convention. */
function effectiveR(t: TradeLog): number {
  if (typeof t.rr === "number" && Number.isFinite(t.rr)) return t.rr;
  if (t.outcome === "win") return 1;
  if (t.outcome === "loss") return -1;
  return 0;
}

export function computeMetrics(trades: TradeLog[]): Metrics {
  if (trades.length === 0) return { ...EMPTY_METRICS };

  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let netR = 0;
  let sumWinR = 0;
  let sumLossR = 0; // stored as positive magnitude
  let largestWin: number | null = null;
  let largestLoss: number | null = null;

  for (const t of trades) {
    const r = effectiveR(t);
    netR += r;
    if (t.outcome === "win") {
      wins += 1;
      sumWinR += Math.max(0, r);
      if (largestWin === null || r > largestWin) largestWin = r;
    } else if (t.outcome === "loss") {
      losses += 1;
      sumLossR += Math.abs(Math.min(0, r));
      if (largestLoss === null || r < largestLoss) largestLoss = r;
    } else {
      breakeven += 1;
    }
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? wins / decided : null;
  const avgRR = trades.length > 0 ? netR / trades.length : null;
  const profitFactor = sumLossR > 0 ? sumWinR / sumLossR : sumWinR > 0 ? Infinity : null;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    breakeven,
    winRate,
    netPnlR: netR,
    avgRR,
    profitFactor,
    largestWinR: largestWin,
    largestLossR: largestLoss,
  };
}

/** Last-N snapshot for the dashboard widget. Returns null when no trades. */
export function snapshotLastN(trades: TradeLog[], n = 20): Metrics | null {
  if (trades.length === 0) return null;
  return computeMetrics(trades.slice(0, n));
}

// ── Mentor payload ────────────────────────────────────────────────────

export type MentorPerformancePayload = {
  windowSize: number;
  winRate: number | null;
  avgRR: number | null;
  netPnlR: number;
  profitFactor: number | null;
  rulesFollowedRate: number | null; // 0..1
  topMistake: { id: string; count: number } | null;
  recent: Array<{
    when: string; // formatted local date+time
    pair: string;
    direction: Direction;
    outcome: Outcome;
    r: number;
    rules_followed: boolean;
    mistakes: string[];
  }>;
};

export function buildMentorPayload(
  trades: TradeLog[],
): MentorPerformancePayload | null {
  if (trades.length === 0) return null;
  const window = trades.slice(0, 20);
  const m = computeMetrics(window);
  const followed = window.filter((t) => t.rules_followed).length;
  const rulesFollowedRate = window.length > 0 ? followed / window.length : null;

  const counts = new Map<string, number>();
  for (const t of window) for (const id of t.mistakes) counts.set(id, (counts.get(id) ?? 0) + 1);
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const topMistake = ranked.length > 0 ? { id: ranked[0][0], count: ranked[0][1] } : null;

  return {
    windowSize: window.length,
    winRate: m.winRate,
    avgRR: m.avgRR,
    netPnlR: m.netPnlR,
    profitFactor: m.profitFactor,
    rulesFollowedRate,
    topMistake,
    recent: window.map((t) => ({
      when: new Date(t.opened_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      pair: t.pair,
      direction: t.direction,
      outcome: t.outcome,
      r: effectiveR(t),
      rules_followed: t.rules_followed,
      mistakes: t.mistakes,
    })),
  };
}

// ── Auto-calculations (entry/SL/TP → RR; entry/exit + risk% → PnL) ────

/** RR from entry, stop loss, take profit. Returns null when not derivable. */
export function deriveRR(args: {
  direction: Direction;
  entry: number | null;
  stop: number | null;
  target: number | null;
}): number | null {
  const { direction, entry, stop, target } = args;
  if (entry == null || stop == null || target == null) return null;
  const risk = direction === "buy" ? entry - stop : stop - entry;
  const reward = direction === "buy" ? target - entry : entry - target;
  if (!Number.isFinite(risk) || risk <= 0) return null;
  if (!Number.isFinite(reward)) return null;
  return reward / risk;
}

/** Realized R from entry, exit, stop loss. */
export function realizedR(args: {
  direction: Direction;
  entry: number | null;
  exit: number | null;
  stop: number | null;
}): number | null {
  const { direction, entry, exit, stop } = args;
  if (entry == null || exit == null || stop == null) return null;
  const risk = direction === "buy" ? entry - stop : stop - entry;
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const move = direction === "buy" ? exit - entry : entry - exit;
  return move / risk;
}

/** PnL % of account = realized R × risk_per_trade %. */
export function derivePnlPercent(realized_r: number | null, risk_percent: number | null): number | null {
  if (realized_r == null || risk_percent == null) return null;
  return realized_r * risk_percent;
}

// ── Session tag from a Date (uses UTC hour) ───────────────────────────

export function sessionTagFor(date: Date): SessionTag {
  const h = date.getUTCHours();
  // Rough overlapping sessions in UTC.
  if (h >= 0 && h < 7) return "Asia";
  if (h >= 7 && h < 12) return "London";
  if (h >= 12 && h < 17) return "NY"; // London/NY overlap collapses to NY
  if (h >= 17 && h < 21) return "NY";
  if (h >= 21 && h < 24) return "Sydney";
  return "Other";
}

// ── Formatting helpers used across screens ────────────────────────────

export function fmtPct(v: number | null, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtR(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}R`;
}

export function fmtNumber(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}
