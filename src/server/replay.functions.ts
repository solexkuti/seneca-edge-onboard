// Server functions for the Replay engine.
//
// - loadReplayCandles: typed RPC the UI calls to hydrate a replay session.
// - createReplaySession / saveReplayTrade: persist user-owned replay state.
//
// All user-scoped writes go through requireSupabaseAuth so RLS applies.
// Candle loading uses supabaseAdmin internally because the candles cache is
// shared and the Deriv fetch should not depend on user auth.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadCandles } from "./datafeed.server";

const TIMEFRAME_VALUES = ["1m", "5m", "15m", "1h", "4h"] as const;

const loadCandlesSchema = z.object({
  provider: z.literal("deriv"),
  symbol: z.string().min(1).max(32),
  timeframe: z.enum(TIMEFRAME_VALUES),
  from: z.number().int().positive(),
  to: z.number().int().positive(),
});

export const loadReplayCandles = createServerFn({ method: "POST" })
  .inputValidator((data) => loadCandlesSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.to <= data.from) {
      throw new Error("Invalid range: `to` must be greater than `from`.");
    }
    const candles = await loadCandles(data);
    return { candles };
  });

const createSessionSchema = z.object({
  provider: z.literal("deriv"),
  symbol: z.string().min(1),
  symbolLabel: z.string().min(1),
  category: z.enum(["synthetic", "forex"]),
  timeframe: z.enum(TIMEFRAME_VALUES),
  rangeFrom: z.number().int(),
  rangeTo: z.number().int(),
  startingEquity: z.number().positive().default(10000),
});

export const createReplaySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createSessionSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("replay_sessions")
      .insert({
        user_id: userId,
        provider: data.provider,
        symbol: data.symbol,
        symbol_label: data.symbolLabel,
        category: data.category,
        timeframe: data.timeframe,
        range_from: data.rangeFrom,
        range_to: data.rangeTo,
        cursor_time: data.rangeFrom,
        starting_equity: data.startingEquity,
        equity: data.startingEquity,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const saveTradeSchema = z.object({
  sessionId: z.string().uuid(),
  direction: z.enum(["long", "short"]),
  entryPrice: z.number(),
  stopLoss: z.number().nullable(),
  takeProfit: z.number().nullable(),
  riskPct: z.number().min(0).max(100),
  openedAt: z.number().int(),
  closedAt: z.number().int().nullable(),
  exitPrice: z.number().nullable(),
  result: z.enum(["open", "win", "loss", "breakeven"]),
  rr: z.number().nullable(),
  pnl: z.number().nullable(),
});

export const saveReplayTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveTradeSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("replay_trades").insert({
      session_id: data.sessionId,
      user_id: userId,
      direction: data.direction,
      entry_price: data.entryPrice,
      stop_loss: data.stopLoss,
      take_profit: data.takeProfit,
      risk_pct: data.riskPct,
      opened_at: data.openedAt,
      closed_at: data.closedAt,
      exit_price: data.exitPrice,
      result: data.result,
      rr: data.rr,
      pnl: data.pnl,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
