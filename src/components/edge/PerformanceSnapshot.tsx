// PerformanceSnapshot — Layer 3 binding for performance_metrics.
// Always renders, even with zero trades (baseline values).

import type { PerformanceMetrics } from "@/lib/edge/metricsEngine";
import {
  STATE_COLOR,
  toneForR,
  toneForRate,
  toneForProfitFactor,
  type StateTone,
} from "@/lib/edge/metricsEngine";

function fmtR(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
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
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StateTone;
}) {
  const color = tone ? STATE_COLOR[tone] : "#FFFFFF";
  return (
    <div className="card-premium p-5 flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wider text-[#6B7280]">
        {label}
      </div>
      <div
        className="text-2xl font-extrabold tracking-tight tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-[#A1A1AA] mt-1">{hint}</div>}
    </div>
  );
}

export function PerformanceSnapshot({ metrics }: { metrics: PerformanceMetrics }) {
  const ddTone: StateTone =
    metrics.max_drawdown_R === 0
      ? "neutral"
      : metrics.max_drawdown_R > 5
        ? "loss"
        : "warn";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Performance snapshot</h3>
        <span className="text-xs text-[#6B7280]">
          {metrics.total_trades} closed trade{metrics.total_trades === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile
          label="Win rate"
          value={fmtPct(metrics.win_rate)}
          hint={`${metrics.wins}W · ${metrics.losses}L`}
          tone={metrics.total_trades === 0 ? "neutral" : toneForRate(metrics.win_rate)}
        />
        <Tile
          label="Total R"
          value={fmtR(metrics.total_R)}
          hint="Sum of closed R"
          tone={toneForR(metrics.total_R)}
        />
        <Tile
          label="Avg R"
          value={fmtR(metrics.avg_R)}
          hint="Per closed trade"
          tone={toneForR(metrics.avg_R)}
        />
        <Tile
          label="Profit factor"
          value={fmtPF(metrics.profit_factor)}
          hint="Wins ÷ |losses|"
          tone={
            metrics.total_trades === 0
              ? "neutral"
              : toneForProfitFactor(metrics.profit_factor)
          }
        />
        <Tile
          label="Expectancy"
          value={fmtR(metrics.expectancy)}
          hint="Per-trade EV"
          tone={toneForR(metrics.expectancy)}
        />
        <Tile
          label="Max drawdown"
          value={`${metrics.max_drawdown_R.toFixed(2)}R`}
          hint="Peak to trough"
          tone={ddTone}
        />
      </div>
    </section>
  );
}

export default PerformanceSnapshot;
