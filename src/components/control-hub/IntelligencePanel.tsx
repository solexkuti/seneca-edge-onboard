// Dashboard intelligence panel — surfaces the behavior correction signals
// (most common mistake, recent patterns, current streak, undisciplined warning).

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Flame, ShieldCheck, Activity } from "lucide-react";
import { useDbJournal } from "@/hooks/useDbJournal";
import { computeIntelligence } from "@/lib/intelligence";
import {
  fetchRecentPatterns,
  PATTERN_LABEL,
  type DbBehaviorPattern,
} from "@/lib/dbBehaviorPatterns";

const ease = [0.22, 1, 0.36, 1] as const;

export default function IntelligencePanel() {
  const { rows, loading } = useDbJournal();
  const intel = useMemo(() => computeIntelligence(rows), [rows]);
  const [patterns, setPatterns] = useState<DbBehaviorPattern[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchRecentPatterns(3).then((p) => {
      if (!cancelled) setPatterns(p);
    });
    return () => {
      cancelled = true;
    };
  }, [rows.length]);

  if (loading || rows.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {intel.twoUndisciplinedInARow ? <WarningBanner /> : null}

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Discipline streak"
          value={`${intel.disciplineStreak}`}
          suffix={intel.disciplineStreak === 1 ? "trade" : "trades"}
          icon={
            intel.disciplineStreak > 0 ? (
              <Flame className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.4} />
            ) : (
              <Activity className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2.4} />
            )
          }
        />
        <StatCard
          label="Discipline (last 20)"
          value={`${intel.disciplineScore ?? 0}%`}
          suffix={`of ${intel.windowSize}`}
          icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2.4} />}
        />
      </div>

      {intel.mostCommonMistake ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
            Most common mistake
          </p>
          <p className="mt-1 text-[14px] font-semibold leading-snug text-text-primary">
            {intel.mostCommonMistake.label}
          </p>
          <p className="mt-1 text-[11.5px] text-text-secondary">
            Broken in {intel.mostCommonMistake.count} of your last {intel.windowSize} trade{intel.windowSize === 1 ? "" : "s"}.
          </p>
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease, delay: 0.05 }}
        className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          Last 3 behavior patterns
        </p>
        {patterns.length === 0 ? (
          <p className="mt-1.5 text-[12.5px] leading-snug text-text-secondary">
            No patterns detected yet. Keep logging — the system learns as you trade.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {patterns.map((p) => (
              <li key={p.id} className="rounded-xl bg-text-primary/[0.03] px-3 py-2 ring-1 ring-border/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    {PATTERN_LABEL[p.kind]}
                  </span>
                  <span className="text-[10px] text-text-secondary/80">
                    {timeAgo(p.detected_at)}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-text-primary">
                  {p.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1.5 text-[22px] font-bold leading-none text-text-primary tabular-nums">
        {icon}
        {value}
        {suffix && <span className="text-[10.5px] font-medium text-text-secondary">{suffix}</span>}
      </p>
    </div>
  );
}

function WarningBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className="flex items-start gap-3 rounded-2xl bg-rose-500/[0.08] px-4 py-3 ring-1 ring-rose-500/25"
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-700">
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold leading-snug text-rose-800">
          Two undisciplined trades in a row.
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-rose-900/80">
          Step away. Talk it through with Seneca before the next entry.
        </p>
      </div>
    </motion.div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
