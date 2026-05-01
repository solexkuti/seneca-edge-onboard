// /hub/insights — Insights Engine surface.
//
// Dedicated home for generateInsights() output, plus the supporting
// performance / behavior numbers from the unified Trade pipeline.
// Pure intelligence: never blocks, never lectures.

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Loader2, RefreshCw, Sparkles, TrendingUp, Zap } from "lucide-react";
import { HubPageContainer } from "@/components/layout/HubLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  tradeFromRow,
  generateInsights,
  generateRecommendations,
  behaviorScore,
  ruleAdherence,
  executionSplit,
  summarize,
  sessionPerformance,
  type Trade,
  type TradeRow,
  type Insight,
} from "@/lib/trade";
import { JOURNAL_EVENT } from "@/lib/tradingJournal";
import { Recommendations } from "@/components/feature/Recommendations";

export const Route = createFileRoute("/hub/insights")({
  head: () => ({
    meta: [
      { title: "Insights — SenecaEdge" },
      {
        name: "description",
        content:
          "The patterns shaping your edge — surfaced from your trades, not theory.",
      },
    ],
  }),
  component: InsightsPage,
});

const ease = [0.22, 1, 0.36, 1] as const;

const SEVERITY_TONE: Record<Insight["severity"], string> = {
  positive: "border-emerald-500/25 bg-emerald-500/5 text-emerald-200",
  neutral: "border-white/[0.08] bg-[#18181A] text-[#EDEDED]",
  warning: "border-amber-500/25 bg-amber-500/5 text-amber-200",
  critical: "border-rose-500/30 bg-rose-500/5 text-rose-200",
};

const SEVERITY_LABEL: Record<Insight["severity"], string> = {
  positive: "Strength",
  neutral: "Note",
  warning: "Watch",
  critical: "Critical",
};

function fmtR(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}R`;
}

function InsightsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [newTradeBanner, setNewTradeBanner] = useState<{ count: number; key: number } | null>(null);
  const isInitialLoad = useRef(true);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let userIdCache: string | null = null;

    async function load(opts: { silent?: boolean; addedCount?: number } = {}) {
      if (opts.silent) setRefreshing(true);
      else setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      userIdCache = userId ?? null;
      if (!userId) {
        if (!cancelled) {
          setTrades([]);
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .order("executed_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        setTrades(((data as unknown as TradeRow[]) ?? []).map(tradeFromRow));
        setLoading(false);
        setRefreshing(false);
        if (!isInitialLoad.current) {
          setPulseKey((k) => k + 1);
          if (opts.addedCount && opts.addedCount > 0) {
            setNewTradeBanner({ count: opts.addedCount, key: Date.now() });
            if (bannerTimer.current) clearTimeout(bannerTimer.current);
            bannerTimer.current = setTimeout(() => setNewTradeBanner(null), 4000);
          }
        }
        isInitialLoad.current = false;
      }
    }

    load();
    const onUpdate = () => load({ silent: true, addedCount: 1 });
    window.addEventListener(JOURNAL_EVENT, onUpdate);

    // Realtime: listen for INSERT/UPDATE on trades for this user
    const channel = supabase
      .channel("insights-trades-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trades" },
        (payload) => {
          const row = payload.new as { user_id?: string } | null;
          if (!userIdCache || !row || row.user_id !== userIdCache) return;
          load({ silent: true, addedCount: 1 });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trades" },
        (payload) => {
          const row = payload.new as { user_id?: string } | null;
          if (!userIdCache || !row || row.user_id !== userIdCache) return;
          load({ silent: true });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener(JOURNAL_EVENT, onUpdate);
      supabase.removeChannel(channel);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  const insights = useMemo(() => generateInsights(trades), [trades]);
  const recommendations = useMemo(
    () => generateRecommendations(trades),
    [trades],
  );
  const score = useMemo(() => behaviorScore(trades), [trades]);
  const adherence = useMemo(() => ruleAdherence(trades), [trades]);
  const split = useMemo(() => executionSplit(trades), [trades]);
  const summary = useMemo(() => summarize(trades), [trades]);
  const sessions = useMemo(() => sessionPerformance(trades), [trades]);

  return (
    <HubPageContainer
      eyebrow="Intelligence"
      title="Insights"
      subtitle="The patterns shaping your edge — surfaced from your trades, not theory."
      wide
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#9A9A9A]">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Reading your trades…
        </div>
      ) : trades.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#18181A] p-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-[#C6A15B]" />
          <p className="mt-3 text-[14px] text-[#EDEDED]">No trades yet.</p>
          <p className="mt-1 text-[12.5px] text-[#9A9A9A]">
            Log a few trades and your behavior patterns surface here automatically.
          </p>
          <Link
            to="/hub/journal"
            className="mt-5 inline-block rounded-lg bg-[#C6A15B] px-5 py-2.5 text-[13px] font-medium text-[#0B0B0D] hover:bg-[#E7C98A] transition-colors"
          >
            Log a trade
          </Link>
        </div>
      ) : (
        <div className="space-y-8 relative">
          {/* Live status row: pulsing dot + refreshing hint */}
          <div className="flex items-center justify-between px-1 -mt-2">
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-[#9A9A9A]/80">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C6A15B] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C6A15B]" />
              </span>
              Live
            </div>
            <AnimatePresence>
              {refreshing && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-[10.5px] text-[#C6A15B]"
                >
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Syncing new trades…
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* New trade arrival banner */}
          <AnimatePresence>
            {newTradeBanner && (
              <motion.div
                key={newTradeBanner.key}
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.35, ease }}
                className="rounded-xl border border-[#C6A15B]/40 bg-[#C6A15B]/[0.07] px-4 py-3 flex items-center gap-2.5 shadow-[0_0_25px_rgba(198,161,91,0.15)]"
              >
                <Zap className="h-4 w-4 text-[#E7C98A]" />
                <p className="text-[12.5px] text-[#EDEDED]">
                  New trade synced — your insights just refreshed.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Headline numbers */}
          <motion.div
            key={`stats-${pulseKey}`}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <Stat
              label="Behavior"
              value={`${score.score}`}
              suffix="/100"
              tone="gold"
              glow
              flashKey={pulseKey}
            />
            <Stat
              label="Adherence"
              value={`${Math.round(adherence.pct * 100)}`}
              suffix="%"
              flashKey={pulseKey}
            />
            <Stat
              label="Controlled"
              value={`${Math.round(split.controlledPct * 100)}`}
              suffix="%"
              flashKey={pulseKey}
            />
            <Stat
              label="Total R"
              value={fmtR(summary.totalR)}
              tone={summary.totalR > 0 ? "gold" : summary.totalR < 0 ? "loss" : "muted"}
              flashKey={pulseKey}
            />
          </motion.div>

          {/* Insight cards */}
          <section>
            <div className="flex items-center justify-between px-1 mb-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A]">
                What your trades are telling you
              </h2>
              <span className="text-[10.5px] text-[#9A9A9A]/70">
                {insights.length} observations
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map((i, idx) => (
                <InsightCard
                  key={`${i.id}-${pulseKey}`}
                  insight={i}
                  delay={idx * 0.04}
                />
              ))}
            </div>
          </section>

          {/* Recommendations — actionable next moves from top violations */}
          <Recommendations recommendations={recommendations} />

          {/* Session performance */}
          <section>
            <h2 className="px-1 mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A]">
              Session performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sessions.map((s) => (
                <div
                  key={s.session}
                  className="rounded-xl border border-white/[0.06] bg-[#18181A] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#EDEDED]">
                      {s.session}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider ${
                        s.behaviorLabel === "Controlled"
                          ? "text-emerald-300"
                          : s.behaviorLabel === "Overtrading"
                            ? "text-rose-300"
                            : "text-[#9A9A9A]"
                      }`}
                    >
                      {s.behaviorLabel}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                    <div>
                      <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
                        Trades
                      </p>
                      <p className="text-[#EDEDED]">{s.trades}</p>
                    </div>
                    <div>
                      <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
                        Win rate
                      </p>
                      <p className="text-[#EDEDED]">
                        {s.trades ? `${Math.round(s.winRate * 100)}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
                        Total
                      </p>
                      <p
                        className={
                          s.totalR > 0
                            ? "text-[#E7C98A]"
                            : s.totalR < 0
                              ? "text-rose-400"
                              : "text-[#9A9A9A]"
                        }
                      >
                        {fmtR(s.totalR)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="flex flex-wrap gap-2">
            <Link
              to="/hub/journal/breakdown"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#18181A] px-4 py-2 text-[12.5px] text-[#EDEDED] hover:border-[#C6A15B]/40 transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Behavior breakdown
            </Link>
            <Link
              to="/hub/journal/history"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#18181A] px-4 py-2 text-[12.5px] text-[#EDEDED] hover:border-[#C6A15B]/40 transition-colors"
            >
              <Brain className="h-3.5 w-3.5" /> Trade history
            </Link>
          </div>
        </div>
      )}
    </HubPageContainer>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone = "muted",
  glow,
  flashKey,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "gold" | "loss" | "muted";
  glow?: boolean;
  flashKey?: number;
}) {
  const toneClass =
    tone === "gold"
      ? "text-[#E7C98A]"
      : tone === "loss"
        ? "text-rose-300"
        : "text-[#EDEDED]";
  const prevValue = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (flashKey === undefined) return;
    if (prevValue.current !== value) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
  }, [flashKey, value]);
  return (
    <motion.div
      animate={
        flash
          ? {
              borderColor: ["rgba(255,255,255,0.06)", "rgba(198,161,91,0.55)", "rgba(255,255,255,0.06)"],
              boxShadow: [
                "0 0 0 rgba(198,161,91,0)",
                "0 0 28px rgba(198,161,91,0.35)",
                "0 0 0 rgba(198,161,91,0)",
              ],
            }
          : undefined
      }
      transition={{ duration: 0.9, ease }}
      className="rounded-xl border border-white/[0.06] bg-[#18181A] p-4"
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]/80">
        {label}
      </p>
      <motion.p
        key={`${label}-${value}`}
        initial={{ opacity: 0.4, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease }}
        className={`mt-1 font-serif text-[26px] leading-none tabular-nums ${toneClass} ${
          glow ? "drop-shadow-[0_0_18px_rgba(198,161,91,0.35)]" : ""
        }`}
      >
        {value}
        {suffix && (
          <span className="text-[13px] text-[#9A9A9A]/70">{suffix}</span>
        )}
      </motion.p>
    </motion.div>
  );
}

function InsightCard({ insight, delay }: { insight: Insight; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay }}
      className={`rounded-2xl border p-4 ${SEVERITY_TONE[insight.severity]}`}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">
        {SEVERITY_LABEL[insight.severity]}
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed">{insight.message}</p>
    </motion.div>
  );
}
