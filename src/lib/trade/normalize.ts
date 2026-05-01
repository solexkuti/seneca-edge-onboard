/**
 * Trade Normalizers
 *
 * Every raw trade source — manual form input, Deriv API payload, MT5 deal
 * record — must pass through one of these normalizers before reaching the
 * Trade Store. The output is a unified Trade object (see ./types.ts).
 *
 * Backend integrations (Deriv, MT5) are not wired yet. The function shapes
 * are stable so they can be plugged in without touching downstream code.
 */

import type {
  Trade,
  TradeSession,
  ExecutionType,
  MarketType,
  MissedReason,
  TradeKind,
} from "./types";

// ---------- DB row → Trade ----------

/**
 * Shape of a row from the `trades` table after Phase 1 migration.
 * Kept as a structural type so we don't depend on the generated Database
 * types in this foundational module.
 */
export interface TradeRow {
  id: string;
  user_id: string;
  source: "manual" | "deriv" | "mt5";
  market: string;
  market_type: MarketType | null;
  asset: string | null;
  direction: "long" | "short" | "buy" | "sell";
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number | null;
  risk_r: number | null;
  rr: number | null;
  pnl: number | null;
  session: TradeSession | null;
  screenshot_url: string | null;
  notes: string | null;
  trade_type: TradeKind;
  missed_potential_r: number | null;
  missed_reason: MissedReason | null;
  rules_followed: string[] | null;
  rules_broken: string[] | null;
  execution_type: ExecutionType | null;
  executed_at: string;
  closed_at: string | null;
  created_at: string;
}

export function tradeFromRow(row: TradeRow): Trade {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    asset: row.asset ?? row.market,
    marketType: row.market_type,
    direction: row.direction,
    entryPrice: row.entry_price,
    exitPrice: row.exit_price,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    lotSize: row.lot_size,
    riskR: row.risk_r,
    // resultR is canonical R-multiple. We use the existing `rr` column.
    resultR: row.rr,
    pnl: row.pnl,
    session: row.session,
    screenshotUrl: row.screenshot_url,
    notes: row.notes,
    tradeType: row.trade_type,
    missedPotentialR: row.missed_potential_r,
    missedReason: row.missed_reason,
    rulesFollowed: row.rules_followed ?? [],
    rulesBroken: row.rules_broken ?? [],
    executionType: row.execution_type,
    createdAt: row.executed_at,
    closedAt: row.closed_at,
  };
}

// ---------- Manual form input → Trade-insert payload ----------

/**
 * Shape persisted to the `trades` table. Mirrors the column set so callers
 * can hand this directly to `supabase.from("trades").insert(...)`.
 */
export type TradeInsert = {
  user_id: string;
  source: "manual" | "deriv" | "mt5";
  market: string;
  market_type: MarketType | null;
  asset: string;
  direction: "buy" | "sell";
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number | null;
  risk_r: number | null;
  rr: number | null;
  pnl: number | null;
  session: TradeSession | null;
  screenshot_url: string | null;
  notes: string | null;
  trade_type: TradeKind;
  missed_potential_r: number | null;
  missed_reason: MissedReason | null;
  rules_followed: string[];
  rules_broken: string[];
  execution_type: ExecutionType | null;
  executed_at: string;
  closed_at: string | null;
};

export function tradeToInsert(t: Trade): TradeInsert {
  return {
    user_id: t.userId,
    source: t.source,
    market: t.asset, // legacy `market` column kept in sync with `asset`
    market_type: t.marketType,
    asset: t.asset,
    direction: t.direction,
    entry_price: t.entryPrice,
    exit_price: t.exitPrice,
    stop_loss: t.stopLoss,
    take_profit: t.takeProfit,
    lot_size: t.lotSize,
    risk_r: t.riskR,
    rr: t.resultR,
    pnl: t.pnl,
    session: t.session,
    screenshot_url: t.screenshotUrl,
    notes: t.notes,
    trade_type: t.tradeType,
    missed_potential_r: t.missedPotentialR,
    missed_reason: t.missedReason,
    rules_followed: t.rulesFollowed,
    rules_broken: t.rulesBroken,
    execution_type: t.executionType,
    executed_at: t.createdAt,
    closed_at: t.closedAt,
  };
}

// ---------- Deriv → Trade (placeholder) ----------

/**
 * Stub for the Deriv `proposal_open_contract` / `transaction` payload.
 * Wire to the real Deriv websocket later — keep this signature stable.
 */
export interface DerivContract {
  contract_id: string | number;
  underlying: string;
  contract_type: string; // CALL | PUT | MULTUP | ...
  buy_price: number;
  sell_price?: number;
  profit?: number;
  date_start: number; // unix seconds
  date_expiry?: number;
}

export function tradeFromDeriv(
  raw: DerivContract,
  userId: string,
): Trade {
  const isBuy = /CALL|UP|LONG|BUY/i.test(raw.contract_type);
  const startMs = raw.date_start * 1000;
  const endMs = raw.date_expiry ? raw.date_expiry * 1000 : null;
  return {
    id: String(raw.contract_id),
    userId,
    source: "deriv",
    asset: raw.underlying,
    marketType: "synthetic",
    direction: isBuy ? "buy" : "sell",
    entryPrice: raw.buy_price ?? null,
    exitPrice: raw.sell_price ?? null,
    stopLoss: null,
    takeProfit: null,
    lotSize: null,
    riskR: null,
    resultR: null,
    pnl: raw.profit ?? null,
    session: sessionFromTimestamp(startMs),
    screenshotUrl: null,
    notes: null,
    tradeType: "executed",
    missedPotentialR: null,
    missedReason: null,
    rulesFollowed: [],
    rulesBroken: [],
    executionType: null,
    createdAt: new Date(startMs).toISOString(),
    closedAt: endMs ? new Date(endMs).toISOString() : null,
  };
}

// ---------- MT5 → Trade (placeholder) ----------

/**
 * Stub for an MT5 deal record (e.g. via MetaApi). Wire to the real provider
 * later — keep this signature stable.
 */
export interface Mt5Deal {
  ticket: number | string;
  symbol: string;
  type: "buy" | "sell";
  volume: number;
  openPrice: number;
  closePrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  profit?: number;
  openTime: string; // ISO
  closeTime?: string; // ISO
}

export function tradeFromMt5(raw: Mt5Deal, userId: string): Trade {
  return {
    id: String(raw.ticket),
    userId,
    source: "mt5",
    asset: raw.symbol,
    marketType: inferMarketType(raw.symbol),
    direction: raw.type,
    entryPrice: raw.openPrice,
    exitPrice: raw.closePrice ?? null,
    stopLoss: raw.stopLoss ?? null,
    takeProfit: raw.takeProfit ?? null,
    lotSize: raw.volume,
    riskR: null,
    resultR: null,
    pnl: raw.profit ?? null,
    session: sessionFromTimestamp(new Date(raw.openTime).getTime()),
    screenshotUrl: null,
    notes: null,
    tradeType: "executed",
    missedPotentialR: null,
    missedReason: null,
    rulesFollowed: [],
    rulesBroken: [],
    executionType: null,
    createdAt: raw.openTime,
    closedAt: raw.closeTime ?? null,
  };
}

// ---------- Helpers ----------

/**
 * Map a UTC timestamp to a trading session.
 * London 07:00–16:00 UTC, NY 12:00–21:00 UTC, Asia 23:00–08:00 UTC.
 * If London + NY overlap, prefer London (the dominant session).
 */
export function sessionFromTimestamp(ms: number): TradeSession {
  const h = new Date(ms).getUTCHours();
  if (h >= 7 && h < 16) return "London";
  if (h >= 12 && h < 21) return "NY";
  return "Asia";
}

export function inferMarketType(symbol: string): MarketType {
  const s = symbol.toUpperCase();
  if (/BTC|ETH|XRP|SOL|DOGE|USDT/.test(s)) return "crypto";
  if (/BOOM|CRASH|VOL|R_|JD|STEP/.test(s)) return "synthetic";
  return "forex";
}
