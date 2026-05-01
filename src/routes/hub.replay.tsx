import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { HubPageContainer } from "@/components/layout/HubLayout";
import { ASSETS, TIMEFRAMES, findAsset, groupedAssets, timeframeSeconds, type TimeframeId } from "@/lib/replay/assets";
import { ReplayEngine } from "@/lib/replay/engine";
import { TradeSimulator, computeMetrics } from "@/lib/replay/simulator";
import type { Candle, ReplayStatus, SimulatedTrade } from "@/lib/replay/types";
import { loadReplayCandles } from "@/server/replay.functions";
import type { ReplayChartHandle } from "@/components/replay/ReplayChart";

// Lightweight Charts touches `window`/canvas — load it client-only.
const ReplayChart = lazy(() =>
  import("@/components/replay/ReplayChart").then((m) => ({ default: m.ReplayChart })),
);

export const Route = createFileRoute("/hub/replay")({
  head: () => ({ meta: [{ title: "Replay & Backtest — SenecaEdge" }] }),
  component: ReplayPage,
});

const SPEED_OPTIONS = [0.5, 1, 2, 4] as const;
const STARTING_EQUITY = 10000;

function ReplayPage() {
  const [assetId, setAssetId] = useState<string>("v75");
  const [timeframe, setTimeframe] = useState<TimeframeId>("5m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReplayStatus>("idle");
  const [speed, setSpeed] = useState<number>(1);
  const [cursor, setCursor] = useState(0);
  const [, forceTradesRender] = useReducer((x: number) => x + 1, 0);

  // Trade entry form state
  const [riskPct, setRiskPct] = useState("1");
  const [stopLossInput, setStopLossInput] = useState("");
  const [takeProfitInput, setTakeProfitInput] = useState("");

  const engineRef = useRef<ReplayEngine | null>(null);
  const simulatorRef = useRef<TradeSimulator>(new TradeSimulator());
  const chartRef = useRef<ReplayChartHandle | null>(null);

  const asset = findAsset(assetId);

  // Load candles whenever asset/timeframe changes
  const loadData = useCallback(async () => {
    if (!asset || !asset.enabled) return;
    setLoading(true);
    setError(null);
    try {
      const now = Math.floor(Date.now() / 1000);
      // Pull ~3000 bars worth of history
      const span = timeframeSeconds(timeframe) * 3000;
      const result = await loadReplayCandles({
        data: { provider: "deriv", symbol: asset.symbol, timeframe, from: now - span, to: now },
      });
      const cs = result.candles;
      if (cs.length === 0) {
        setError("No historical data returned. Try a different asset or timeframe.");
        setCandles([]);
        return;
      }
      setCandles(cs);
      simulatorRef.current.reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [asset, timeframe]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Build the replay engine once we have candles
  useEffect(() => {
    if (candles.length === 0) {
      engineRef.current?.destroy();
      engineRef.current = null;
      return;
    }
    const engine = new ReplayEngine({ candles, startIndex: Math.floor(candles.length / 2), speed });
    engineRef.current = engine;
    setStatus(engine.getStatus());
    setCursor(engine.getCursor());

    const unsub = engine.subscribe((ev) => {
      if (ev.type === "candle") {
        setCursor(ev.index);
        chartRef.current?.update(ev.candle);
        simulatorRef.current.onCandle(ev.candle);
      } else if (ev.type === "status") {
        setStatus(ev.status);
      } else if (ev.type === "reset") {
        setCursor(ev.index);
        // Reset chart data to visible window
        const visible = engine.getVisibleCandles();
        chartRef.current?.setData(visible);
      }
    });

    // Initial chart paint
    queueMicrotask(() => {
      chartRef.current?.setData(engine.getVisibleCandles());
    });

    return () => {
      unsub();
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  // Keep simulator subscriptions alive
  useEffect(() => {
    return simulatorRef.current.subscribe(forceTradesRender);
  }, []);

  const currentCandle = engineRef.current?.getCurrentCandle() ?? null;
  const currentPrice = currentCandle?.close ?? null;

  const handlePlay = () => engineRef.current?.play();
  const handlePause = () => engineRef.current?.pause();
  const handleStep = () => engineRef.current?.step();
  const handleReset = () => {
    if (!engineRef.current) return;
    simulatorRef.current.reset();
    engineRef.current.reset();
    chartRef.current?.setData(engineRef.current.getVisibleCandles());
    chartRef.current?.setLevels({ entry: null, sl: null, tp: null });
  };
  const handleSpeed = (s: number) => {
    setSpeed(s);
    engineRef.current?.setSpeed(s);
  };

  const openTrade = (direction: "long" | "short") => {
    if (!engineRef.current || !currentCandle) return;
    const sl = stopLossInput ? Number(stopLossInput) : null;
    const tp = takeProfitInput ? Number(takeProfitInput) : null;
    const risk = Number(riskPct) || 1;
    const trade = simulatorRef.current.openTrade({
      direction,
      entryPrice: currentCandle.close,
      stopLoss: sl != null && Number.isFinite(sl) ? sl : null,
      takeProfit: tp != null && Number.isFinite(tp) ? tp : null,
      riskPct: risk,
      openedAt: currentCandle.time,
    });
    chartRef.current?.setLevels({ entry: trade.entryPrice, sl: trade.stopLoss, tp: trade.takeProfit });
  };

  const closeAll = () => {
    if (!currentCandle) return;
    simulatorRef.current.closeAll(currentCandle);
    chartRef.current?.setLevels({ entry: null, sl: null, tp: null });
  };

  const trades = simulatorRef.current.getTrades();
  const metrics = useMemo(() => computeMetrics(trades, STARTING_EQUITY), [trades]);
  const openTrades = trades.filter((t) => t.result === "open");

  return (
    <HubPageContainer
      eyebrow="Replay · Backtest"
      title="Replay the market"
      subtitle="Step through historical price action, simulate trades, and pressure-test your edge before the next session."
      wide
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr_320px]">
        {/* LEFT — asset picker */}
        <AssetPicker
          activeId={assetId}
          onSelect={(id) => setAssetId(id)}
          timeframe={timeframe}
          onTimeframe={setTimeframe}
        />

        {/* CENTER — chart + replay controls */}
        <div className="space-y-4">
          <ChartFrame
            assetLabel={asset?.label ?? "—"}
            timeframe={timeframe}
            currentPrice={currentPrice}
            loading={loading}
            error={error}
          >
            <Suspense fallback={null}>
              <ReplayChart ref={chartRef} className="h-full w-full" />
            </Suspense>
          </ChartFrame>

          <ReplayControls
            status={status}
            speed={speed}
            cursor={cursor}
            total={candles.length}
            disabled={candles.length === 0 || loading}
            onPlay={handlePlay}
            onPause={handlePause}
            onStep={handleStep}
            onReset={handleReset}
            onSpeed={handleSpeed}
          />
        </div>

        {/* RIGHT — simulator + open trades */}
        <aside className="space-y-4">
          <SimulatorCard
            currentPrice={currentPrice}
            riskPct={riskPct}
            stopLoss={stopLossInput}
            takeProfit={takeProfitInput}
            onRisk={setRiskPct}
            onSL={setStopLossInput}
            onTP={setTakeProfitInput}
            onBuy={() => openTrade("long")}
            onSell={() => openTrade("short")}
            disabled={!currentPrice}
          />
          <OpenTradesCard trades={openTrades} onCloseAll={closeAll} currentPrice={currentPrice} />
        </aside>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Trades" value={String(metrics.trades)} hint={`${metrics.wins}W · ${metrics.losses}L`} />
        <SummaryCard
          label="Win rate"
          value={metrics.trades > 0 ? `${(metrics.winRate * 100).toFixed(0)}%` : "—"}
          hint={metrics.trades > 0 ? "Across closed trades" : "Place trades to score"}
        />
        <SummaryCard label="Avg R" value={metrics.trades > 0 ? metrics.avgR.toFixed(2) : "—"} hint={`Total ${metrics.totalR.toFixed(2)}R`} />
        <SummaryCard label="Equity" value={`$${metrics.equity.toFixed(2)}`} hint={`Started $${STARTING_EQUITY.toLocaleString()}`} />
      </div>
    </HubPageContainer>
  );
}

// ---------- Sub-components ----------

function AssetPicker({
  activeId,
  onSelect,
  timeframe,
  onTimeframe,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  timeframe: TimeframeId;
  onTimeframe: (tf: TimeframeId) => void;
}) {
  const groups = groupedAssets();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-4">
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">Timeframe</p>
        <div className="grid grid-cols-5 gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => onTimeframe(tf.id)}
              className={`rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors ${
                tf.id === timeframe
                  ? "bg-white/[0.08] text-text-primary"
                  : "text-text-secondary hover:bg-white/[0.04]"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-4">
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">
          Synthetic
        </p>
        <ul className="space-y-1">
          {groups.synthetic.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(a.id)}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                  a.id === activeId
                    ? "bg-gold/10 text-text-primary"
                    : "text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                }`}
              >
                <span className="font-medium">{a.label}</span>
                <span className="text-[10px] text-text-secondary/70">{a.symbol}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-5 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
          Forex
        </p>
        <ul className="space-y-1">
          {groups.forex.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2.5 py-2 text-left text-[12.5px] text-text-secondary/50"
                title={a.hint}
              >
                <span className="font-medium">{a.label}</span>
                <span className="text-[9.5px] uppercase tracking-wider text-text-secondary/50">Soon</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChartFrame({
  assetLabel,
  timeframe,
  currentPrice,
  loading,
  error,
  children,
}: {
  assetLabel: string;
  timeframe: string;
  currentPrice: number | null;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0F1014]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-gold" />
          <span className="text-[12.5px] font-semibold tracking-tight text-text-primary">
            {assetLabel} · {timeframe.toUpperCase()}
          </span>
          {currentPrice != null && (
            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono text-[11.5px] text-text-primary">
              {currentPrice.toFixed(currentPrice > 1000 ? 2 : 4)}
            </span>
          )}
        </div>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-text-secondary/70">
          Replay engine
        </span>
      </div>
      <div className="relative aspect-[16/9] w-full">
        {children}
        <AnimatePresence>
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-[#0F1014]/80 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 text-[12.5px] text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin text-gold" />
                Loading historical candles…
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="max-w-sm text-[12.5px] text-text-secondary">{error}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ReplayControls({
  status,
  speed,
  cursor,
  total,
  disabled,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSpeed,
}: {
  status: ReplayStatus;
  speed: number;
  cursor: number;
  total: number;
  disabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeed: (s: number) => void;
}) {
  const isPlaying = status === "playing";
  const progress = total > 0 ? (cursor / (total - 1)) * 100 : 0;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled || status === "ended"}
          className="flex items-center gap-2 rounded-lg bg-gold/15 px-3 py-2 text-[12.5px] font-medium text-text-primary transition-colors hover:bg-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <ControlButton Icon={SkipForward} label="Step" onClick={onStep} disabled={disabled} />
        <ControlButton Icon={RotateCcw} label="Reset" onClick={onReset} disabled={disabled} />

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1">
          <span className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/80">
            Speed
          </span>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeed(s)}
              className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${
                s === speed
                  ? "bg-white/[0.08] text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div className="h-full rounded-full bg-gold/60 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] uppercase tracking-[0.18em] text-text-secondary/60">
        <span>Bar {cursor + 1} / {Math.max(total, 1)}</span>
        <span>{status}</span>
      </div>
    </div>
  );
}

function ControlButton({
  Icon,
  label,
  onClick,
  disabled,
}: {
  Icon: typeof Play;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] font-medium text-text-primary transition-colors hover:border-white/10 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </button>
  );
}

function SimulatorCard({
  currentPrice,
  riskPct,
  stopLoss,
  takeProfit,
  onRisk,
  onSL,
  onTP,
  onBuy,
  onSell,
  disabled,
}: {
  currentPrice: number | null;
  riskPct: string;
  stopLoss: string;
  takeProfit: string;
  onRisk: (v: string) => void;
  onSL: (v: string) => void;
  onTP: (v: string) => void;
  onBuy: () => void;
  onSell: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">Trade simulator</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">
        Place hypothetical orders against the replay tape. Fills are computed from each new candle's high/low.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onBuy}
          disabled={disabled}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-emerald-500/10 px-3 py-2.5 text-[13px] font-semibold text-text-primary transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUpRight className="h-4 w-4 text-gold" strokeWidth={2.2} /> Buy
        </button>
        <button
          type="button"
          onClick={onSell}
          disabled={disabled}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-rose-500/10 px-3 py-2.5 text-[13px] font-semibold text-text-primary transition-colors hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowDownRight className="h-4 w-4 text-rose-300" strokeWidth={2.2} /> Sell
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Stop loss" value={stopLoss} placeholder={currentPrice ? `e.g. ${(currentPrice * 0.99).toFixed(2)}` : "—"} onChange={onSL} />
        <Field label="Take profit" value={takeProfit} placeholder={currentPrice ? `e.g. ${(currentPrice * 1.02).toFixed(2)}` : "—"} onChange={onTP} />
        <Field label="Risk %" value={riskPct} placeholder="1.0" onChange={onRisk} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[13px] text-text-primary placeholder:text-text-secondary/50 focus:border-gold/40 focus:outline-none"
      />
    </label>
  );
}

function OpenTradesCard({
  trades,
  onCloseAll,
  currentPrice,
}: {
  trades: SimulatedTrade[];
  onCloseAll: () => void;
  currentPrice: number | null;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">Open positions</p>
        {trades.length > 0 && (
          <button
            type="button"
            onClick={onCloseAll}
            className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary hover:text-text-primary"
          >
            Close all
          </button>
        )}
      </div>
      {trades.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-text-secondary">No open trades. Use Buy / Sell to enter.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {trades.map((t) => {
            const sign = t.direction === "long" ? 1 : -1;
            const unrealized = currentPrice != null ? (currentPrice - t.entryPrice) * sign : 0;
            const risk = t.stopLoss != null ? Math.abs(t.entryPrice - t.stopLoss) : 0;
            const liveR = risk > 0 ? unrealized / risk : 0;
            return (
              <li
                key={t.id}
                className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px]"
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${t.direction === "long" ? "text-gold" : "text-rose-300"}`}>
                    {t.direction.toUpperCase()} @ {t.entryPrice.toFixed(t.entryPrice > 1000 ? 2 : 4)}
                  </span>
                  <span className={`font-mono ${liveR >= 0 ? "text-gold" : "text-rose-300"}`}>
                    {liveR >= 0 ? "+" : ""}
                    {liveR.toFixed(2)}R
                  </span>
                </div>
                <div className="mt-1 flex gap-3 text-[10.5px] uppercase tracking-[0.16em] text-text-secondary/70">
                  <span>SL {t.stopLoss?.toFixed(t.entryPrice > 1000 ? 2 : 4) ?? "—"}</span>
                  <span>TP {t.takeProfit?.toFixed(t.entryPrice > 1000 ? 2 : 4) ?? "—"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#16181D] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">{label}</p>
        <TrendingUp className="h-3.5 w-3.5 text-gold/60" strokeWidth={2} />
      </div>
      <p className="mt-2 font-display text-[26px] font-semibold tracking-tight text-text-primary">{value}</p>
      <p className="mt-1 text-[12px] text-text-secondary">{hint}</p>
    </div>
  );
}

// Silence unused imports referenced only conditionally
void ASSETS;
