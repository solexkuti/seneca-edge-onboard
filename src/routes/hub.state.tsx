import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Shield, AlertTriangle, ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import FeatureShell from "@/components/feature/FeatureShell";
import { useDbJournal } from "@/hooks/useDbJournal";
import { detectBehaviorPattern } from "@/lib/behaviorPattern";

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
  component: ControlStatePage,
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
