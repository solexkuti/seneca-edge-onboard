// TradeHistory — Phase 3 redesign.
//
// Reads directly from the unified `trades` table (executed + missed),
// runs each row through tradeFromRow() so every downstream renderer sees
// the canonical Trade object, then groups by day. Hybrid card layout per
// spec: thumbnail · header · body (rules followed/broken, expandable).
//
// UX guarantee (Section 13): in 5 seconds the user knows what they
// traded, what they did wrong, which rules broke, when, and what it cost.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  Filter,
  ImageOff,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  tradeFromRow,
  type Trade,
  type TradeRow,
  MISSED_REASON_LABELS,
} from "@/lib/trade";
import { getScreenshotUrl } from "@/lib/behavioralJournal";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";
import { useSsot } from "@/hooks/useSsot";
import { formatMetric } from "@/lib/fxService";
import type { MetricDisplayMode } from "@/lib/ssot";
import {
  humanizeViolation,
  violationSeverity,
  severityTone,
  severityRank,
} from "@/lib/violationLabels";

const ease = [0.22, 1, 0.36, 1] as const;

type TypeFilter = "all" | "executed" | "missed";
type RangeFilter = "7d" | "30d" | "all";

const TYPE_TABS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "executed", label: "Executed" },
  { id: "missed", label: "Missed" },
];

const RANGE_TABS: { id: RangeFilter; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All time" },
];

type FmtCtx = { mode: MetricDisplayMode; cur: string; rate: number; risk: number | null };

function fmtMetricRow(n: number | null, ctx: FmtCtx): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const amt = ctx.risk != null && ctx.risk > 0 ? n * ctx.risk * ctx.rate : null;
  return formatMetric({ r: n, amountInDisplayCurrency: amt, displayCurrency: ctx.cur, mode: ctx.mode });
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TradeHistory() {
  const { ssot } = useSsot();
  const fmtCtx: FmtCtx = {
    mode: ssot.account.metric_display_mode,
    cur: ssot.analytics.display_currency,
    rate: ssot.analytics.exchange_rate,
    risk: ssot.account.risk_per_trade,
  };
  const fmtR = (n: number | null) => fmtMetricRow(n, fmtCtx);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("30d");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        if (!cancelled) {
          setTrades([]);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .order("executed_at", { ascending: false })
        .limit(200);

      if (cancelled) return;
      if (error) {
        console.error("[history] fetch failed", error);
        setTrades([]);
      } else {
        setTrades((data as unknown as TradeRow[]).map(tradeFromRow));
      }
      setLoading(false);
    }
    load();

    const onUpdate = () => load();
    window.addEventListener(JOURNAL_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(JOURNAL_EVENT, onUpdate);
    };
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      rangeFilter === "7d"
        ? now - 7 * 86400_000
        : rangeFilter === "30d"
          ? now - 30 * 86400_000
          : 0;
    return trades.filter((t) => {
      if (typeFilter !== "all" && t.tradeType !== typeFilter) return false;
      if (cutoff && new Date(t.createdAt).getTime() < cutoff) return false;
      return true;
    });
  }, [trades, typeFilter, rangeFilter]);

  // Group by day
  const groups = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of filtered) {
      const key = t.createdAt.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Day-level stats
  const dayStats = (list: Trade[]) => {
    const exec = list.filter((t) => t.tradeType === "executed");
    const totalR = exec.reduce((s, t) => s + (t.resultR ?? 0), 0);
    const broken = exec.filter((t) => t.rulesBroken.length > 0).length;
    return { totalR, broken, count: list.length };
  };

  return (
    <div className="relative min-h-[100svh] w-full bg-[#0B0B0D]">
      <div className="relative z-10 mx-auto w-full max-w-[640px] px-5 pt-8 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/hub"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9A9A9A] hover:text-[#EDEDED]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9A9A9A]/80">
            Trade History
          </span>
        </header>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <h1 className="font-serif text-[26px] tracking-tight text-[#EDEDED]">
              Trade history
            </h1>
            <p className="mt-1 text-[12.5px] text-[#9A9A9A]">
              {loading ? "Loading…" : `${filtered.length} trades`}
            </p>
          </div>
          <Link
            to="/hub/journal"
            className="rounded-full bg-[#C6A15B]/15 ring-1 ring-[#C6A15B]/40 px-3.5 py-2 text-[11.5px] font-semibold text-[#E7C98A] hover:bg-[#C6A15B]/20 transition"
          >
            Log trade
          </Link>
        </div>

        {/* Filters */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]/70">
            <Filter className="h-3 w-3" />
            <span>Filter</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#18181A] p-1 ring-1 ring-white/5">
            {TYPE_TABS.map((t) => {
              const active = typeFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    active
                      ? "bg-[#C6A15B]/15 text-[#E7C98A] ring-1 ring-[#C6A15B]/30"
                      : "text-[#9A9A9A] hover:text-[#EDEDED]"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#18181A] p-1 ring-1 ring-white/5">
            {RANGE_TABS.map((r) => {
              const active = rangeFilter === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRangeFilter(r.id)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    active
                      ? "bg-[#C6A15B]/15 text-[#E7C98A] ring-1 ring-[#C6A15B]/30"
                      : "text-[#9A9A9A] hover:text-[#EDEDED]"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        {loading && (
          <div className="mt-12 flex items-center justify-center text-[#9A9A9A]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading trades…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="mt-12 rounded-2xl bg-[#18181A] ring-1 ring-white/5 p-6 text-center">
            <p className="text-[13.5px] text-[#EDEDED]">No trades in this view.</p>
            <p className="mt-1 text-[12px] text-[#9A9A9A]">
              Try a different filter, or log a trade to get started.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {groups.map(([day, list]) => {
            const s = dayStats(list);
            return (
              <section key={day}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A]">
                    {fmtDay(list[0].createdAt)}
                  </h2>
                  <div className="flex items-center gap-3 text-[10.5px] tabular-nums text-[#9A9A9A]">
                    <span>{s.count} trades</span>
                    {s.broken > 0 && (
                      <span className="text-rose-400/90">
                        {s.broken} rule break{s.broken > 1 ? "s" : ""}
                      </span>
                    )}
                    <span
                      className={
                        s.totalR > 0
                          ? "text-[#E7C98A]"
                          : s.totalR < 0
                            ? "text-rose-400/90"
                            : "text-[#9A9A9A]"
                      }
                    >
                      {fmtR(s.totalR)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {list.map((t, i) => (
                    <TradeCard
                      key={t.id}
                      trade={t}
                      delay={Math.min(i, 6) * 0.03}
                      expanded={expandedId === t.id}
                      onToggle={() =>
                        setExpandedId(expandedId === t.id ? null : t.id)
                      }
                      onPreview={async (path) => {
                        const url = await getScreenshotUrl(path);
                        if (url) setPreviewUrl(url);
                      }}
                      fmtR={fmtR}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {previewUrl && (
          <motion.button
            type="button"
            onClick={() => setPreviewUrl(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0D]/95 backdrop-blur-sm p-4"
          >
            <X className="absolute right-5 top-5 h-6 w-6 text-[#EDEDED]/80" />
            <img
              src={previewUrl}
              alt="Trade screenshot"
              className="max-h-[90vh] max-w-full rounded-xl object-contain ring-1 ring-white/10"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────── Card ─────────────────────────

function TradeCard({
  trade,
  delay,
  expanded,
  onToggle,
  onPreview,
  fmtR,
}: {
  trade: Trade;
  delay: number;
  expanded: boolean;
  onToggle: () => void;
  onPreview: (path: string) => void;
  fmtR: (n: number | null) => string;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (trade.screenshotUrl) {
      getScreenshotUrl(trade.screenshotUrl).then((u) => {
        if (!cancelled) setThumb(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [trade.screenshotUrl]);

  const isMissed = trade.tradeType === "missed";
  const r = trade.resultR;
  const broken = trade.rulesBroken.length;
  const followed = trade.rulesFollowed.length;
  const hasDetails =
    trade.notes ||
    trade.rulesBroken.length > 0 ||
    trade.rulesFollowed.length > 0 ||
    isMissed;

  const DirIcon = trade.direction === "buy" ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease, delay }}
      className={`rounded-xl bg-[#18181A] ring-1 transition-colors ${
        isMissed
          ? "ring-[#C6A15B]/20"
          : broken > 0
            ? "ring-rose-500/15"
            : "ring-white/5"
      }`}
    >
      <div className="flex items-start gap-3 p-3.5">
        {/* Thumbnail */}
        <button
          type="button"
          onClick={() =>
            trade.screenshotUrl && onPreview(trade.screenshotUrl)
          }
          disabled={!trade.screenshotUrl}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#0B0B0D] ring-1 ring-white/10 flex items-center justify-center"
        >
          {isMissed ? (
            <Eye className="h-5 w-5 text-[#C6A15B]/70" />
          ) : thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-4 w-4 text-[#9A9A9A]/50" />
          )}
        </button>

        {/* Header + body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-[#EDEDED]">
              {trade.asset || "—"}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ring-1 ${
                trade.direction === "buy"
                  ? "bg-[#C6A15B]/10 ring-[#C6A15B]/25 text-[#E7C98A]"
                  : "bg-rose-500/10 ring-rose-500/25 text-rose-300"
              }`}
            >
              <DirIcon className="h-2.5 w-2.5" />
              {trade.direction === "buy" ? "Long" : "Short"}
            </span>
            {isMissed && (
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ring-1 bg-[#C6A15B]/10 ring-[#C6A15B]/30 text-[#E7C98A]">
                <Eye className="h-2.5 w-2.5" /> Missed
              </span>
            )}
            {!isMissed && trade.executionType && (
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ring-1 ${
                  trade.executionType === "controlled"
                    ? "bg-emerald-500/10 ring-emerald-500/25 text-emerald-300"
                    : "bg-amber-500/10 ring-amber-500/25 text-amber-300"
                }`}
              >
                {trade.executionType}
              </span>
            )}
          </div>

          <p className="mt-0.5 text-[10.5px] text-[#9A9A9A]/80">
            {fmtTime(trade.createdAt)}
            {trade.session && ` · ${trade.session}`}
            {trade.marketType && ` · ${trade.marketType}`}
          </p>

          {/* Quick rule summary — humanized + severity-colored */}
          {!isMissed && (broken > 0 || followed > 0) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
              {followed > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-400/90">
                  ✓ {followed} clean
                </span>
              )}
              {trade.rulesBroken.slice(0, 2).map((r) => {
                const tone = severityTone(violationSeverity(r));
                return (
                  <span
                    key={r}
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${tone.ring} ${tone.bg} ${tone.text}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
                    {humanizeViolation(r)}
                  </span>
                );
              })}
              {trade.rulesBroken.length > 2 && (
                <span className="text-[#9A9A9A]/70">+{trade.rulesBroken.length - 2} more</span>
              )}
            </div>
          )}

          {/* Missed-trade row: minimal reason chip only — full context in expanded view */}
          {isMissed && trade.missedPotentialR != null && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#E7C98A]">
              <Target className="h-3 w-3" /> {trade.missedPotentialR.toFixed(1)}R missed
            </p>
          )}
        </div>

        {/* Right column — outcome */}
        <div className="shrink-0 text-right">
          {isMissed ? (
            <p className="text-[12px] uppercase tracking-wider text-[#C6A15B]">
              Not taken
            </p>
          ) : (
            <p
              className={`text-[14px] font-semibold tabular-nums ${
                (r ?? 0) > 0
                  ? "text-[#E7C98A]"
                  : (r ?? 0) < 0
                    ? "text-rose-400"
                    : "text-[#9A9A9A]"
              }`}
            >
              {fmtR(r)}
            </p>
          )}
          {hasDetails && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? "Collapse" : "Expand"}
              className="mt-1 inline-flex items-center justify-center rounded-md p-1 text-[#9A9A9A] hover:text-[#EDEDED] transition-colors"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Expanded — Behavioral Replay (case-file layout) */}
      <AnimatePresence initial={false}>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-4 py-5 space-y-5">
              {/* SECTION 1 — Visual replay (large, click-to-zoom) */}
              {thumb ? (
                <button
                  type="button"
                  onClick={() => trade.screenshotUrl && onPreview(trade.screenshotUrl)}
                  className="group block w-full overflow-hidden rounded-xl ring-1 ring-white/10 bg-[#0B0B0D] relative"
                >
                  <img
                    src={thumb}
                    alt="Trade replay"
                    loading="lazy"
                    className="w-full max-h-[420px] object-contain transition-transform group-hover:scale-[1.01]"
                  />
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[9.5px] uppercase tracking-wider text-white/80 backdrop-blur-sm">
                    Click to zoom
                  </span>
                </button>
              ) : (
                <div className="rounded-xl ring-1 ring-white/5 bg-[#0B0B0D] p-6 text-center">
                  <ImageOff className="mx-auto h-5 w-5 text-[#9A9A9A]/50 mb-2" />
                  <p className="text-[11.5px] text-[#9A9A9A]/80 italic">
                    No chart evidence attached.
                  </p>
                </div>
              )}

              {/* SECTION 2 — Behavioral breakdown (humanized + R-impact) */}
              {!isMissed && trade.rulesBroken.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]/80 mb-2">
                    Behavioral breakdown
                  </p>
                  <ul className="space-y-1.5">
                    {trade.rulesBroken.map((r) => {
                      const sev = violationSeverity(r);
                      const tone = severityTone(sev);
                      // R impact spread evenly across violations on a losing trade.
                      const impact =
                        (trade.resultR ?? 0) < 0
                          ? (trade.resultR ?? 0) / trade.rulesBroken.length
                          : 0;
                      return (
                        <li
                          key={r}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${tone.bg} ring-1 ${tone.ring}`}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone.dot }} />
                          <div className="min-w-0 flex-1">
                            <p className={`text-[12.5px] ${tone.text}`}>{humanizeViolation(r)}</p>
                            <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70 mt-0.5">
                              {sev} severity
                            </p>
                          </div>
                          {impact !== 0 && (
                            <span className="text-[11px] font-semibold tabular-nums text-rose-300 shrink-0">
                              {fmtR(impact)}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Behavior loop callout */}
              {!isMissed && trade.rulesBroken.length >= 2 && (
                <div className="rounded-lg bg-rose-500/5 ring-1 ring-rose-500/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-rose-300/80 mb-1">
                    Behavior loop detected
                  </p>
                  <p className="text-[12px] text-[#EDEDED]/85 leading-relaxed">
                    Multiple violations stacked on a single trade — execution discipline collapsed mid-decision.
                  </p>
                </div>
              )}

              {!isMissed && trade.rulesFollowed.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-400/80 mb-1.5">
                    What you did right
                  </p>
                  <ul className="space-y-1">
                    {trade.rulesFollowed.map((r) => (
                      <li
                        key={r}
                        className="text-[12px] text-[#EDEDED]/85 flex items-start gap-1.5"
                      >
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        <span>{humanizeViolation(r)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SECTION 3 — Execution context pills */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]/80 mb-2">
                  Execution context
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ["Session", trade.session],
                    ["Market", trade.marketType],
                    ["Direction", trade.direction === "buy" ? "Long" : "Short"],
                    ["Quality", trade.executionType],
                    ["Planned RR", trade.riskR != null ? `${trade.riskR.toFixed(2)}R` : null],
                    ["Result", trade.resultR != null ? fmtR(trade.resultR) : null],
                  ]
                    .filter(([, v]) => v != null && v !== "")
                    .map(([k, v]) => (
                      <span
                        key={k as string}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0B0B0D] ring-1 ring-white/10 px-2.5 py-1 text-[10.5px]"
                      >
                        <span className="text-[#9A9A9A]/70 uppercase tracking-wider text-[9px]">
                          {k as string}
                        </span>
                        <span className="text-[#EDEDED]/85">{String(v)}</span>
                      </span>
                    ))}
                </div>
              </div>

              {/* SECTION 4 — Trader reflection (prominent, quote-styled) */}
              {(trade.notes || isMissed) && (
                <div className={`rounded-xl ${isMissed ? "ring-[#C6A15B]/20 bg-[#C6A15B]/[0.04]" : "ring-white/10 bg-[#0B0B0D]"} ring-1 p-4`}>
                  <p className={`text-[10px] uppercase tracking-[0.18em] mb-2 ${isMissed ? "text-[#C6A15B]/80" : "text-[#9A9A9A]/80"}`}>
                    {isMissed ? "Missed opportunity analysis" : "Trader reflection"}
                  </p>
                  {trade.notes ? (
                    <blockquote className="border-l-2 border-[#C6A15B]/40 pl-3 text-[13px] leading-relaxed italic text-[#EDEDED]/90">
                      "{trade.notes}"
                    </blockquote>
                  ) : (
                    <p className="text-[11.5px] text-[#9A9A9A]/80 italic">
                      No reflection captured. Next time, write down what stopped you — that's the data that matters.
                    </p>
                  )}
                  {isMissed && trade.missedReason && (
                    <p className="mt-2.5 text-[10.5px] text-[#9A9A9A]/70">
                      Emotional trigger · <span className="text-[#EDEDED]/80">{MISSED_REASON_LABELS[trade.missedReason]}</span>
                      {trade.missedPotentialR != null && (
                        <> · estimated <span className="text-[#E7C98A]">{trade.missedPotentialR.toFixed(1)}R</span> missed</>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Prices */}
              {!isMissed && (trade.entryPrice != null ||
                trade.exitPrice != null ||
                trade.stopLoss != null ||
                trade.takeProfit != null) && (
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/5">
                  {[
                    ["Entry", trade.entryPrice],
                    ["Exit", trade.exitPrice],
                    ["SL", trade.stopLoss],
                    ["TP", trade.takeProfit],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <p className="text-[9px] uppercase tracking-wider text-[#9A9A9A]/70">
                        {label as string}
                      </p>
                      <p className="text-[11px] tabular-nums text-[#EDEDED]/80 pt-1">
                        {val != null ? Number(val).toString() : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
