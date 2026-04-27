// Discipline streak & trend widget — visualizes how a trader's discipline
// score evolves over their last logged trades, plus the current "in control"
// streak. Pure presentation: receives DB rows from the journal hook.

import { motion } from "framer-motion";
import { useMemo } from "react";
import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DbJournalRow } from "@/lib/dbJournal";

const ease = [0.22, 1, 0.36, 1] as const;
const STREAK_THRESHOLD = 75; // score considered "in control"
const TREND_WINDOW = 10;     // last N trades shown on the sparkline

type Trend = "up" | "down" | "flat";

type Stats = {
  current: number;
  streak: number;
  longestStreak: number;
  recent: DbJournalRow[];      // chronological (oldest → newest)
  trend: Trend;
  delta: number;               // recent half avg − earlier half avg
};

function computeStats(rows: DbJournalRow[]): Stats | null {
  if (rows.length === 0) return null;

  // rows arrive newest-first from the hook; build chronological list.
  const chronological = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  const recent = chronological.slice(-TREND_WINDOW);

  // Current discipline score = most recent trade's score
  const current = chronological[chronological.length - 1].discipline_score;

  // Current streak: count back from newest while score >= threshold
  let streak = 0;
  for (let i = chronological.length - 1; i >= 0; i--) {
    if (chronological[i].discipline_score >= STREAK_THRESHOLD) streak++;
    else break;
  }

  // Longest historical streak
  let longestStreak = 0;
  let run = 0;
  for (const r of chronological) {
    if (r.discipline_score >= STREAK_THRESHOLD) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  // Trend: compare avg of newer half vs older half within the window
  let trend: Trend = "flat";
  let delta = 0;
  if (recent.length >= 2) {
    const mid = Math.floor(recent.length / 2);
    const earlier = recent.slice(0, mid);
    const newer = recent.slice(mid);
    const avg = (xs: DbJournalRow[]) =>
      xs.reduce((a, x) => a + x.discipline_score, 0) / xs.length;
    delta = Math.round(avg(newer) - avg(earlier));
    if (delta >= 5) trend = "up";
    else if (delta <= -5) trend = "down";
    else trend = "flat";
  }

  return { current, streak, longestStreak, recent, trend, delta };
}

function buildSparkPath(values: number[], w: number, h: number, pad = 4) {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = h / 2;
    return `M ${pad} ${y} L ${w - pad} ${y}`;
  }
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const stepX = innerW / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
    return [x, y] as const;
  });
  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

export default function DisciplineStreakWidget({
  rows,
}: {
  rows: DbJournalRow[];
}) {
  const stats = useMemo(() => computeStats(rows), [rows]);

  if (!stats) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          Streak & trend
        </p>
        <p className="mt-2 text-[13px] leading-snug text-text-secondary">
          Log a trade to start tracking your discipline streak and trend.
        </p>
      </div>
    );
  }

  const { current, streak, longestStreak, recent, trend, delta } = stats;
  const values = recent.map((r) => r.discipline_score);
  const sparkW = 240;
  const sparkH = 56;
  const path = buildSparkPath(values, sparkW, sparkH);
  const lastPoint = (() => {
    if (values.length === 0) return null;
    const innerW = sparkW - 8;
    const innerH = sparkH - 8;
    const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
    const x = 4 + (values.length - 1) * stepX;
    const y =
      4 + innerH - (Math.max(0, Math.min(100, values[values.length - 1])) / 100) * innerH;
    return { x, y };
  })();

  const trendMeta = {
    up:   { label: "Improving", icon: TrendingUp,  tone: "text-emerald-700 bg-emerald-500/10" },
    down: { label: "Slipping",  icon: TrendingDown, tone: "text-rose-700 bg-rose-500/10" },
    flat: { label: "Steady",    icon: Minus,        tone: "text-text-secondary bg-text-primary/[0.06]" },
  }[trend];
  const TrendIcon = trendMeta.icon;
  const deltaLabel = delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${delta}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          Streak & trend
        </p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${trendMeta.tone}`}
        >
          <TrendIcon className="h-3 w-3" strokeWidth={2.4} />
          {trendMeta.label} {deltaLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Current" value={`${current}`} suffix="/100" />
        <Stat
          label="Streak"
          value={`${streak}`}
          icon={streak > 0 ? <Flame className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.4} /> : null}
        />
        <Stat label="Best" value={`${longestStreak}`} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[10.5px] text-text-secondary">
          <span>Last {recent.length} trade{recent.length === 1 ? "" : "s"}</span>
          <span>0–100</span>
        </div>
        <div className="mt-1.5 rounded-xl bg-text-primary/[0.03] p-2">
          <svg
            viewBox={`0 0 ${sparkW} ${sparkH}`}
            width="100%"
            height={sparkH}
            preserveAspectRatio="none"
            aria-hidden
          >
            {/* Threshold line */}
            <line
              x1={4}
              x2={sparkW - 4}
              y1={4 + (sparkH - 8) * (1 - STREAK_THRESHOLD / 100)}
              y2={4 + (sparkH - 8) * (1 - STREAK_THRESHOLD / 100)}
              stroke="currentColor"
              className="text-text-primary/15"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <motion.path
              d={path}
              fill="none"
              stroke="currentColor"
              className="text-primary"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease }}
            />
            {lastPoint && (
              <motion.circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={3}
                className="fill-primary"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6, ease }}
              />
            )}
          </svg>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-text-secondary">
          {streak >= 3
            ? `On a ${streak}-trade in-control streak. Keep the structure tight.`
            : trend === "up"
              ? "Discipline is trending up — your last trades held the rules better."
              : trend === "down"
                ? "Discipline has slipped recently. Slow the next entry."
                : "Discipline is holding steady. One clean trade extends the trend."}
        </p>
      </div>
    </motion.div>
  );
}

function Stat({
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
    <div className="rounded-xl bg-text-primary/[0.03] px-3 py-2.5 ring-1 ring-border/60">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1 text-[18px] font-bold leading-none text-text-primary tabular-nums">
        {icon}
        {value}
        {suffix && <span className="text-[10px] text-text-secondary">{suffix}</span>}
      </p>
    </div>
  );
}
