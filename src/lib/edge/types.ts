// Seneca Edge — shared types for the behavior engine and UI surfaces.
// These mirror the public.trades / public.rule_violations shape but are
// intentionally tolerant (numeric fields can be null) so the engine can run
// against partially-filled rows without crashing.

export type TradeRow = {
  id: string;
  user_id: string;
  asset: string | null;
  direction: "buy" | "sell" | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rr: number | null;
  risk_r: number | null;
  pnl: number | null;
  result: "win" | "loss" | "breakeven" | null;
  session: string | null;
  trade_type: "executed" | "missed" | string | null;
  missed_potential_r: number | null;
  rules_broken: string[];
  rules_followed: string[];
  screenshot_url: string | null;
  notes: string | null;
  executed_at: string;
  closed_at: string | null;
  created_at: string;
};

export type RuleViolationRow = {
  id: string;
  user_id: string;
  trade_id: string;
  type: string;
  impact_r: number;
  session: string | null;
  occurred_at: string;
};

/** A trade is "system-clean" when the user followed their plan: no rules broken. */
export const isSystemTrade = (t: TradeRow): boolean =>
  t.trade_type !== "missed" &&
  (!t.rules_broken || t.rules_broken.length === 0);

export const isExecuted = (t: TradeRow): boolean => t.trade_type !== "missed";
export const isMissed = (t: TradeRow): boolean => t.trade_type === "missed";

export type EdgeBlock = {
  /** Sample size used to compute this edge */
  sample: number;
  /** % of trades that won, 0–100 */
  winRate: number;
  /** Average R per trade (positive = net winning) */
  avgR: number;
  /** Sum of R across all trades in this block */
  totalR: number;
};

export type ViolationImpact = {
  type: string;
  count: number;
  totalImpactR: number; // negative number when costly
  avgImpactR: number;
  lastOccurredAt: string | null;
};

export type SessionPerf = {
  session: string;
  sample: number;
  winRate: number;
  avgR: number;
  totalR: number;
};

export type Pattern = {
  id: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  evidenceTradeIds: string[];
};

export type EdgeReport = {
  hasData: boolean;
  totalTrades: number;
  systemEdge: EdgeBlock;     // followed_plan = true
  actualEdge: EdgeBlock;     // all executed trades
  missedR: number;           // sum of missed_potential_r
  executionGapR: number;     // systemEdge.totalR - actualEdge.totalR
  disciplineScore: number;   // 0..100
  ruleAdherencePct: number;  // 0..100
  violations: ViolationImpact[];          // sorted by |totalImpactR| desc
  sessions: SessionPerf[];                // sorted by avgR desc
  patterns: Pattern[];                    // detected sequences
  lastTradeAt: string | null;
};
