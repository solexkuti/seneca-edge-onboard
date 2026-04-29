// Discipline Trends Panel
// -----------------------
// Shows the user how their discipline score trends over time AND which
// rule violations keep repeating. Pure visualization on top of trade_logs
// data already loaded by the parent — no extra fetch.
//
// - Discipline score per trade is derived deterministically from mistakes
//   using the same engine as src/lib/behavioralJournal (PER_TRADE_BASE,
//   MAX_PENALTY, MIN_TRADE_SCORE, MISTAKE_PENALTY). This keeps the panel
//   in sync with the journal scoring without touching scoring code.
// - "Trend" is the chronological sequence of per-trade scores, with a
//   rolling average overlay so a single bad trade doesn't read as a crash.
// - "Repeats" lists the most frequent mistakes with count + share of trades
//   that contained them.

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  MISTAKE_PENALTY,
  PER_TRADE_BASE,
  MAX_PENALTY,
  MIN_TRADE_SCORE,
} from "@/lib/behavioralJournal";
import type { TradeLog } from "@/lib/tradeLogs";

const MISTAKE_DISPLAY: Record<string, string> = {
  overleveraged: "Overleveraged",
  revenge_trade: "Revenge Trade",
  no_setup: "Entered Without Confirmation",
  ignored_sl: "Ignored Stop Loss",
  early_entry: "Early Entry",
  late_entry: "Late Entry",
  moved_sl: "Moved Stop Loss",
  oversized: "Oversized Position",
  fomo: "FOMO Entry",
  broke_risk_rule: "Broke Risk Rule",
};

function prettyMistake(raw: string): string {
  if (MISTAKE_DISPLAY[raw]) return MISTAKE_DISPLAY[raw];
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function tradeScore(mistakes: string[]): number {
  const raw = mistakes.reduce(
    (s, id) => s + (MISTAKE_PENALTY[id as keyof typeof MISTAKE_PENALTY] ?? 0),
    0,
  );
  const applied = Math.min(MAX_PENALTY, raw);
  return Math.max(MIN_TRADE_SCORE, PER_TRADE_BASE - applied);
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type TrendPoint = {
  i: number;        // 1-indexed trade number (for X axis)
  score: number;    // per-trade score
  rolling: number;  // rolling average over last N trades
  date: string;     // short label for tooltip
  pair: string;
  mistakeCount: number;
};

type RepeatRow = {
  id: string;
  label: string;
  count: number;
  pct: number;        // share of trades that contained this mistake (0..100)
  totalPenalty: number;
};

const ROLLING_WINDOW = 5;

export default function DisciplineTrendsPanel({
  trades,
}: {
  trades: TradeLog[];
}) {
  // Sort oldest → newest so the chart reads left-to-right as time passes.
  const ordered = useMemo(
    () =>
      [...trades].sort(
        (a, b) =>
          new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime(),
      ),
    [trades],
  );

  const points = useMemo<TrendPoint[]>(() => {
    const out: TrendPoint[] = [];
    const recent: number[] = [];
    ordered.forEach((t, idx) => {
      const score = tradeScore(t.mistakes ?? []);
      recent.push(score);
      if (recent.length > ROLLING_WINDOW) recent.shift();
      const rolling =
        Math.round(
          (recent.reduce((s, n) => s + n, 0) / recent.length) * 10,
        ) / 10;
      out.push({
        i: idx + 1,
        score,
        rolling,
        date: fmtShortDate(t.opened_at),
        pair: t.pair,
        mistakeCount: (t.mistakes ?? []).length,
      });
    });
    return out;
  }, [ordered]);

  const repeats = useMemo<RepeatRow[]>(() => {
    const counts = new Map<string, { count: number; penalty: number }>();
    for (const t of ordered) {
      // Use a Set so duplicate ids on a single trade only count once.
      const unique = new Set(t.mistakes ?? []);
      for (const id of unique) {
        const prev = counts.get(id) ?? { count: 0, penalty: 0 };
        prev.count += 1;
        prev.penalty +=
          MISTAKE_PENALTY[id as keyof typeof MISTAKE_PENALTY] ?? 0;
        counts.set(id, prev);
      }
    }
    const total = ordered.length || 1;
    return Array.from(counts.entries())
      .map(([id, v]) => ({
        id,
        label: prettyMistake(id),
        count: v.count,
        pct: Math.round((v.count / total) * 100),
        totalPenalty: v.penalty,
      }))
      .sort((a, b) => b.count - a.count || b.totalPenalty - a.totalPenalty);
  }, [ordered]);

  const summary = useMemo(() => {
    if (points.length === 0) {
      return { avg: null as number | null, latest: null as number | null, delta: 0 };
    }
    const avg =
      Math.round(
        (points.reduce((s, p) => s + p.score, 0) / points.length) * 10,
      ) / 10;
    const latest = points[points.length - 1].score;
    // Delta = last rolling vs first rolling, gives a "trend direction".
    const first = points[0].rolling;
    const last = points[points.length - 1].rolling;
    const delta = Math.round((last - first) * 10) / 10;
    return { avg, latest, delta };
  }, [points]);

  if (ordered.length === 0) {
    return null; // Parent already shows an empty state for the journal.
  }

  // Recharts data domain — pin Y to the scoring range so the line reads
  // honestly (no auto-zoom that exaggerates a single dip).
  const yDomain: [number, number] = [0, 100];

  return (
    <section
      aria-label="Discipline trends"
      className="mt-5 rounded-2xl bg-card ring-1 ring-border p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-text-primary">
            Discipline trend
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary/70">
            Last {ordered.length} trade{ordered.length === 1 ? "" : "s"} ·
            rolling avg over {ROLLING_WINDOW}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary/60">
            Average
          </p>
          <p className="text-[16px] font-semibold tabular-nums text-gold">
            {summary.avg ?? "—"}
            <span className="ml-1 text-[10.5px] font-medium text-text-secondary/60">
              / 100
            </span>
          </p>
          {summary.delta !== 0 && (
            <p
              className={`text-[10.5px] font-medium tabular-nums ${
                summary.delta > 0 ? "text-gold" : "text-rose-300"
              }`}
            >
              {summary.delta > 0 ? "▲" : "▼"} {Math.abs(summary.delta)} trend
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="trend-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E7C98A" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#C6A15B" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(154,154,154,0.12)"
              strokeDasharray="3 4"
              vertical={false}
            />
            <XAxis
              dataKey="i"
              tick={{ fill: "rgba(154,154,154,0.65)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              domain={yDomain}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: "rgba(154,154,154,0.65)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <ReferenceLine
              y={70}
              stroke="rgba(198,161,91,0.35)"
              strokeDasharray="2 4"
            />
            <Tooltip
              cursor={{ stroke: "rgba(198,161,91,0.4)", strokeWidth: 1 }}
              contentStyle={{
                background: "#18181B",
                border: "1px solid rgba(198,161,91,0.25)",
                borderRadius: 10,
                fontSize: 11,
                color: "#EDEDED",
                padding: "8px 10px",
              }}
              labelFormatter={(_v, payload) => {
                const p = payload?.[0]?.payload as TrendPoint | undefined;
                if (!p) return "";
                return `#${p.i} · ${p.pair} · ${p.date}`;
              }}
              formatter={(value: number, name: string) => {
                const label = name === "score" ? "Score" : "Rolling avg";
                return [value, label];
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="rgba(231,201,138,0.55)"
              strokeWidth={1.25}
              dot={{ r: 2, fill: "#C6A15B", stroke: "none" }}
              activeDot={{ r: 4, fill: "#E7C98A", stroke: "none" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="rolling"
              stroke="url(#trend-gold)"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Repeated mistakes */}
      <div className="mt-4 border-t border-border/60 pt-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[12.5px] font-semibold text-text-primary">
            Repeated mistakes
          </h3>
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-secondary/55">
            count · % of trades
          </span>
        </div>

        {repeats.length === 0 ? (
          <p className="mt-2 text-[11.5px] text-text-secondary/80">
            No mistakes flagged yet. Keep logging — patterns will surface here.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {repeats.map((r) => (
              <li key={r.id} className="text-[11.5px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-text-primary/90">
                    {r.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-text-secondary/80">
                    {r.count}
                    <span className="mx-1.5 text-text-secondary/40">·</span>
                    {r.pct}%
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-background/60 ring-1 ring-border/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#C6A15B] to-[#E7C98A]"
                    style={{ width: `${Math.max(4, r.pct)}%` }}
                    aria-hidden
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[10.5px] leading-snug text-text-secondary/60">
          The dashed line marks 70 — your control threshold. Mistakes ranked by
          how often they repeat across logged trades.
        </p>
      </div>
    </section>
  );
}
