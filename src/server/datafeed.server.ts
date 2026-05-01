// Deriv historical candle source (server-only).
//
// Uses Deriv's `ticks_history` WebSocket call with style="candles" to fetch
// OHLC bars. Public endpoint — no API token required. We cache results into
// public.candles so repeat replays on the same symbol/timeframe are instant.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Candle } from "@/lib/replay/types";
import { timeframeSeconds, type TimeframeId } from "@/lib/replay/assets";

const DERIV_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

interface DerivCandlesResponse {
  msg_type: string;
  req_id?: number;
  error?: { code: string; message: string };
  candles?: Array<{ epoch: number; open: number; high: number; low: number; close: number }>;
}

/**
 * Fetch up to `count` candles ending at `endEpoch` (unix seconds) from Deriv.
 * Deriv caps `count` at 5000.
 */
function fetchDerivCandles(
  symbol: string,
  granularity: number,
  endEpoch: number,
  count: number,
): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);
    let settled = false;

    const finish = (err: Error | null, value?: Candle[]) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* noop */ }
      if (err) reject(err);
      else resolve(value!);
    };

    const timeout = setTimeout(() => finish(new Error("Deriv ticks_history timeout")), 20_000);

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          end: String(endEpoch),
          count: Math.min(count, 5000),
          style: "candles",
          granularity,
          req_id: 1,
        }),
      );
    });

    ws.addEventListener("message", (ev) => {
      let msg: DerivCandlesResponse;
      try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch { return; }
      if (msg.req_id !== 1) return;
      clearTimeout(timeout);
      if (msg.error) return finish(new Error(`Deriv: ${msg.error.message}`));
      const candles = (msg.candles ?? []).map<Candle>((c) => ({
        time: c.epoch,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      finish(null, candles);
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      finish(new Error("Deriv WebSocket error"));
    });
    ws.addEventListener("close", () => {
      if (!settled) {
        clearTimeout(timeout);
        finish(new Error("Deriv WebSocket closed before completion"));
      }
    });
  });
}

interface CandleRow {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/**
 * Load candles for a symbol/timeframe over [from, to] unix seconds.
 *
 * Strategy:
 *  1. Read from public.candles cache.
 *  2. If we don't have enough, fetch missing range from Deriv and upsert.
 *  3. Return final sorted list.
 */
export async function loadCandles(params: {
  provider: "deriv";
  symbol: string;
  timeframe: TimeframeId;
  from: number;
  to: number;
}): Promise<Candle[]> {
  const { provider, symbol, timeframe, from, to } = params;
  const granularity = timeframeSeconds(timeframe);
  const expectedCount = Math.floor((to - from) / granularity);

  // 1) Cache lookup
  const { data: cached, error: cacheErr } = await supabaseAdmin
    .from("candles")
    .select("time, open, high, low, close, volume")
    .eq("provider", provider)
    .eq("symbol", symbol)
    .eq("timeframe", timeframe)
    .gte("time", from)
    .lte("time", to)
    .order("time", { ascending: true })
    .limit(5000);
  if (cacheErr) throw new Error(`candles cache read failed: ${cacheErr.message}`);

  const cachedRows = (cached ?? []) as CandleRow[];

  // If cache covers most of the range, return it as-is
  if (cachedRows.length >= expectedCount * 0.95 && cachedRows.length > 0) {
    return cachedRows.map((c) => ({
      time: Number(c.time),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));
  }

  // 2) Fetch from Deriv. Deriv returns the most recent `count` candles ending at `to`.
  // We page backward in 1000-candle chunks until we cover `from`.
  const all: Candle[] = [];
  let cursor = to;
  const chunkSize = 1000;
  while (cursor > from) {
    const candles = await fetchDerivCandles(symbol, granularity, cursor, chunkSize);
    if (candles.length === 0) break;
    all.unshift(...candles);
    const oldest = candles[0]?.time ?? cursor;
    if (oldest <= from) break;
    cursor = oldest - 1;
    if (all.length >= 4000) break; // hard cap to keep replays bounded
  }

  // De-duplicate and clip to range
  const byTime = new Map<number, Candle>();
  for (const c of all) {
    if (c.time >= from && c.time <= to) byTime.set(c.time, c);
  }
  const final = Array.from(byTime.values()).sort((a, b) => a.time - b.time);

  // 3) Upsert into cache (best-effort)
  if (final.length > 0) {
    const rows = final.map((c) => ({
      provider,
      symbol,
      timeframe,
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: null as number | null,
    }));
    const { error: upErr } = await supabaseAdmin
      .from("candles")
      .upsert(rows, { onConflict: "provider,symbol,timeframe,time", ignoreDuplicates: true });
    if (upErr) console.warn("[replay] candle cache upsert failed:", upErr.message);
  }

  return final;
}
