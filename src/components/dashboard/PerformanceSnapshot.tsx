// PerformanceSnapshot — "Recent trade" card.
// Shows ONLY the most recent trade: win/loss for that trade, its R, its RR.
// Single CTA: "Log another trade". Reinforces journaling habit immediately.

import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { fmtPct, fmtR, type TradeLog } from "@/lib/tradeLogs";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  loading: boolean;
  hasTrades: boolean;
  trades: TradeLog[];
};

function effectiveR(t: TradeLog): number {
  if (typeof t.rr === "number" && Number.isFinite(t.rr)) return t.rr;
  if (t.outcome === "win") return 1;
  if (t.outcome === "loss") return -1;
  return 0;
}

export default function PerformanceSnapshot({ loading, hasTrades, trades }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <p className="text-[12px] text-text-secondary/70">Loading recent trade…</p>
      </div>
    );
  }

  if (!hasTrades || trades.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <p className="text-[13px] leading-snug text-text-secondary">
          No trades logged yet.
        </p>
        <Link
          to="/hub/journal"
          preload="intent"
          className="btn-gold mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11.5px] font-semibold"
        >
          Log a trade <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
        </Link>
      </div>
    );
  }

  const latest = trades[0];
  const r = effectiveR(latest);
  const wr =
    latest.outcome === "win" ? 1 : latest.outcome === "loss" ? 0 : null;
  const rr = typeof latest.rr === "number" && Number.isFinite(latest.rr) ? latest.rr : r;

  const netTone =
    r > 0 ? "text-gold" : r < 0 ? "text-rose-300" : "text-text-primary";

  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border/60">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text-primary">
            {latest.pair}
            <span className="ml-2 text-[10.5px] font-semibold uppercase tracking-wider text-text-secondary/60">
              {latest.direction === "buy" ? "Long" : "Short"}
            </span>
          </p>
          <p className="mt-0.5 text-[10.5px] text-text-secondary/65">
            {new Date(latest.opened_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${
            latest.outcome === "win"
              ? "bg-gold/10 text-gold ring-gold/30"
              : latest.outcome === "loss"
                ? "bg-rose-500/10 text-rose-300 ring-rose-500/25"
                : "bg-background/60 text-text-secondary ring-border"
          }`}
        >
          {latest.outcome}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Win rate" value={fmtPct(wr, 0)} glow={wr === 1} />
        <Stat
          label={typeof latest.pnl === "number" && Number.isFinite(latest.pnl) ? "Net PnL ($)" : "Net PnL"}
          value={
            typeof latest.pnl === "number" && Number.isFinite(latest.pnl)
              ? `${latest.pnl > 0 ? "+" : latest.pnl < 0 ? "−" : ""}$${Math.abs(latest.pnl).toFixed(2)}`
              : fmtR(r, 2)
          }
          valueClass={netTone}
          glow={r > 0}
        />
        <Stat label="RR" value={fmtR(rr, 2)} glow />
      </div>

      <Link
        to="/hub/journal"
        preload="intent"
        className="btn-gold mt-5 inline-flex w-full items-center justify-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold"
      >
        Log another trade <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </Link>
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
