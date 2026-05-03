// Trade Stats screen — real metrics from trade_logs only.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  computeMetrics,
  fetchTradeLogs,
  fmtNumber,
  fmtPct,
  fmtR,
  rangeBoundaries,
  type TimeRange,
  type TradeLog,
} from "@/lib/tradeLogs";
import { metricColorStyle, metricToneFromRatio } from "@/lib/metricColor";

const RANGES: { id: TimeRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
];

type SessionFilter = "all" | "London" | "NY" | "Asia";
const SESSIONS: { id: SessionFilter; label: string }[] = [
  { id: "all", label: "All sessions" },
  { id: "London", label: "London" },
  { id: "NY", label: "NY" },
  { id: "Asia", label: "Asia" },
];

export default function TradeStats() {
  const [range, setRange] = useState<TimeRange>("week");
  const [session, setSession] = useState<SessionFilter>("all");
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { since, until } = rangeBoundaries(range);
    fetchTradeLogs({
      since: since ?? undefined,
      until: until ?? undefined,
      limit: 1000,
    })
      .then((t) => {
        if (!cancelled) setTrades(t);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const filtered = useMemo(
    () => (session === "all" ? trades : trades.filter((t) => t.session_tag === session)),
    [trades, session],
  );
  const m = useMemo(() => computeMetrics(filtered), [filtered]);
  const empty = !loading && filtered.length === 0;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-50" />
      <div className="relative z-10 mx-auto w-full max-w-[480px] px-5 pt-8 pb-24">
        <header className="flex items-center justify-between">
          <Link
            to="/hub"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70 hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
            Trade stats
          </span>
        </header>

        <h1 className="mt-6 text-[22px] font-semibold tracking-tight text-text-primary">
          Performance
        </h1>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Derived from your real, stored trades.
        </p>

        <div className="mt-5 flex gap-1.5 overflow-x-auto no-scrollbar">
          {RANGES.map((r) => {
            const active = range === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold ring-1 transition ${
                  active
                    ? "bg-primary/20 ring-primary/40 text-text-primary"
                    : "bg-card ring-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex gap-1.5 overflow-x-auto no-scrollbar">
          {SESSIONS.map((s) => {
            const active = session === s.id;
            const count =
              s.id === "all"
                ? trades.length
                : trades.filter((t) => t.session_tag === s.id).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSession(s.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 transition ${
                  active
                    ? "bg-primary/20 ring-primary/40 text-text-primary"
                    : "bg-card ring-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {s.label}
                <span className="ml-1.5 text-text-secondary/60 tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {empty ? (
          <div className="mt-12 rounded-2xl bg-card ring-1 ring-border p-6 text-center">
            <p className="text-[13.5px] text-text-primary">
              Log your first trade to activate performance tracking.
            </p>
            <Link
              to="/hub/journal"
              className="mt-4 inline-flex items-center rounded-full bg-primary/15 ring-1 ring-primary/30 px-4 py-2 text-[12px] font-semibold text-text-primary"
            >
              Log a trade
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Card
              label="Win rate"
              value={fmtPct(m.winRate)}
              tone={
                metricToneFromRatio(m.winRate) === "good"
                  ? "ok"
                  : metricToneFromRatio(m.winRate) === "warn"
                    ? "warn"
                    : metricToneFromRatio(m.winRate) === "bad"
                      ? "risk"
                      : undefined
              }
            />
            <Card label="Total trades" value={`${m.totalTrades}`} />
            <Card
              label="Net PnL"
              value={fmtR(m.netPnlR)}
              tone={m.netPnlR > 0 ? "ok" : m.netPnlR < 0 ? "risk" : undefined}
            />
            <Card label="Avg RR" value={fmtR(m.avgRR)} />
            <Card
              label="Profit factor"
              value={
                m.profitFactor === null
                  ? "—"
                  : m.profitFactor === Infinity
                    ? "∞"
                    : fmtNumber(m.profitFactor)
              }
            />
            <Card
              label="W / L / BE"
              value={`${m.wins} · ${m.losses} · ${m.breakeven}`}
            />
            <Card
              label="Largest win"
              value={fmtR(m.largestWinR)}
              tone="ok"
            />
            <Card
              label="Largest loss"
              value={fmtR(m.largestLossR)}
              tone="risk"
            />
          </div>
        )}

        <div className="mt-8 flex gap-2">
          <Link
            to="/hub/trades"
            className="flex-1 rounded-full bg-card ring-1 ring-border px-4 py-3 text-center text-[12.5px] font-semibold text-text-primary"
          >
            Trade journal
          </Link>
          <Link
            to="/hub/journal/history"
            className="flex-1 rounded-full bg-card ring-1 ring-border px-4 py-3 text-center text-[12.5px] font-semibold text-text-primary"
          >
            Behavior breakdown
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "risk";
}) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
        {label}
      </p>
      <p
        className={`mt-2 text-[22px] font-semibold tabular-nums ${
          tone === "ok"
            ? "text-emerald-300"
            : tone === "risk"
              ? "text-rose-300"
              : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
