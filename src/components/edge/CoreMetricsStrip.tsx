// Section 1 — CORE PERFORMANCE METRICS
// Answers: "Am I profitable?"
// One clean horizontal strip. Always renders, zeros when empty.

import type { PerformanceMetrics } from "@/lib/edge/metricsEngine";
import {
  STATE_COLOR,
  toneForR,
  toneForRate,
  toneForProfitFactor,
  type StateTone,
} from "@/lib/edge/metricsEngine";

function fmtR(n: number, signed = true): string {
  if (!Number.isFinite(n)) return "—";
  return `${signed && n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
function fmtPF(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "0";
  return n.toFixed(2);
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: StateTone;
}) {
  const color = tone ? STATE_COLOR[tone] : "#FFFFFF";
  return (
    <div className="card-premium p-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
        {label}
      </div>
      <div
        className="text-2xl font-extrabold tracking-tight tabular-nums mt-1.5"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

export function CoreMetricsStrip({
  metrics,
  hasData,
}: {
  metrics: PerformanceMetrics;
  hasData: boolean;
}) {
  const ddTone: StateTone =
    metrics.max_drawdown_R === 0
      ? "neutral"
      : metrics.max_drawdown_R > 5
        ? "loss"
        : "warn";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
          Core Performance
        </h3>
        <span className="text-xs text-[#6B7280]">
          {metrics.total_trades} closed trade
          {metrics.total_trades === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile
          label="Win rate"
          value={fmtPct(metrics.win_rate)}
          tone={hasData ? toneForRate(metrics.win_rate) : "neutral"}
        />
        <Tile
          label="Total R"
          value={fmtR(metrics.total_R)}
          tone={hasData ? toneForR(metrics.total_R) : "neutral"}
        />
        <Tile
          label="Avg R"
          value={fmtR(metrics.avg_R)}
          tone={hasData ? toneForR(metrics.avg_R) : "neutral"}
        />
        <Tile
          label="Profit factor"
          value={fmtPF(metrics.profit_factor)}
          tone={hasData ? toneForProfitFactor(metrics.profit_factor) : "neutral"}
        />
        <Tile
          label="Expectancy"
          value={fmtR(metrics.expectancy)}
          tone={hasData ? toneForR(metrics.expectancy) : "neutral"}
        />
        <Tile
          label="Max drawdown"
          value={`${metrics.max_drawdown_R.toFixed(2)}R`}
          tone={ddTone}
        />
      </div>
      {!hasData && (
        <p className="text-xs italic text-[#A1A1AA] mt-3">
          Your discipline starts at 100. Protect it.
        </p>
      )}
    </section>
  );
}

export default CoreMetricsStrip;
