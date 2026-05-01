// Replay engine — streams candles incrementally to simulate live price action.
//
// Pure TypeScript class with a tiny event subscriber model so any UI layer
// (Lightweight Charts now, TradingView Advanced Charts later) can subscribe
// without coupling. The engine knows nothing about charts; it only owns
// the cursor over a list of candles and a tick scheduler.

import type { Candle, ReplayStatus } from "./types";

export type ReplayEvent =
  | { type: "candle"; candle: Candle; index: number }
  | { type: "status"; status: ReplayStatus }
  | { type: "speed"; speed: number }
  | { type: "reset"; index: number };

export type ReplaySubscriber = (event: ReplayEvent) => void;

export interface ReplayEngineOptions {
  /** Full historical dataset, sorted ascending by time. */
  candles: Candle[];
  /** Index to start streaming from (default: half-way). */
  startIndex?: number;
  /** Initial speed multiplier. */
  speed?: number;
}

export class ReplayEngine {
  private candles: Candle[];
  private cursor: number;
  private status: ReplayStatus = "paused";
  private speed: number;
  private subs = new Set<ReplaySubscriber>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: ReplayEngineOptions) {
    this.candles = opts.candles;
    this.cursor = Math.max(0, Math.min(opts.startIndex ?? Math.floor(opts.candles.length / 2), opts.candles.length - 1));
    this.speed = opts.speed ?? 1;
  }

  subscribe(fn: ReplaySubscriber): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private emit(ev: ReplayEvent) {
    for (const s of this.subs) s(ev);
  }

  /** All candles up to and including the cursor — what should currently be on the chart. */
  getVisibleCandles(): Candle[] {
    return this.candles.slice(0, this.cursor + 1);
  }

  getCurrentCandle(): Candle | null {
    return this.candles[this.cursor] ?? null;
  }

  getStatus(): ReplayStatus { return this.status; }
  getSpeed(): number { return this.speed; }
  getCursor(): number { return this.cursor; }
  getTotal(): number { return this.candles.length; }

  setSpeed(speed: number) {
    this.speed = Math.max(0.25, speed);
    this.emit({ type: "speed", speed: this.speed });
    if (this.status === "playing") {
      this.scheduleNext();
    }
  }

  play() {
    if (this.status === "ended") return;
    this.setStatus("playing");
    this.scheduleNext();
  }

  pause() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.status === "playing") this.setStatus("paused");
  }

  /** Advance one candle. Returns the new candle (or null at end). */
  step(): Candle | null {
    if (this.cursor >= this.candles.length - 1) {
      this.pause();
      this.setStatus("ended");
      return null;
    }
    this.cursor += 1;
    const candle = this.candles[this.cursor];
    this.emit({ type: "candle", candle, index: this.cursor });
    return candle;
  }

  reset(toIndex?: number) {
    this.pause();
    this.cursor = Math.max(0, Math.min(toIndex ?? Math.floor(this.candles.length / 2), this.candles.length - 1));
    this.setStatus("paused");
    this.emit({ type: "reset", index: this.cursor });
  }

  destroy() {
    this.pause();
    this.subs.clear();
  }

  private setStatus(status: ReplayStatus) {
    if (this.status === status) return;
    this.status = status;
    this.emit({ type: "status", status });
  }

  private scheduleNext() {
    if (this.timer) clearTimeout(this.timer);
    if (this.status !== "playing") return;
    // Base cadence: 1 candle per second at 1x; faster speeds = shorter delay.
    const delayMs = Math.max(40, 1000 / this.speed);
    this.timer = setTimeout(() => {
      const candle = this.step();
      if (candle && this.status === "playing") this.scheduleNext();
    }, delayMs);
  }
}
