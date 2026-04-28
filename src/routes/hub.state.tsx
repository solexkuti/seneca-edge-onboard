import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  Shield,
  AlertTriangle,
  ArrowUpRight,
  Check,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useMemo } from "react";
import FeatureShell from "@/components/feature/FeatureShell";
import { useDbJournal } from "@/hooks/useDbJournal";
import { detectBehaviorPattern } from "@/lib/behaviorPattern";
import type { DbJournalRow } from "@/lib/dbJournal";
import DisciplineStreakWidget from "@/components/feature/DisciplineStreakWidget";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/state")({
  head: () => ({
    meta: [
      { title: "Control State — SenecaEdge" },
      {
        name: "description",
        content:
          "Live view of your trading discipline, rule adherence, and behavioral state.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ControlStatePage />
    </RequireAuth>
  ),
});

const ease = [0.22, 1, 0.36, 1] as const;

function ControlStatePage() {
  const { rows, entries, loading } = useDbJournal();

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }
    const recent = rows.slice(0, 10);
    const avgScore =
      recent.reduce((acc, r) => acc + r.discipline_score, 0) / recent.length;

    const totals = recent.reduce(
      (acc, r) => {
        acc.entry += r.followed_entry ? 1 : 0;
        acc.exit += r.followed_exit ? 1 : 0;
        acc.risk += r.followed_risk ? 1 : 0;
        acc.behavior += r.followed_behavior ? 1 : 0;
        return acc;
      },
      { entry: 0, exit: 0, risk: 0, behavior: 0 },
    );

    const pct = (n: number) => Math.round((n / recent.length) * 100);

    return {
      score: Math.round(avgScore),
      inControl: avgScore >= 70,
      windowSize: recent.length,
      rules: [
        { label: "Entry", value: pct(totals.entry) },
        { label: "Exit", value: pct(totals.exit) },
        { label: "Risk", value: pct(totals.risk) },
        { label: "Behavior", value: pct(totals.behavior) },
      ],
    };
  }, [rows]);

  const pattern = useMemo(() => detectBehaviorPattern(entries), [entries]);

  return (
    <FeatureShell
      eyebrow="Control State"
      title="Where you are right now."
      subtitle="Pulled from your last logged trades."
    >
      {loading ? (
        <p className="text-[13px] text-text-secondary">Loading state…</p>
      ) : !stats ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {/* Discipline score */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="relative overflow-hidden rounded-2xl bg-gradient-mix p-5 text-white shadow-glow-primary"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">
                  Discipline score
                </p>
                <p className="mt-1 text-[44px] font-bold leading-none">
                  {stats.score}
                  <span className="ml-1 text-[18px] text-white/75">/100</span>
                </p>
                <p className="mt-2 text-[12.5px] text-white/85">
                  Average across your last {stats.windowSize} trade
                  {stats.windowSize === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                {stats.inControl ? (
                  <Shield className="h-5 w-5 text-white" strokeWidth={2.3} />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-white" strokeWidth={2.3} />
                )}
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ring-1 ring-white/20">
              <Activity className="h-3 w-3" strokeWidth={2.6} />
              {stats.inControl ? "In control" : "Slipping"}
            </div>
          </motion.div>

          {/* Most recent trade — rule-by-rule breakdown */}
          <LastTradeCard row={rows[0]} />

          {/* Discipline streak & trend */}
          <DisciplineStreakWidget rows={rows} />

          {/* Rules followed % */}
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
              Rules followed
            </p>
            <div className="mt-3 space-y-3">
              {stats.rules.map((r) => (
                <RuleBar key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          </div>

          {/* Behavior pattern */}
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
              Current pattern
            </p>
            <p className="mt-2 text-[15px] font-semibold leading-snug text-text-primary">
              {pattern.message}
            </p>
          </div>

          <Link
            to="/hub/journal"
            className="flex items-center justify-between rounded-xl bg-text-primary/[0.04] px-4 py-3.5 ring-1 ring-border transition-all hover:bg-text-primary/[0.07]"
          >
            <span className="text-[13.5px] font-semibold text-text-primary">
              Log another trade
            </span>
            <ArrowUpRight className="h-4 w-4 text-text-secondary" strokeWidth={2.2} />
          </Link>
        </div>
      )}
    </FeatureShell>
  );
}

function RuleBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="font-semibold text-text-secondary">{value}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-text-primary/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease }}
          className="h-full rounded-full bg-gradient-primary"
        />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-card p-6 ring-1 ring-border shadow-soft">
      <p className="text-[14px] font-semibold text-text-primary">
        No data yet.
      </p>
      <p className="mt-1.5 text-[13px] leading-snug text-text-secondary">
        Log your first trade in the Trading Journal. Your Control State will
        appear the moment you save it.
      </p>
      <Link
        to="/hub/journal"
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-glow-primary"
      >
        Open journal
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </Link>
    </div>
  );
}

function LastTradeCard({ row }: { row: DbJournalRow }) {
  const rules: Array<{ key: string; label: string; followed: boolean }> = [
    { key: "entry", label: "Entry rule", followed: row.followed_entry },
    { key: "exit", label: "Exit rule", followed: row.followed_exit },
    { key: "risk", label: "Risk rule", followed: row.followed_risk },
    { key: "behavior", label: "Behavior rule", followed: row.followed_behavior },
  ];
  const followedCount = rules.filter((r) => r.followed).length;
  const allFollowed = followedCount === 4;
  const noneFollowed = followedCount === 0;
  const isLong = row.direction === "long";
  const when = new Date(row.timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.05 }}
      className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
            Most recent trade
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[16px] font-semibold text-text-primary">{row.pair}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                isLong
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-rose-500/10 text-rose-700"
              }`}
            >
              {isLong ? (
                <TrendingUp className="h-3 w-3" strokeWidth={2.4} />
              ) : (
                <TrendingDown className="h-3 w-3" strokeWidth={2.4} />
              )}
              {row.direction}
            </span>
            {row.result && (
              <span className="text-[10px] uppercase tracking-wider text-text-secondary">
                {row.result}
                {row.rr ? ` · ${row.rr}R` : ""}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-text-secondary">{when}</p>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-bold leading-none tabular-nums text-text-primary">
            {followedCount}<span className="text-[12px] text-text-secondary">/4</span>
          </p>
          <p className="text-[9px] uppercase tracking-wider text-text-secondary">followed</p>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {rules.map((r) => (
          <li
            key={r.key}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${
              r.followed
                ? "bg-emerald-500/[0.06] ring-emerald-500/20"
                : "bg-rose-500/[0.06] ring-rose-500/20"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                r.followed ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"
              }`}
            >
              {r.followed ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                <X className="h-3 w-3" strokeWidth={3} />
              )}
            </span>
            <span
              className={`text-[12.5px] font-medium ${
                r.followed ? "text-text-primary" : "text-text-primary"
              }`}
            >
              {r.label}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[12px] leading-snug text-text-secondary">
        {allFollowed
          ? "Clean execution — every rule held."
          : noneFollowed
            ? "All four rules broke. Reset before the next entry."
            : `${4 - followedCount} rule${4 - followedCount === 1 ? "" : "s"} missed. Review before re-entering.`}
      </p>
    </motion.div>
  );
}
