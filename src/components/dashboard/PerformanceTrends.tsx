// PerformanceTrends — animated rolling win-rate + cumulative net PnL (R)
// across the last 20 trades. Real data only: `trades` come from trade_logs
// via usePerformance. Empty state mirrors the rest of the dashboard.
//
// Visuals stay inside the Dark + Gold identity:
//  - PnL line uses the gold ramp (with a soft glow on the latest point).
//  - Win-rate line uses muted text so the eye lands on PnL first.
//  - Both paths animate in via SVG stroke-dashoffset on mount + data change.

import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import type { TradeLog } from "@/lib/tradeLogs";
import { fmtPct, fmtR } from "@/lib/tradeLogs";

type Metric = "r" | "abs";

function fmtAbs(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const abs = Math.abs(v);
  // Compact for large balances
  const formatted =
    abs >= 1000
      ? abs.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : abs.toFixed(digits);
  return `${sign}$${formatted}`;
}

const ease = [0.22, 1, 0.36, 1] as const;

// Geometry
const W = 432;
const H = 140;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;

function effectiveR(t: TradeLog): number {
  if (typeof t.rr === "number" && Number.isFinite(t.rr)) return t.rr;
  if (t.outcome === "win") return 1;
  if (t.outcome === "loss") return -1;
  return 0;
}

type Series = {
  pnlR: number[];        // cumulative R after each trade
  pnlAbs: number[];      // cumulative absolute PnL after each trade ($)
  winRate: number[];     // rolling win rate after each trade (decided only)
  finalPnlR: number;
  finalPnlAbs: number;
  finalWinRate: number | null;
  trendR: "up" | "down" | "flat";
  trendAbs: "up" | "down" | "flat";
  hasAbs: boolean;       // any trade carried an absolute pnl value
};

function trendOf(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const a = values[values.length - 2];
  const b = values[values.length - 1];
  return b > a ? "up" : b < a ? "down" : "flat";
}

function buildSeries(trades: TradeLog[]): Series {
  // Oldest → newest for cumulative math.
  const ordered = [...trades].reverse();
  const pnlR: number[] = [];
  const pnlAbs: number[] = [];
  const winRate: number[] = [];
  let cumR = 0;
  let cumAbs = 0;
  let wins = 0;
  let decided = 0;
  let hasAbs = false;

  for (const t of ordered) {
    cumR += effectiveR(t);
    pnlR.push(cumR);

    if (typeof t.pnl === "number" && Number.isFinite(t.pnl)) {
      cumAbs += t.pnl;
      hasAbs = true;
    }
    pnlAbs.push(cumAbs);

    if (t.outcome === "win") {
      wins += 1;
      decided += 1;
    } else if (t.outcome === "loss") {
      decided += 1;
    }
    winRate.push(decided > 0 ? wins / decided : 0);
  }

  return {
    pnlR,
    pnlAbs,
    winRate,
    finalPnlR: pnlR[pnlR.length - 1] ?? 0,
    finalPnlAbs: pnlAbs[pnlAbs.length - 1] ?? 0,
    finalWinRate: decided > 0 ? wins / decided : null,
    trendR: trendOf(pnlR),
    trendAbs: trendOf(pnlAbs),
    hasAbs,
  };
}

function pathFrom(values: number[], min: number, max: number): string {
  if (values.length === 0) return "";
  const span = max - min || 1;
  const stepX =
    values.length === 1 ? 0 : (W - PAD_X * 2) / (values.length - 1);
  const y = (v: number) =>
    PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);
  const x = (i: number) => PAD_X + i * stepX;
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");
}

function areaFrom(values: number[], min: number, max: number): string {
  if (values.length === 0) return "";
  const stepX =
    values.length === 1 ? 0 : (W - PAD_X * 2) / (values.length - 1);
  const line = pathFrom(values, min, max);
  const lastX = (PAD_X + (values.length - 1) * stepX).toFixed(2);
  const baseY = (H - PAD_BOTTOM).toFixed(2);
  return `${line} L ${lastX} ${baseY} L ${PAD_X.toFixed(2)} ${baseY} Z`;
}

export default function PerformanceTrends({
  loading,
  hasTrades,
  trades,
}: {
  loading: boolean;
  hasTrades: boolean;
  trades: TradeLog[];
}) {
  const gradId = useId();
  const series = useMemo(() => buildSeries(trades), [trades]);
  const [metric, setMetric] = useState<Metric>("r");

  // Auto-disable absolute toggle when no trade carries a $ value.
  const absDisabled = !series.hasAbs;
  const activeMetric: Metric = absDisabled ? "r" : metric;

  const activeSeries = activeMetric === "r" ? series.pnlR : series.pnlAbs;
  const finalPnl =
    activeMetric === "r" ? series.finalPnlR : series.finalPnlAbs;
  const trend = activeMetric === "r" ? series.trendR : series.trendAbs;
  const fmtMetric = activeMetric === "r" ? fmtR : fmtAbs;

  const count = activeSeries.length;
  const showChart = !loading && hasTrades && count >= 2;

  // PnL bounds (always include zero so the baseline is meaningful).
  const pnlMin = Math.min(0, ...activeSeries);
  const pnlMax = Math.max(0, ...activeSeries);
  // Padding scales with the metric — R values are typically <10, $ may be 1000s.
  const pnlPad = Math.max(
    activeMetric === "r" ? 0.5 : 1,
    (pnlMax - pnlMin) * 0.15,
  );
  const pMin = pnlMin - pnlPad;
  const pMax = pnlMax + pnlPad;

  const pnlPath = pathFrom(activeSeries, pMin, pMax);
  const pnlArea = areaFrom(activeSeries, pMin, pMax);
  const winPath = pathFrom(series.winRate, 0, 1);

  // Zero baseline (in PnL coordinate space).
  const zeroY =
    PAD_TOP + (1 - (0 - pMin) / (pMax - pMin || 1)) * (H - PAD_TOP - PAD_BOTTOM);

  // Latest point glow position.
  const stepX =
    count > 1 ? (W - PAD_X * 2) / (count - 1) : 0;
  const lastX = PAD_X + (count - 1) * stepX;
  const lastY =
    PAD_TOP +
    (1 - (finalPnl - pMin) / (pMax - pMin || 1)) *
      (H - PAD_TOP - PAD_BOTTOM);

  const TrendIcon = trend === "down" ? TrendingDown : TrendingUp;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
            Last {count > 0 ? count : 20} trades
          </p>
          <p className="mt-1 text-[13.5px] font-semibold leading-snug text-text-primary">
            Performance trend
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Metric toggle */}
          <div
            role="tablist"
            aria-label="Chart metric"
            className="inline-flex items-center rounded-full bg-background/60 p-0.5 ring-1 ring-border"
          >
            <ToggleSeg
              active={activeMetric === "r"}
              onClick={() => setMetric("r")}
              label="R"
              ariaLabel="Show risk units"
            />
            <ToggleSeg
              active={activeMetric === "abs"}
              onClick={() => !absDisabled && setMetric("abs")}
              label="$"
              ariaLabel="Show absolute net PnL"
              disabled={absDisabled}
            />
          </div>
          <Link
            to="/hub/stats"
            preload="intent"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/60 px-2.5 py-1 text-[10.5px] font-semibold text-text-primary/85 ring-1 ring-border hover:text-text-primary"
          >
            Stats
            <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-4 flex items-end gap-5 px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/55">
            Net PnL {activeMetric === "r" ? "(R)" : "($)"}
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <motion.span
              key={`pnl-${activeMetric}-${finalPnl}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
              className={`text-[22px] font-semibold leading-none tabular-nums ${
                finalPnl > 0
                  ? "text-gold"
                  : finalPnl < 0
                    ? "text-rose-300"
                    : "text-text-primary"
              }`}
              style={
                finalPnl > 0
                  ? { textShadow: "0 0 18px rgba(198,161,91,0.35)" }
                  : undefined
              }
            >
              {showChart ? fmtMetric(finalPnl) : "—"}
            </motion.span>
            {showChart && (
              <TrendIcon
                className={`h-3.5 w-3.5 ${
                  trend === "down"
                    ? "text-rose-300"
                    : trend === "up"
                      ? "text-gold"
                      : "text-text-secondary/60"
                }`}
                strokeWidth={2.4}
              />
            )}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/55">
            Win rate
          </p>
          <motion.p
            key={`wr-${series.finalWinRate ?? "na"}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: 0.05 }}
            className="mt-1 text-[22px] font-semibold leading-none tabular-nums text-text-primary"
          >
            {showChart ? fmtPct(series.finalWinRate) : "—"}
          </motion.p>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-3 px-1.5 pb-3">
        {!showChart ? (
          <div className="m-3 rounded-xl bg-background/40 px-4 py-6 text-center ring-1 ring-border/50">
            <p className="text-[12.5px] text-text-primary">
              {loading
                ? "Loading…"
                : !hasTrades
                  ? "Log your first trade to activate performance tracking."
                  : "Log one more trade to see the trend."}
            </p>
            {!loading && !hasTrades && (
              <Link
                to="/hub/journal"
                preload="intent"
                className="mt-3 inline-flex items-center rounded-full bg-primary/15 px-3.5 py-1.5 text-[11.5px] font-semibold text-text-primary ring-1 ring-primary/30"
              >
                Log a trade
              </Link>
            )}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[140px] w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Performance trend over the last 20 trades"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(198, 161, 91, 0.35)" />
                <stop offset="100%" stopColor="rgba(198, 161, 91, 0)" />
              </linearGradient>
            </defs>

            {/* Zero baseline */}
            <line
              x1={PAD_X}
              x2={W - PAD_X}
              y1={zeroY}
              y2={zeroY}
              stroke="currentColor"
              className="text-text-secondary/20"
              strokeDasharray="2 4"
              strokeWidth={1}
            />

            {/* PnL area (fades in) */}
            <motion.path
              d={pnlArea}
              fill={`url(#${gradId})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease, delay: 0.15 }}
            />

            {/* Win-rate line — muted */}
            <motion.path
              d={winPath}
              fill="none"
              stroke="currentColor"
              className="text-text-secondary/55"
              strokeWidth={1.25}
              strokeDasharray="3 3"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease, delay: 0.1 }}
            />

            {/* PnL line — gold */}
            <motion.path
              d={pnlPath}
              fill="none"
              stroke="var(--gold)"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.0, ease }}
              style={{ filter: "drop-shadow(0 0 6px rgba(198,161,91,0.35))" }}
            />

            {/* Latest point */}
            <motion.circle
              cx={lastX}
              cy={lastY}
              r={3}
              fill="var(--gold)"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease, delay: 1.0 }}
              style={{ filter: "drop-shadow(0 0 6px rgba(231,201,138,0.65))" }}
            />
          </svg>
        )}
      </div>

      {/* Legend */}
      {showChart && (
        <div className="flex items-center gap-4 border-t border-border/50 px-5 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-text-secondary/80">
            <span className="h-[2px] w-3 rounded-full bg-gold" />
            Net PnL (R)
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-text-secondary/65">
            <span className="h-[2px] w-3 rounded-full border-t border-dashed border-text-secondary/55" />
            Win rate
          </span>
        </div>
      )}
    </div>
  );
}
