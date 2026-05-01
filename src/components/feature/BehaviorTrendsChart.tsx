// BehaviorTrendsChart — interactive trend chart for behavior breakdown.
//
// Three series the user can toggle between:
//   • Score      — rolling 7-day behavior score (0–100)
//   • Adherence  — daily clean-trade %
//   • Controlled — daily controlled-execution %
//
// Tap any point to drill into that day: shows trades, violations, and R for
// the selected bucket beneath the chart. Pure presentation — consumes the
// `behaviorTrend()` series from `@/lib/trade`.

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { BehaviorTrendPoint } from "@/lib/trade";

const ease = [0.22, 1, 0.36, 1] as const;

type Metric = "score" | "adherence" | "controlled";

const METRICS: {
  id: Metric;
  label: string;
  format: (v: number | null) => string;
  domain: [number, number];
}[] = [
  {
    id: "score",
    label: "Score",
    format: (v) => (v == null ? "—" : `${Math.round(v)}`),
    domain: [0, 100],
  },
  {
    id: "adherence",
    label: "Adherence",
    format: (v) => (v == null ? "—" : `${Math.round(v * 100)}%`),
    domain: [0, 1],
  },
  {
    id: "controlled",
    label: "Controlled",
    format: (v) => (v == null ? "—" : `${Math.round(v * 100)}%`),
    domain: [0, 1],
  },
];

interface Props {
  data: BehaviorTrendPoint[];
}

export function BehaviorTrendsChart({ data }: Props) {
  const [metric, setMetric] = useState<Metric>("score");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const cfg = METRICS.find((m) => m.id === metric)!;

  const series = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        idx: i,
        value: d[metric],
      })),
    [data, metric],
  );

  const stats = useMemo(() => {
    const valid = series
      .map((d) => d.value)
      .filter((v): v is number => v != null);
    if (!valid.length) return null;
    const first = valid[0];
    const last = valid[valid.length - 1];
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    const max = Math.max(...valid);
    const min = Math.min(...valid);
    return {
      first,
      last,
      avg,
      max,
      min,
      delta: last - first,
    };
  }, [series]);

  const active =
    activeIndex != null && activeIndex >= 0 && activeIndex < series.length
      ? series[activeIndex]
      : null;

  if (!data.length) {
    return (
      <div className="rounded-xl bg-[#18181A] ring-1 ring-white/5 p-6 text-center">
        <p className="text-[12.5px] text-[#9A9A9A]">
          Not enough data to plot a trend.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A]">
          Trends
        </h2>
        <span className="text-[10.5px] text-[#9A9A9A]/70">
          {data.length}d window
        </span>
      </div>

      <div className="rounded-2xl bg-[#18181A] ring-1 ring-white/5 p-4">
        {/* Metric toggle */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#0F0F11] p-1 ring-1 ring-white/5">
            {METRICS.map((m) => {
              const a = metric === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMetric(m.id);
                    setActiveIndex(null);
                  }}
                  className={`px-3 py-1.5 text-[11.5px] font-medium rounded-md transition-colors ${
                    a
                      ? "bg-[#C6A15B]/15 text-[#E7C98A] ring-1 ring-[#C6A15B]/30"
                      : "text-[#9A9A9A] hover:text-[#EDEDED]"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          {stats && (
            <div className="flex items-center gap-3 text-[11px] tabular-nums">
              <Pill label="Now" value={cfg.format(stats.last)} tone="gold" />
              <Pill label="Avg" value={cfg.format(stats.avg)} />
              <Pill
                label="Δ"
                value={
                  metric === "score"
                    ? `${stats.delta > 0 ? "+" : ""}${Math.round(stats.delta)}`
                    : `${stats.delta > 0 ? "+" : ""}${Math.round(stats.delta * 100)}%`
                }
                tone={stats.delta >= 0 ? "up" : "down"}
              />
            </div>
          )}
        </div>

        {/* Chart */}
        <motion.div
          key={metric}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
          className="mt-3 h-[180px] -ml-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              onMouseMove={(s) => {
                if (s && typeof s.activeTooltipIndex === "number") {
                  setActiveIndex(s.activeTooltipIndex);
                }
              }}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(s) => {
                if (s && typeof s.activeTooltipIndex === "number") {
                  setActiveIndex(s.activeTooltipIndex);
                }
              }}
            >
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C6A15B" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#C6A15B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#FFFFFF"
                strokeOpacity={0.04}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="#9A9A9A"
                tick={{ fontSize: 10, fill: "#9A9A9A" }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                stroke="#9A9A9A"
                tick={{ fontSize: 10, fill: "#9A9A9A" }}
                tickLine={false}
                axisLine={false}
                domain={cfg.domain}
                tickFormatter={(v) =>
                  metric === "score" ? `${v}` : `${Math.round(v * 100)}`
                }
                width={28}
              />
              <Tooltip
                cursor={{
                  stroke: "#C6A15B",
                  strokeOpacity: 0.35,
                  strokeWidth: 1,
                }}
                content={({ active: a, payload }) => {
                  if (!a || !payload?.length) return null;
                  const p = payload[0].payload as (typeof series)[number];
                  return (
                    <div className="rounded-lg bg-[#0B0B0D]/95 ring-1 ring-white/10 px-3 py-2 text-[11px] shadow-lg backdrop-blur">
                      <p className="text-[#9A9A9A] uppercase tracking-wider text-[9.5px]">
                        {p.label}
                      </p>
                      <p className="mt-0.5 text-[#E7C98A] font-medium tabular-nums">
                        {cfg.label}: {cfg.format(p.value)}
                      </p>
                      <p className="text-[#9A9A9A] tabular-nums">
                        {p.trades} trade{p.trades === 1 ? "" : "s"}
                        {p.violations > 0
                          ? ` · ${p.violations} viol.`
                          : ""}
                      </p>
                    </div>
                  );
                }}
              />
              {metric === "score" && (
                <ReferenceLine
                  y={80}
                  stroke="#C6A15B"
                  strokeOpacity={0.25}
                  strokeDasharray="3 3"
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#C6A15B"
                strokeWidth={2}
                fill="url(#trendFill)"
                connectNulls
                activeDot={{
                  r: 4,
                  fill: "#E7C98A",
                  stroke: "#0B0B0D",
                  strokeWidth: 2,
                }}
                isAnimationActive
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Drill-down */}
        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key={active.date}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease }}
              className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-[#0F0F11] ring-1 ring-white/5 px-3 py-2.5"
            >
              <DrillCell label="Day" value={active.label} />
              <DrillCell
                label={cfg.label}
                value={cfg.format(active.value)}
                gold
              />
              <DrillCell label="Trades" value={`${active.trades}`} />
              <DrillCell
                label="Result"
                value={
                  active.trades
                    ? `${active.totalR > 0 ? "+" : ""}${active.totalR.toFixed(1)}R`
                    : "—"
                }
                tone={
                  active.trades === 0
                    ? "muted"
                    : active.totalR > 0
                      ? "up"
                      : active.totalR < 0
                        ? "down"
                        : "muted"
                }
              />
            </motion.div>
          ) : (
            <p className="mt-3 text-center text-[10.5px] text-[#9A9A9A]/70">
              Tap a point to drill into that day
            </p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Pill({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "gold" | "up" | "down" | "muted";
}) {
  const toneClass =
    tone === "gold"
      ? "text-[#E7C98A]"
      : tone === "up"
        ? "text-emerald-300"
        : tone === "down"
          ? "text-rose-300"
          : "text-[#EDEDED]";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
        {label}
      </span>
      <span className={`tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function DrillCell({
  label,
  value,
  gold,
  tone = "muted",
}: {
  label: string;
  value: string;
  gold?: boolean;
  tone?: "up" | "down" | "muted";
}) {
  const toneClass = gold
    ? "text-[#E7C98A]"
    : tone === "up"
      ? "text-emerald-300"
      : tone === "down"
        ? "text-rose-300"
        : "text-[#EDEDED]";
  return (
    <div>
      <p className="text-[9.5px] uppercase tracking-wider text-[#9A9A9A]/70">
        {label}
      </p>
      <p className={`mt-0.5 text-[12.5px] tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}
