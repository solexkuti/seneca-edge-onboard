// PerformanceSnapshot — minimal dashboard widget for trade performance.
// Real-data only. Shows Win Rate / Net PnL / Avg RR for the last 20 trades.
// When no trades exist, renders the calibrated empty-state copy.

import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BookOpenCheck, LineChart } from "lucide-react";
import { fmtPct, fmtR } from "@/lib/tradeLogs";
import type { Metrics } from "@/lib/tradeLogs";

const ease = [0.22, 1, 0.36, 1] as const;

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
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
          Performance
        </p>
        <p className="mt-2 text-[13px] leading-snug text-text-secondary">
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
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
            Performance
          </p>
          <p className="mt-1 text-[11px] text-text-secondary/70">
            Last {metrics.totalTrades} trade{metrics.totalTrades === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          to="/hub/stats"
          preload="intent"
          className="text-[11px] font-semibold text-text-secondary/70 hover:text-text-primary inline-flex items-center gap-0.5"
        >
          Stats <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Win rate" value={fmtPct(wr, 0)} glow />
        <Stat label="Net PnL" value={fmtR(metrics.netPnlR, 2)} valueClass={netTone} glow={metrics.netPnlR > 0} />
        <Stat label="Avg RR" value={fmtR(metrics.avgRR, 2)} glow />
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          to="/hub/stats"
          preload="intent"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-background/60 p-2.5 text-[11.5px] font-semibold text-text-primary ring-1 ring-border/60 hover:bg-text-primary/[0.04] active:scale-[0.98] transition-all"
        >
          <LineChart className="h-3.5 w-3.5" strokeWidth={2.2} />
          Trade stats
        </Link>
        <Link
          to="/hub/trades"
          preload="intent"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-background/60 p-2.5 text-[11.5px] font-semibold text-text-primary ring-1 ring-border/60 hover:bg-text-primary/[0.04] active:scale-[0.98] transition-all"
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
  glow,
}: {
  label: string;
  value: string;
  valueClass?: string;
  glow?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary/55">
        {label}
      </p>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 4, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -4, filter: "blur(3px)" }}
          transition={{ duration: 0.35, ease }}
          className={`mt-1.5 text-[20px] font-semibold leading-none tabular-nums tracking-tight ${valueClass ?? "text-text-primary"}`}
          style={glow ? { textShadow: "0 0 14px rgba(198,161,91,0.22)" } : undefined}
        >
          {value}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
