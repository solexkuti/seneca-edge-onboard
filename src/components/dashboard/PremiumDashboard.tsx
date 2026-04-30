// PremiumDashboard — desktop-first dashboard for /hub.
// Read-only: pulls metrics from existing hooks. No engine or DB changes.

import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  LineChart,
  BookOpenCheck,
  Sparkles,
  ShieldCheck,
  Wallet,
  Target,
  TrendingUp,
  Activity,
  Brain,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  StickyNote,
  AlertTriangle,
  Clock,
  Globe2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useBehavioralJournal } from "@/hooks/useBehavioralJournal";
import { usePerformance } from "@/hooks/usePerformance";
import { useTraderState } from "@/hooks/useTraderState";
import { disciplineState } from "@/lib/behavioralJournal";

const ease = [0.22, 1, 0.36, 1] as const;

const TONE_TEXT: Record<string, string> = {
  ok: "text-gold",
  drift: "text-amber-300",
  warn: "text-orange-300",
  risk: "text-rose-300",
  inactive: "text-text-secondary",
};

export default function PremiumDashboard({ userName }: { userName?: string }) {
  const { entries, score } = useBehavioralJournal(20);
  const { state } = useTraderState();
  const performance = usePerformance(20);

  const ds = disciplineState(score);
  const bp = state.strategy?.blueprint ?? null;
  const wr = performance.metrics?.winRate ?? 0;
  const winRatePct = Math.round(wr * 100);
  const recent = useMemo(() => performance.trades.slice(0, 5), [performance.trades]);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 py-8 md:px-8 md:py-10">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-8 flex flex-wrap items-end justify-between gap-4"
      >
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold/80">
            Dashboard
          </p>
          <h1 className="mt-2 font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-text-primary md:text-[34px]">
            {userName ? `Welcome back, ${userName}.` : "Welcome back."}
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">
            Control the process. Ignore the outcome. Your edge in one glance.
          </p>
        </div>
        <Link
          to="/hub/chart"
          preload="intent"
          className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold"
        >
          Open Analyzer
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </motion.header>

      {/* Top row: account / discipline / strategy */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card>
          <CardEyebrow Icon={Wallet}>Account</CardEyebrow>
          <p className="mt-3 font-display text-[28px] font-semibold tracking-tight text-text-primary">
            $10,000.00
          </p>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            Demo balance · placeholder
          </p>
          <Divider />
          <Row label="Today" value="—" />
          <Row label="This week" value="—" />
        </Card>

        <Card highlight>
          <CardEyebrow Icon={ShieldCheck}>Discipline score</CardEyebrow>
          <div className="mt-3 flex items-end gap-2">
            <span
              className={`font-display text-[44px] font-semibold leading-none tabular-nums ${TONE_TEXT[ds.tone]}`}
              style={
                ds.tone === "ok"
                  ? { textShadow: "0 0 28px rgba(198,161,91,0.40)" }
                  : undefined
              }
            >
              {score == null ? "—" : score}
            </span>
            <span className="mb-1.5 text-[13px] text-text-secondary">/100</span>
          </div>
          <p className={`mt-1 text-[12.5px] font-medium ${TONE_TEXT[ds.tone]}`}>
            {ds.label}
          </p>
          <Divider />
          <Row label="Trades reviewed" value={String(entries.length)} />
          <Row
            label="Last classification"
            value={entries[0]?.classification ?? "—"}
          />
        </Card>

        <Card>
          <CardEyebrow Icon={Target}>Strategy</CardEyebrow>
          <p className="mt-3 truncate font-display text-[20px] font-semibold tracking-tight text-text-primary">
            {bp?.name || "No strategy yet"}
          </p>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            {bp ? (bp.locked ? "Locked system" : "Active system") : "Define your edge"}
          </p>
          <Divider />
          <Link
            to="/hub/strategy"
            preload="intent"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold hover:text-gold-soft"
          >
            {bp ? "Open Strategy Builder" : "Build your strategy"}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </Link>
        </Card>
      </div>

      {/* Mid row: performance snapshot + quick actions */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardEyebrow Icon={LineChart}>Performance snapshot</CardEyebrow>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <Stat
              label="Win rate"
              value={performance.hasTrades ? `${winRatePct}%` : "—"}
            />
            <Stat
              label="Avg R"
              value={
                performance.metrics?.avgRR != null && performance.hasTrades
                  ? performance.metrics.avgRR.toFixed(2)
                  : "—"
              }
            />
            <Stat
              label="Profit factor"
              value={
                performance.metrics?.profitFactor != null && performance.hasTrades
                  ? performance.metrics.profitFactor.toFixed(2)
                  : "—"
              }
            />
          </div>
          <Divider />
          <div className="space-y-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
              Recent trades
            </p>
            {recent.length === 0 ? (
              <p className="text-[13px] text-text-secondary">
                No trades logged yet. Start by analyzing a chart or logging from the Journal.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {recent.map((t) => {
                  const r = typeof t.rr === "number" ? t.rr : null;
                  const positive = r != null && r > 0;
                  const negative = r != null && r < 0;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between py-2.5 text-[13px]"
                    >
                      <span className="truncate text-text-primary">
                        {t.pair || "—"}
                      </span>
                      <span className="text-text-secondary">
                        {t.direction || "—"}
                      </span>
                      <span
                        className={
                          positive
                            ? "font-semibold text-gold"
                            : negative
                            ? "font-semibold text-rose-300"
                            : "text-text-secondary"
                        }
                      >
                        {r != null ? `${r > 0 ? "+" : ""}${r.toFixed(2)}R` : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardEyebrow Icon={Sparkles}>Quick actions</CardEyebrow>
          <div className="mt-4 space-y-2.5">
            <ActionRow
              to="/hub/chart"
              title="Chart Analyzer"
              subtitle="Run a trade against your rules"
              Icon={LineChart}
            />
            <ActionRow
              to="/hub/journal"
              title="Trading Journal"
              subtitle="Log behavior and patterns"
              Icon={BookOpenCheck}
            />
            <ActionRow
              to="/hub/mentor"
              title="AI Mentor"
              subtitle="Reflect with Seneca"
              Icon={Sparkles}
            />
          </div>
        </Card>
      </div>

      {/* ── 1. Performance Trend (equity curve) ─────────────── */}
      <div className="mt-5">
        <PerformanceTrendCard />
      </div>

      {/* ── 2. Full Stats Panel ─────────────────────────────── */}
      <div className="mt-5">
        <FullStatsPanel />
      </div>

      {/* ── 3 + 4. Trade History  +  Behavior Breakdown ─────── */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <TradeHistoryPanel />
        <BehaviorBreakdownCard />
      </div>
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────────────────

function Card({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className={[
        "relative overflow-hidden rounded-2xl border bg-[#16181D] p-6",
        highlight
          ? "border-gold/20 shadow-[0_0_36px_-14px_rgba(198,161,91,0.35)]"
          : "border-white/[0.06]",
      ].join(" ")}
    >
      {children}
    </motion.div>
  );
}

function CardEyebrow({
  Icon,
  children,
}: {
  Icon: typeof LineChart;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
        <Icon className="h-[15px] w-[15px] text-gold" strokeWidth={1.9} />
      </div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
        {children}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="my-4 h-px bg-white/[0.05]" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[13px]">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
        {label}
      </p>
      <p className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-text-primary tabular-nums">
        {value}
      </p>
    </div>
  );
}

function ActionRow({
  to,
  title,
  subtitle,
  Icon,
}: {
  to: "/hub/chart" | "/hub/journal" | "/hub/mentor";
  title: string;
  subtitle: string;
  Icon: typeof LineChart;
}) {
  return (
    <Link
      to={to}
      preload="intent"
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-gold/25 hover:bg-white/[0.04]"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
        <Icon className="h-[15px] w-[15px] text-gold" strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold tracking-tight text-text-primary">
          {title}
        </p>
        <p className="text-[12px] text-text-secondary">{subtitle}</p>
      </div>
      <ArrowUpRight
        className="h-4 w-4 text-text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold"
        strokeWidth={2}
      />
    </Link>
  );
}

// ─── 1. Performance Trend (equity curve, placeholder) ──────────

const EQUITY_CURVE: { day: number; value: number }[] = [
  { day: 1, value: 10000 },
  { day: 2, value: 10120 },
  { day: 3, value: 10080 },
  { day: 4, value: 10240 },
  { day: 5, value: 10310 },
  { day: 6, value: 10220 },
  { day: 7, value: 10410 },
  { day: 8, value: 10580 },
  { day: 9, value: 10495 },
  { day: 10, value: 10630 },
  { day: 11, value: 10770 },
  { day: 12, value: 10720 },
  { day: 13, value: 10880 },
  { day: 14, value: 11040 },
  { day: 15, value: 10985 },
  { day: 16, value: 11150 },
  { day: 17, value: 11320 },
  { day: 18, value: 11260 },
  { day: 19, value: 11440 },
  { day: 20, value: 11605 },
];

function PerformanceTrendCard() {
  const W = 1100;
  const H = 260;
  const PAD_X = 24;
  const PAD_Y = 24;

  const values = EQUITY_CURVE.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const xFor = (i: number) =>
    PAD_X + (i / (EQUITY_CURVE.length - 1)) * (W - PAD_X * 2);
  const yFor = (v: number) =>
    PAD_Y + (1 - (v - min) / range) * (H - PAD_Y * 2);

  const linePath = EQUITY_CURVE.map(
    (d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(d.value).toFixed(2)}`,
  ).join(" ");

  const areaPath =
    `${linePath} L ${xFor(EQUITY_CURVE.length - 1).toFixed(2)} ${(H - PAD_Y).toFixed(2)} ` +
    `L ${xFor(0).toFixed(2)} ${(H - PAD_Y).toFixed(2)} Z`;

  const start = EQUITY_CURVE[0].value;
  const end = EQUITY_CURVE[EQUITY_CURVE.length - 1].value;
  const pct = ((end - start) / start) * 100;

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow Icon={TrendingUp}>Performance trend</CardEyebrow>
          <p className="mt-3 font-display text-[26px] font-semibold tracking-tight text-text-primary tabular-nums">
            ${end.toLocaleString()}
          </p>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            Last 20 sessions ·{" "}
            <span className={pct >= 0 ? "text-gold" : "text-rose-300"}>
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(2)}%
            </span>
          </p>
        </div>
        <div className="flex gap-1.5">
          {["1W", "1M", "3M", "All"].map((l, i) => (
            <span
              key={l}
              className={[
                "rounded-md px-2.5 py-1 text-[11.5px] font-semibold",
                i === 1
                  ? "bg-gold/15 text-gold ring-1 ring-gold/25"
                  : "text-text-secondary ring-1 ring-white/[0.06]",
              ].join(" ")}
            >
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[240px] w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="equityArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#C6A15B" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#C6A15B" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="equityLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#C6A15B" />
              <stop offset="100%" stopColor="#E7C98A" />
            </linearGradient>
          </defs>
          {/* gridlines */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={PAD_Y + t * (H - PAD_Y * 2)}
              y2={PAD_Y + t * (H - PAD_Y * 2)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          ))}
          <path d={areaPath} fill="url(#equityArea)" />
          <path
            d={linePath}
            fill="none"
            stroke="url(#equityLine)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* end point */}
          <circle
            cx={xFor(EQUITY_CURVE.length - 1)}
            cy={yFor(end)}
            r="4"
            fill="#E7C98A"
          />
          <circle
            cx={xFor(EQUITY_CURVE.length - 1)}
            cy={yFor(end)}
            r="9"
            fill="#E7C98A"
            opacity="0.18"
          />
        </svg>
      </div>
    </Card>
  );
}

// ─── 2. Full Stats Panel ───────────────────────────────────────

function FullStatsPanel() {
  const stats: { label: string; value: string; tone?: "ok" | "risk" }[] = [
    { label: "Win rate", value: "58%", tone: "ok" },
    { label: "Profit factor", value: "1.82", tone: "ok" },
    { label: "Avg R", value: "+0.74R", tone: "ok" },
    { label: "Max drawdown", value: "−6.4%", tone: "risk" },
    { label: "Expectancy", value: "+0.42R" },
  ];

  return (
    <Card>
      <CardEyebrow Icon={Activity}>Full statistics</CardEyebrow>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
              {s.label}
            </p>
            <p
              className={[
                "mt-1.5 font-display text-[24px] font-semibold tracking-tight tabular-nums",
                s.tone === "risk"
                  ? "text-rose-300"
                  : s.tone === "ok"
                    ? "text-gold"
                    : "text-text-primary",
              ].join(" ")}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[11.5px] text-text-secondary/80">
        Demo metrics · live values populate as you log trades.
      </p>
    </Card>
  );
}

// ─── 3. Trade History Panel (expandable) ───────────────────────

type DemoTrade = {
  id: string;
  date: string;
  pair: string;
  direction: "Long" | "Short";
  result: string; // e.g. "+1.8R"
  resultPositive: boolean;
  notes: string;
};

const DEMO_TRADES: DemoTrade[] = [
  { id: "t1", date: "Apr 29", pair: "EUR/USD", direction: "Long", result: "+1.80R", resultPositive: true, notes: "London open continuation, clean structure." },
  { id: "t2", date: "Apr 28", pair: "GBP/USD", direction: "Short", result: "−1.00R", resultPositive: false, notes: "Lost patience — entered before confirmation." },
  { id: "t3", date: "Apr 28", pair: "XAU/USD", direction: "Long", result: "+2.40R", resultPositive: true, notes: "Textbook breakout, full plan executed." },
  { id: "t4", date: "Apr 26", pair: "BTC/USD", direction: "Short", result: "+0.90R", resultPositive: true, notes: "Took partials early, slight FOMO exit." },
  { id: "t5", date: "Apr 25", pair: "US100", direction: "Long", result: "−0.80R", resultPositive: false, notes: "Counter-trend trade — outside strategy." },
  { id: "t6", date: "Apr 24", pair: "EUR/USD", direction: "Short", result: "+1.10R", resultPositive: true, notes: "NY session reversal, well-timed." },
  { id: "t7", date: "Apr 23", pair: "ETH/USD", direction: "Long", result: "+0.60R", resultPositive: true, notes: "Small win, hesitated on add." },
  { id: "t8", date: "Apr 22", pair: "GBP/USD", direction: "Long", result: "−1.00R", resultPositive: false, notes: "Revenge trade after morning loss." },
  { id: "t9", date: "Apr 21", pair: "XAU/USD", direction: "Short", result: "+1.50R", resultPositive: true, notes: "Disciplined entry on retest." },
  { id: "t10", date: "Apr 20", pair: "BTC/USD", direction: "Long", result: "+2.10R", resultPositive: true, notes: "High-conviction setup, full size." },
];

function TradeHistoryPanel() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? DEMO_TRADES : DEMO_TRADES.slice(0, 5);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardEyebrow Icon={BookOpenCheck}>Trade history</CardEyebrow>
        <span className="text-[11.5px] text-text-secondary">
          {DEMO_TRADES.length} trades
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.05]">
        <div className="grid grid-cols-[88px_1fr_88px_88px_1.6fr] items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
          <span>Date</span>
          <span>Pair</span>
          <span>Dir</span>
          <span>Result</span>
          <span>Notes</span>
        </div>
        <ul>
          <AnimatePresence initial={false}>
            {visible.map((t) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease }}
                className="grid grid-cols-[88px_1fr_88px_88px_1.6fr] items-center gap-3 border-b border-white/[0.04] px-4 py-3 text-[13px] last:border-b-0 hover:bg-white/[0.02]"
              >
                <span className="text-text-secondary tabular-nums">{t.date}</span>
                <span className="font-medium text-text-primary">{t.pair}</span>
                <span
                  className={
                    t.direction === "Long"
                      ? "text-gold"
                      : "text-rose-300"
                  }
                >
                  {t.direction}
                </span>
                <span
                  className={[
                    "font-semibold tabular-nums",
                    t.resultPositive ? "text-gold" : "text-rose-300",
                  ].join(" ")}
                >
                  {t.result}
                </span>
                <span className="truncate text-text-secondary">{t.notes}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] font-semibold text-text-primary transition-colors hover:border-gold/25 hover:bg-white/[0.04]"
      >
        {expanded ? "Show less" : "Show all trades"}
        {expanded ? (
          <ChevronUp className="h-4 w-4" strokeWidth={2} />
        ) : (
          <ChevronDown className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
    </Card>
  );
}

// ─── 4. Behavior Breakdown ─────────────────────────────────────

function BehaviorBreakdownCard() {
  const adherence = 78; // %
  const systemRatio = 72; // % system trades vs emotional
  const london = 64;
  const ny = 51;

  return (
    <Card highlight>
      <CardEyebrow Icon={Brain}>Behavior breakdown</CardEyebrow>

      {/* Rule adherence */}
      <div className="mt-4">
        <div className="flex items-end justify-between">
          <p className="text-[12.5px] text-text-secondary">Rule adherence</p>
          <p className="font-display text-[20px] font-semibold tabular-nums text-gold">
            {adherence}%
          </p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
            style={{
              width: `${adherence}%`,
              boxShadow: "0 0 18px rgba(198,161,91,0.35)",
            }}
          />
        </div>
      </div>

      <Divider />

      {/* Most broken rule */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
          Most broken rule
        </p>
        <p className="mt-1.5 text-[13.5px] font-semibold text-text-primary">
          “Wait for confirmation candle”
        </p>
        <p className="text-[12px] text-text-secondary">
          Broken in 6 of last 20 trades · costs ~0.4R per occurrence.
        </p>
      </div>

      <Divider />

      {/* System vs emotional */}
      <div>
        <div className="flex items-end justify-between">
          <p className="text-[12.5px] text-text-secondary">System vs emotional</p>
          <p className="text-[12.5px] tabular-nums text-text-primary">
            <span className="font-semibold text-gold">{systemRatio}%</span>
            <span className="text-text-secondary"> · {100 - systemRatio}%</span>
          </p>
        </div>
        <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full bg-gradient-to-r from-gold to-gold-soft"
            style={{ width: `${systemRatio}%` }}
          />
          <div
            className="h-full bg-rose-400/60"
            style={{ width: `${100 - systemRatio}%` }}
          />
        </div>
      </div>

      <Divider />

      {/* Session performance */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
          Session performance
        </p>
        <div className="mt-3 space-y-3">
          <SessionBar label="London" value={london} />
          <SessionBar label="New York" value={ny} />
        </div>
      </div>
    </Card>
  );
}

function SessionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="text-text-primary">{label}</span>
        <span className="tabular-nums text-text-secondary">
          Win rate <span className="font-semibold text-gold">{value}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold-soft"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
