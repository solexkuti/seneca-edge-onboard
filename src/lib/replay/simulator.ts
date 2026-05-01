// Trade simulator — tracks entries, SL/TP, and resolves trades on each candle.
//
// Pure TS, no React. The UI calls `openTrade` when the user clicks Buy/Sell,
// then forwards every new replay candle into `onCandle` which scans open
// trades for SL/TP hits and closes them. Metrics are recomputed from the
// closed trade list.

import type { Candle, Direction, ReplayMetrics, SimulatedTrade } from "./types";

let _id = 0;
const nextId = () => `t_${Date.now().toString(36)}_${(_id++).toString(36)}`;

export interface OpenTradeInput {
  direction: Direction;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskPct: number;
  openedAt: number;
}

export class TradeSimulator {
  private trades: SimulatedTrade[] = [];
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  getTrades(): SimulatedTrade[] {
    return this.trades;
  }

  getOpenTrades(): SimulatedTrade[] {
    return this.trades.filter((t) => t.result === "open");
  }

  openTrade(input: OpenTradeInput): SimulatedTrade {
    const trade: SimulatedTrade = {
      id: nextId(),
      direction: input.direction,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      riskPct: input.riskPct,
      openedAt: input.openedAt,
      closedAt: null,
      exitPrice: null,
      result: "open",
      rr: null,
      pnl: null,
    };
    this.trades.push(trade);
    this.emit();
    return trade;
  }

  /** Manually close all open trades at the current candle's close price. */
  closeAll(at: Candle) {
    let changed = false;
    for (const t of this.trades) {
      if (t.result === "open") {
        this.resolveTrade(t, at.close, at.time, "manual");
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  reset() {
    this.trades = [];
    this.emit();
  }

  /** Forward each new candle from the replay engine here. */
  onCandle(candle: Candle) {
    let changed = false;
    for (const t of this.trades) {
      if (t.result !== "open") continue;
      const hit = this.detectFill(t, candle);
      if (hit) {
        this.resolveTrade(t, hit.price, candle.time, hit.kind);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private detectFill(t: SimulatedTrade, c: Candle): { kind: "sl" | "tp"; price: number } | null {
    // For long: SL hit if low <= SL, TP hit if high >= TP.
    // For short: SL hit if high >= SL, TP hit if low <= TP.
    // If both could trigger inside the same candle, assume SL fills first
    // (conservative for trader simulation).
    if (t.direction === "long") {
      if (t.stopLoss !== null && c.low <= t.stopLoss) return { kind: "sl", price: t.stopLoss };
      if (t.takeProfit !== null && c.high >= t.takeProfit) return { kind: "tp", price: t.takeProfit };
    } else {
      if (t.stopLoss !== null && c.high >= t.stopLoss) return { kind: "sl", price: t.stopLoss };
      if (t.takeProfit !== null && c.low <= t.takeProfit) return { kind: "tp", price: t.takeProfit };
    }
    return null;
  }

  private resolveTrade(
    t: SimulatedTrade,
    exit: number,
    when: number,
    reason: "sl" | "tp" | "manual",
  ) {
    t.exitPrice = exit;
    t.closedAt = when;

    const sign = t.direction === "long" ? 1 : -1;
    const move = (exit - t.entryPrice) * sign;
    const risk = t.stopLoss !== null ? Math.abs(t.entryPrice - t.stopLoss) : Math.abs(move) || 1;
    const r = move / Math.max(risk, 1e-9);
    t.rr = Number(r.toFixed(2));
    t.pnl = Number((r * t.riskPct).toFixed(2)); // pnl expressed in %-of-equity terms

    if (reason === "tp" || (reason === "manual" && r > 0.0001)) t.result = "win";
    else if (reason === "sl" || (reason === "manual" && r < -0.0001)) t.result = "loss";
    else t.result = "breakeven";
  }
}

export function computeMetrics(trades: SimulatedTrade[], startingEquity: number): ReplayMetrics {
  const closed = trades.filter((t) => t.result !== "open");
  const wins = closed.filter((t) => t.result === "win").length;
  const losses = closed.filter((t) => t.result === "loss").length;
  const totalR = closed.reduce((acc, t) => acc + (t.rr ?? 0), 0);
  const avgR = closed.length > 0 ? totalR / closed.length : 0;
  const equity = closed.reduce(
    (acc, t) => acc + (t.pnl ?? 0) * 0.01 * acc,
    startingEquity,
  );
  return {
    trades: closed.length,
    wins,
    losses,
    winRate: closed.length > 0 ? wins / closed.length : 0,
    avgR: Number(avgR.toFixed(2)),
    totalR: Number(totalR.toFixed(2)),
    equity: Number(equity.toFixed(2)),
  };
}
