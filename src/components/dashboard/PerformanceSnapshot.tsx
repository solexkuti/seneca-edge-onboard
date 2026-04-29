// PerformanceSnapshot — minimal dashboard widget for trade performance.
// Real-data only. Shows Win Rate / Net PnL / Avg RR for the last 20 trades.
// When no trades exist, renders the calibrated empty-state copy.

import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpenCheck, LineChart } from "lucide-react";
import { fmtPct, fmtR } from "@/lib/tradeLogs";
import type { Metrics } from "@/lib/tradeLogs";

type Props = {
  loading: boolean;
  hasTrades: boolean;
  metrics: Metrics;
};

export default function PerformanceSnapshot({ loading, hasTrades, metrics }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <p className="text-[12px] text-text-secondary/70">Loading performance…</p>
      </div>
    );
  }

  if (!hasTrades) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <p className="text-[13px] leading-snug text-text-secondary">
          Log your first trade to activate performance tracking.
        </p>
        <Link
          to="/hub/journal"
          preload="intent"
          className="btn-gold mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11.5px] font-semibold"
        >
          Log trade <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
        </Link>
      </div>
    );
  }

  const wr = metrics.winRate;
  const netTone =
    metrics.netPnlR > 0
      ? "text-gold"
      : metrics.netPnlR < 0
        ? "text-rose-300"
        : "text-text-primary";

  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border/60">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
          Last {metrics.totalTrades} trades
        </p>
        <Link
          to="/hub/stats"
          preload="intent"
          className="text-[11px] font-semibold text-text-secondary/70 hover:text-text-primary inline-flex items-center gap-0.5"
        >
          Stats <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Win rate" value={fmtPct(wr, 0)} />
        <Stat label="Net PnL" value={fmtR(metrics.netPnlR, 2)} valueClass={netTone} />
        <Stat label="Avg RR" value={fmtR(metrics.avgRR, 2)} />
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          to="/hub/stats"
          preload="intent"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-card p-2.5 text-[11.5px] font-semibold text-text-primary ring-1 ring-border/60 active:scale-[0.98] transition-transform"
        >
          <LineChart className="h-3.5 w-3.5" strokeWidth={2.2} />
          Trade stats
        </Link>
        <Link
          to="/hub/trades"
          preload="intent"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-card p-2.5 text-[11.5px] font-semibold text-text-primary ring-1 ring-border/60 active:scale-[0.98] transition-transform"
        >
          <BookOpenCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
          Behavior
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary/55">
        {label}
      </p>
      <p
        className={`mt-1.5 text-[18px] font-semibold leading-none tabular-nums tracking-tight ${valueClass ?? "text-text-primary"}`}
      >
        {value}
      </p>
    </div>
  );
}
