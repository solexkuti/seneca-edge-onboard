// Dashboard intelligence panel — surfaces the behavior correction signals
// (most common mistake, recent patterns, current streak, undisciplined warning).

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Flame, ShieldCheck, Activity, Gauge } from "lucide-react";
import { useDbJournal } from "@/hooks/useDbJournal";
import {
  computeIntelligence,
  DISCIPLINE_CLASS_LABEL,
  type DisciplineClass,
} from "@/lib/intelligence";
import { metricColorStyle, metricTone } from "@/lib/metricColor";
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

      {intel.disciplineClass ? <ClassificationCard cls={intel.disciplineClass} score={intel.disciplineScore ?? 0} /> : null}

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Discipline streak"
          value={`${intel.disciplineStreak}`}
          suffix={intel.disciplineStreak === 1 ? "trade" : "trades"}
          glow={intel.disciplineStreak > 0 ? "amber" : "none"}
          delay={0.05}
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
          valueColor={metricColorStyle(intel.disciplineScore ?? null).color}
          suffix={`of ${intel.windowSize}`}
          glow={
            metricTone(intel.disciplineScore ?? null) === "good"
              ? "emerald"
              : metricTone(intel.disciplineScore ?? null) === "warn"
                ? "amber"
                : metricTone(intel.disciplineScore ?? null) === "bad"
                  ? "rose"
                  : "none"
          }
          delay={0.1}
          icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.4} />}
        />
      </div>

      {intel.mostCommonMistake || intel.mostCommonMistakeTag ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft"
        >
          {intel.mostCommonMistake ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
                Most common rule break
              </p>
              <p className="mt-1 text-[14px] font-semibold leading-snug text-text-primary">
                {intel.mostCommonMistake.label}
              </p>
              <p className="mt-1 text-[11.5px] text-text-secondary">
                Broken in {intel.mostCommonMistake.count} of your last {intel.windowSize} trade{intel.windowSize === 1 ? "" : "s"}.
              </p>
            </div>
          ) : null}
          {intel.mostCommonMistakeTag ? (
            <div className={intel.mostCommonMistake ? "border-t border-border/60 pt-3" : ""}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
                Most common behavioral mistake
              </p>
              <p className="mt-1 text-[14px] font-semibold leading-snug text-text-primary">
                {intel.mostCommonMistakeTag.label}
              </p>
              <p className="mt-1 text-[11.5px] text-text-secondary">
                Tagged on {intel.mostCommonMistakeTag.count} of your last {intel.windowSize} trade{intel.windowSize === 1 ? "" : "s"}.
              </p>
            </div>
          ) : null}
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

type GlowTone = "none" | "emerald" | "amber" | "rose";

const GLOW_STYLES: Record<GlowTone, string> = {
  none: "",
  emerald:
    "shadow-[0_10px_28px_-18px_color-mix(in_oklab,oklch(0.72_0.13_160)_55%,transparent)]",
  amber:
    "shadow-[0_10px_28px_-18px_color-mix(in_oklab,oklch(0.78_0.12_75)_55%,transparent)]",
  rose:
    "shadow-[0_10px_28px_-18px_color-mix(in_oklab,oklch(0.70_0.14_20)_55%,transparent)]",
};

function StatCard({
  label,
  value,
  valueColor,
  suffix,
  icon,
  glow = "none",
  delay = 0,
}: {
  label: string;
  value: string;
  valueColor?: string;
  suffix?: string;
  icon?: React.ReactNode;
  glow?: GlowTone;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease, delay }}
      whileHover={{ y: -2 }}
      className={`rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft transition-shadow duration-500 hover:ring-border/80 ${GLOW_STYLES[glow]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
        {label}
      </p>
      <p
        className="mt-1 flex items-baseline gap-1.5 text-[22px] font-bold leading-none tabular-nums"
        style={{ color: valueColor ?? "var(--text-primary)" }}
      >
        {icon}
        {value}
        {suffix && <span className="text-[10.5px] font-medium text-text-secondary">{suffix}</span>}
      </p>
    </motion.div>
  );
}

function WarningBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: [
          "0 0 0 0 color-mix(in oklab, oklch(0.70 0.14 20) 0%, transparent)",
          "0 0 0 8px color-mix(in oklab, oklch(0.70 0.14 20) 12%, transparent)",
          "0 0 0 0 color-mix(in oklab, oklch(0.70 0.14 20) 0%, transparent)",
        ],
      }}
      transition={{
        opacity: { duration: 0.35, ease },
        y: { duration: 0.35, ease },
        boxShadow: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
      }}
      className="relative flex items-start gap-3 overflow-hidden rounded-2xl bg-rose-500/[0.08] px-4 py-3 ring-1 ring-rose-500/25"
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 50%, color-mix(in oklab, oklch(0.70 0.14 20) 14%, transparent), transparent 60%)",
        }}
        animate={{ opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-700"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
      </motion.span>
      <div className="relative min-w-0">
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

const CLASS_STYLES: Record<DisciplineClass, { ring: string; bg: string; dot: string; text: string; glow: string }> = {
  in_control: {
    ring: "ring-emerald-500/25",
    bg: "bg-emerald-500/[0.06]",
    dot: "bg-emerald-500",
    text: "text-emerald-800",
    glow: "shadow-[0_14px_36px_-22px_color-mix(in_oklab,oklch(0.72_0.13_160)_55%,transparent)]",
  },
  unstable: {
    ring: "ring-amber-500/25",
    bg: "bg-amber-500/[0.07]",
    dot: "bg-amber-500",
    text: "text-amber-800",
    glow: "shadow-[0_14px_36px_-22px_color-mix(in_oklab,oklch(0.78_0.12_75)_55%,transparent)]",
  },
  out_of_control: {
    ring: "ring-rose-500/25",
    bg: "bg-rose-500/[0.07]",
    dot: "bg-rose-500",
    text: "text-rose-800",
    glow: "shadow-[0_14px_36px_-22px_color-mix(in_oklab,oklch(0.70_0.14_20)_55%,transparent)]",
  },
};

function ClassificationCard({ cls, score }: { cls: DisciplineClass; score: number }) {
  const s = CLASS_STYLES[cls];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
      whileHover={{ y: -1 }}
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 transition-shadow duration-500 ${s.bg} ${s.ring} ${s.glow}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
          <motion.span
            aria-hidden
            className={`absolute inset-0 rounded-full ${s.dot} opacity-50`}
            animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className={`relative h-2 w-2 rounded-full ${s.dot}`} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
            Discipline state
          </p>
          <p className={`mt-0.5 text-[14px] font-semibold leading-snug ${s.text}`}>
            {DISCIPLINE_CLASS_LABEL[cls]}
          </p>
        </div>
      </div>
      <div className="flex items-baseline gap-1 text-text-primary">
        <Gauge className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2.4} />
        <span
          className="text-[18px] font-bold tabular-nums"
          style={metricColorStyle(score)}
        >
          {score}%
        </span>
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
