// Shared types between datafeed, replay engine, simulator and UI.

export interface Candle {
  /** Unix seconds, candle open time */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type ReplayStatus = "idle" | "playing" | "paused" | "ended";

export type Direction = "long" | "short";

export interface SimulatedTrade {
  id: string;
  direction: Direction;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskPct: number;
  openedAt: number; // unix seconds (replay time)
  closedAt: number | null;
  exitPrice: number | null;
  result: "open" | "win" | "loss" | "breakeven";
  rr: number | null;
  pnl: number | null;
}

export interface ReplayMetrics {
  trades: number;
  wins: number;
  losses: number;
  winRate: number; // 0..1
  avgR: number;
  totalR: number;
  equity: number;
}
