// BehaviorBreakdown — Phase 4 surface.
//
// Reads the unified `trades` table, runs analysis.* + insights.generateInsights
// from src/lib/trade, then renders three premium panels:
//
//   1. Score & Adherence header (score · clean ratio · execution split)
//   2. Asset Behavior — per-asset card grid (disciplined / emotional / inconsistent)
//   3. Rule Violations — full table with time-window filter
//
// Pure intelligence surface. Never blocks. Never lectures. Insights at the top
// give the user the 5-second answer per Section 13 of the spec.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  tradeFromRow,
  behaviorScore,
  ruleAdherence,
  executionSplit,
  ruleViolations,
  assetBehavior,
  generateInsights,
  type Trade,
  type TradeRow,
  type Insight,
  type AssetBehavior,
  type RuleViolationRow,
} from "@/lib/trade";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";
import { ViolationDetailModal } from "@/components/feature/ViolationDetailModal";

const ease = [0.22, 1, 0.36, 1] as const;

type RangeFilter = "7d" | "30d" | "all";
const RANGE_TABS: { id: RangeFilter; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All" },
];

function fmtR(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}R`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400_000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const SEVERITY_TONE: Record<Insight["severity"], string> = {
  positive: "bg-emerald-500/10 ring-emerald-500/25 text-emerald-300",
  neutral: "bg-[#18181A] ring-white/10 text-[#9A9A9A]",
  warning: "bg-amber-500/10 ring-amber-500/25 text-amber-300",
  critical: "bg-rose-500/10 ring-rose-500/25 text-rose-300",
};

const ASSET_LABEL_TONE: Record<AssetBehavior["label"], string> = {
  disciplined: "text-emerald-300",
  emotional: "text-rose-300",
  inconsistent: "text-amber-300",
};

export default function BehaviorBreakdown() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeFilter>("30d");
  const [openViolation, setOpenViolation] = useState<RuleViolationRow | null>(null);

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
        .limit(500);
      if (cancelled) return;
      if (error) {
        console.error("[breakdown] fetch failed", error);
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

  const scoped = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === "7d" ? now - 7 * 86400_000 : range === "30d" ? now - 30 * 86400_000 : 0;
    if (!cutoff) return trades;
    return trades.filter((t) => new Date(t.createdAt).getTime() >= cutoff);
  }, [trades, range]);

  const score = useMemo(() => behaviorScore(scoped), [scoped]);
  const adherence = useMemo(() => ruleAdherence(scoped), [scoped]);
  const split = useMemo(() => executionSplit(scoped), [scoped]);
  const violations = useMemo(() => ruleViolations(scoped), [scoped]);
  const assets = useMemo(() => assetBehavior(scoped), [scoped]);
  const insights = useMemo(() => generateInsights(scoped), [scoped]);

  return (
    <div className="relative min-h-[100svh] w-full bg-[#0B0B0D]">
      <div className="relative z-10 mx-auto w-full max-w-[760px] px-5 pt-8 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/hub/journal/history"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9A9A9A] hover:text-[#EDEDED]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> History
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9A9A9A]/80">
            Behavior Breakdown
          </span>
        </header>

        <div className="mt-6 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-serif text-[26px] tracking-tight text-[#EDEDED]">
              Behavior breakdown
            </h1>
            <p className="mt-1 text-[12.5px] text-[#9A9A9A]">
              {loading ? "Loading…" : `${scoped.length} trades · ${range}`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#18181A] p-1 ring-1 ring-white/5">
            {RANGE_TABS.map((r) => {
              const active = range === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
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

        {loading && (
          <div className="mt-12 flex items-center justify-center text-[#9A9A9A]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing…
          </div>
        )}

        {!loading && scoped.length === 0 && (
          <div className="mt-12 rounded-2xl bg-[#18181A] ring-1 ring-white/5 p-8 text-center">
            <p className="text-[14px] text-[#EDEDED]">Not enough data yet.</p>
            <p className="mt-1 text-[12px] text-[#9A9A9A]">
              Log a few trades to see your behavior patterns surface.
            </p>
          </div>
        )}

        {!loading && scoped.length > 0 && (
          <>
            {/* Score header */}
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
              className="mt-6 rounded-2xl bg-[#18181A] ring-1 ring-white/5 p-5"
            >
              <div className="grid grid-cols-3 gap-4">
                <Stat
                  label="Behavior score"
                  value={`${score.score}`}
                  suffix="/100"
                  glow
                  tone={
                    score.label === "controlled"
                      ? "gold"
                      : score.label === "inconsistent"
                        ? "loss"
                        : "warn"
                  }
                />
                <Stat
                  label="Rule adherence"
                  value={`${Math.round(adherence.pct * 100)}`}
                  suffix="%"
                  tone="muted"
                  sub={`${adherence.cleanTrades}/${adherence.totalTrades} clean`}
                />
                <Stat
                  label="Execution"
                  value={`${Math.round(split.controlledPct * 100)}`}
                  suffix="%"
                  tone="muted"
                  sub="controlled"
                />
              </div>
              <p className="mt-4 text-[12.5px] text-[#9A9A9A]">{score.description}</p>
            </motion.section>

            {/* Insights */}
            {insights.length > 0 && (
              <section className="mt-6">
                <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A] mb-2">
                  Insights
                </h2>
                <div className="space-y-2">
                  {insights.map((i, idx) => (
                    <motion.div
                      key={i.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease, delay: Math.min(idx, 5) * 0.04 }}
                      className={`rounded-xl ring-1 px-4 py-3 text-[12.5px] ${SEVERITY_TONE[i.severity]}`}
                    >
                      {i.message}
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Asset Behavior */}
            {assets.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A]">
                    Asset behavior
                  </h2>
                  <span className="text-[10.5px] text-[#9A9A9A]/70">
                    where emotion lives
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assets.map((a, i) => (
                    <AssetCard key={a.asset} asset={a} delay={i * 0.04} />
                  ))}
                </div>
              </section>
            )}

            {/* Rule Violations */}
            <section className="mt-8">
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A]">
                  Rule violations
                </h2>
                <span className="text-[10.5px] text-[#9A9A9A]/70">
                  ranked by impact
                </span>
              </div>
              {violations.length === 0 ? (
                <div className="rounded-xl bg-[#18181A] ring-1 ring-emerald-500/15 p-5 text-center">
                  <p className="text-[13px] text-emerald-300">
                    No rule breaks logged in this window.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-[#18181A] ring-1 ring-white/5 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.14em] text-[#9A9A9A]/70 border-b border-white/5">
                        <th className="px-4 py-2.5 font-semibold">Rule</th>
                        <th className="px-3 py-2.5 font-semibold text-right tabular-nums">
                          Times
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-right tabular-nums">
                          Impact
                        </th>
                        <th className="px-4 py-2.5 font-semibold text-right">Last</th>
                      </tr>
                    </thead>
                    <tbody>
                      {violations.map((v) => (
                        <ViolationRow
                          key={v.rule}
                          v={v}
                          onOpen={() => setOpenViolation(v)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <ViolationDetailModal
        violation={openViolation}
        open={openViolation !== null}
        onClose={() => setOpenViolation(null)}
      />
    </div>
  );
}

// ───────── Stat ─────────

function Stat({
  label,
  value,
  suffix,
  sub,
  tone = "muted",
  glow,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  tone?: "gold" | "loss" | "warn" | "muted";
  glow?: boolean;
}) {
  const toneClass =
    tone === "gold"
      ? "text-[#E7C98A]"
      : tone === "loss"
        ? "text-rose-300"
        : tone === "warn"
          ? "text-amber-300"
          : "text-[#EDEDED]";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]/80">
        {label}
      </p>
      <p
        className={`mt-1 font-serif text-[28px] leading-none tabular-nums ${toneClass} ${
          glow ? "drop-shadow-[0_0_18px_rgba(198,161,91,0.35)]" : ""
        }`}
      >
        {value}
        {suffix && <span className="text-[14px] text-[#9A9A9A]/70">{suffix}</span>}
      </p>
      {sub && <p className="mt-1 text-[10.5px] text-[#9A9A9A]/70">{sub}</p>}
    </div>
  );
}

// ───────── Asset card ─────────

function AssetCard({ asset, delay }: { asset: AssetBehavior; delay: number }) {
  const Icon =
    asset.label === "disciplined"
      ? Activity
      : asset.label === "emotional"
        ? AlertTriangle
        : Target;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease, delay }}
      className="rounded-xl bg-[#18181A] ring-1 ring-white/5 p-3.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-[#EDEDED]">
          {asset.asset}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${ASSET_LABEL_TONE[asset.label]}`}
        >
          <Icon className="h-3 w-3" />
          {asset.label}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
        <div>
          <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
            Trades
          </p>
          <p className="text-[#EDEDED]">{asset.trades}</p>
        </div>
        <div>
          <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
            Win rate
          </p>
          <p className="text-[#EDEDED]">{Math.round(asset.winRate * 100)}%</p>
        </div>
        <div>
          <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
            Total
          </p>
          <p
            className={
              asset.totalR > 0
                ? "text-[#E7C98A]"
                : asset.totalR < 0
                  ? "text-rose-400"
                  : "text-[#EDEDED]"
            }
          >
            {fmtR(asset.totalR)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ───────── Violation row ─────────

function ViolationRow({ v }: { v: RuleViolationRow }) {
  const [expanded, setExpanded] = useState(false);
  const negative = v.totalImpactR < 0;
  return (
    <>
      <tr
        onClick={() => setExpanded((x) => !x)}
        className="cursor-pointer border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
      >
        <td className="px-4 py-3 text-[12.5px] text-[#EDEDED]">{v.rule}</td>
        <td className="px-3 py-3 text-[12.5px] text-[#EDEDED] text-right tabular-nums">
          {v.timesBroken}
        </td>
        <td
          className={`px-3 py-3 text-[12.5px] text-right tabular-nums ${
            negative ? "text-rose-400" : "text-[#9A9A9A]"
          }`}
        >
          {fmtR(v.totalImpactR)}
        </td>
        <td className="px-4 py-3 text-[11px] text-right text-[#9A9A9A]">
          {fmtRelative(v.lastBrokenAt)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[#0B0B0D]/40">
          <td colSpan={4} className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#9A9A9A]/70 mb-2">
              Trades affected ({v.trades.length})
            </p>
            <div className="space-y-1.5">
              {v.trades.slice(0, 6).map((t) => {
                const Icon = t.direction === "buy" ? TrendingUp : TrendingDown;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-[11.5px]"
                  >
                    <span className="flex items-center gap-2 text-[#EDEDED]/80">
                      <Icon className="h-3 w-3 text-[#9A9A9A]" />
                      {t.asset}
                      <span className="text-[#9A9A9A]/70">
                        · {fmtRelative(t.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`tabular-nums ${
                        (t.resultR ?? 0) > 0
                          ? "text-[#E7C98A]"
                          : (t.resultR ?? 0) < 0
                            ? "text-rose-400"
                            : "text-[#9A9A9A]"
                      }`}
                    >
                      {t.resultR != null ? fmtR(t.resultR) : "—"}
                    </span>
                  </div>
                );
              })}
              {v.trades.length > 6 && (
                <p className="text-[10.5px] text-[#9A9A9A]/70 pt-1">
                  + {v.trades.length - 6} more
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
