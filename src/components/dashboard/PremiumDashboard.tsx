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
  ImageIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTraderState } from "@/hooks/useTraderState";
import { useSsot } from "@/hooks/useSsot";
import {
  metricColorStyle,
  metricGlowShadow,
  metricTextClass,
} from "@/lib/metricColor";
import SsotAlerts from "@/components/feature/SsotAlerts";

function disciplineLabel(score: number): string {
  if (score >= 80) return "In control";
  if (score >= 60) return "Slipping";
  if (score >= 40) return "At risk";
  return "Locked";
}

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

      {/* SSOT-derived alerts (read-only, no hard blocks) */}
      <div className="mb-6">
        <SsotAlerts />
      </div>

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
              className="font-display text-[44px] font-semibold leading-none tabular-nums"
              style={{
                ...metricColorStyle(score),
                textShadow: score == null ? undefined : metricGlowShadow(score),
              }}
            >
              {score == null ? "—" : score}
            </span>
            <span className="mb-1.5 text-[13px] text-text-secondary">/100</span>
          </div>
          <p
            className={`mt-1 text-[12.5px] font-medium ${metricTextClass(score)}`}
          >
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

      {/* ── 3. Trade History (full rebuild) ─────────────────── */}
      <div className="mt-5">
        <TradeHistoryPanel />
      </div>

      {/* ── 4. Behavior Breakdown (full rebuild) ────────────── */}
      <div className="mt-5">
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

// ─── 3. Trade History — institutional rebuild ──────────────────

type DemoTrade = {
  id: string;
  date: string;
  asset: string;
  direction: "Buy" | "Sell";
  resultR: number; // signed R
  rulesBroken: string[]; // empty = clean
  disciplineScore: number; // 0..100
  notes: string;
};

const DEMO_TRADES: DemoTrade[] = [
  { id: "t1", date: "Apr 29", asset: "EUR/USD", direction: "Buy", resultR: 1.8, rulesBroken: [], disciplineScore: 96, notes: "London open continuation, clean structure." },
  { id: "t2", date: "Apr 28", asset: "GBP/USD", direction: "Sell", resultR: -1.0, rulesBroken: ["No Stop Loss", "Early Entry"], disciplineScore: 42, notes: "Lost patience — entered before confirmation." },
  { id: "t3", date: "Apr 28", asset: "XAU/USD", direction: "Buy", resultR: 2.4, rulesBroken: [], disciplineScore: 98, notes: "Textbook breakout, full plan executed." },
  { id: "t4", date: "Apr 26", asset: "BTC/USD", direction: "Sell", resultR: 0.9, rulesBroken: ["Early Exit"], disciplineScore: 64, notes: "Took partials early, slight FOMO exit." },
  { id: "t5", date: "Apr 25", asset: "US100", direction: "Buy", resultR: -0.8, rulesBroken: ["Overtrading", "Counter-trend Entry"], disciplineScore: 38, notes: "Counter-trend trade — outside strategy." },
  { id: "t6", date: "Apr 24", asset: "EUR/USD", direction: "Sell", resultR: 1.1, rulesBroken: [], disciplineScore: 91, notes: "NY session reversal, well-timed." },
  { id: "t7", date: "Apr 23", asset: "ETH/USD", direction: "Buy", resultR: 0.6, rulesBroken: ["Hesitated Add"], disciplineScore: 70, notes: "Small win, hesitated on add." },
  { id: "t8", date: "Apr 22", asset: "GBP/USD", direction: "Buy", resultR: -1.0, rulesBroken: ["Revenge Trade", "No Stop Loss"], disciplineScore: 30, notes: "Revenge trade after morning loss." },
  { id: "t9", date: "Apr 21", asset: "XAU/USD", direction: "Sell", resultR: 1.5, rulesBroken: [], disciplineScore: 94, notes: "Disciplined entry on retest." },
  { id: "t10", date: "Apr 20", asset: "BTC/USD", direction: "Buy", resultR: 2.1, rulesBroken: [], disciplineScore: 97, notes: "High-conviction setup, full size." },
];

function fmtR(r: number) {
  const sign = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${sign}${Math.abs(r).toFixed(2)}R`;
}

function TradeHistoryPanel() {
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = expanded ? DEMO_TRADES : DEMO_TRADES.slice(0, 6);

  const stats = useMemo(() => {
    const total = DEMO_TRADES.length;
    const wins = DEMO_TRADES.filter((t) => t.resultR > 0).length;
    const totalR = DEMO_TRADES.reduce((a, t) => a + t.resultR, 0);
    const absSum = DEMO_TRADES.reduce((a, t) => a + Math.abs(t.resultR), 0);
    return {
      total,
      winRate: Math.round((wins / total) * 100),
      avgR: absSum / total,
      totalR,
    };
  }, []);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardEyebrow Icon={BookOpenCheck}>Trade history</CardEyebrow>
        <span className="text-[11.5px] text-text-secondary">
          Last {DEMO_TRADES.length} trades
        </span>
      </div>

      {/* Summary bar */}
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.04] sm:grid-cols-4">
        <SummaryCell label="Total Trades" value={String(stats.total)} />
        <SummaryCell label="Win Rate" value={`${stats.winRate}%`} accent="gold" />
        <SummaryCell label="Avg R" value={stats.avgR.toFixed(2)} />
        <SummaryCell
          label="Total R"
          value={fmtR(stats.totalR)}
          accent={stats.totalR >= 0 ? "gold" : "loss"}
        />
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.05]">
        <div className="grid grid-cols-[88px_1fr_72px_88px_1.4fr_120px_44px] items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
          <span>Date</span>
          <span>Asset</span>
          <span>Dir</span>
          <span>Result</span>
          <span>Rules broken</span>
          <span>Discipline</span>
          <span className="text-right">Notes</span>
        </div>
        <ul>
          <AnimatePresence initial={false}>
            {visible.map((t) => {
              const clean = t.rulesBroken.length === 0;
              const isOpen = openId === t.id;
              return (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease }}
                  className="border-b border-white/[0.04] last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : t.id)}
                    className="grid w-full grid-cols-[88px_1fr_72px_88px_1.4fr_120px_44px] items-center gap-3 px-4 py-3 text-left text-[13px] transition-all hover:-translate-y-[1px] hover:bg-white/[0.025]"
                  >
                    <span className="tabular-nums text-text-secondary">{t.date}</span>
                    <span className="font-medium text-text-primary">{t.asset}</span>
                    <span
                      className={
                        t.direction === "Buy" ? "text-gold" : "text-rose-300"
                      }
                    >
                      {t.direction}
                    </span>
                    <span
                      className={[
                        "font-semibold tabular-nums",
                        t.resultR >= 0 ? "text-gold" : "text-rose-300",
                      ].join(" ")}
                      style={
                        t.resultR >= 0
                          ? { textShadow: "0 0 14px rgba(198,161,91,0.25)" }
                          : undefined
                      }
                    >
                      {fmtR(t.resultR)}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {clean ? (
                        <span className="inline-flex items-center rounded-md border border-gold/20 bg-gold/[0.06] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-gold">
                          Clean
                        </span>
                      ) : (
                        t.rulesBroken.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded-md border border-rose-400/20 bg-rose-400/[0.07] px-1.5 py-0.5 text-[10.5px] font-medium text-rose-200"
                          >
                            {r}
                          </span>
                        ))
                      )}
                    </span>
                    <DisciplineBar value={t.disciplineScore} />
                    <span className="flex justify-end">
                      <StickyNote
                        className="h-[14px] w-[14px] text-text-secondary/70"
                        strokeWidth={1.8}
                      />
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease }}
                        className="overflow-hidden bg-white/[0.015]"
                      >
                        <div className="px-4 py-4">
                          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
                            Notes
                          </p>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-text-primary/90">
                            {t.notes}
                          </p>
                          {!clean && (
                            <div className="mt-3 rounded-lg border border-rose-400/15 bg-rose-400/[0.04] p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-200/80">
                                Behavioral note
                              </p>
                              <p className="mt-1 text-[12.5px] text-text-secondary">
                                Plan deviation cost ≈{" "}
                                <span className="font-semibold text-rose-200">
                                  {fmtR(Math.min(t.resultR, -0.4))}
                                </span>{" "}
                                vs. expected execution.
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
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

function SummaryCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "gold" | "loss";
}) {
  return (
    <div className="bg-[#16181D] px-4 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
        {label}
      </p>
      <p
        className={[
          "mt-1 font-display text-[18px] font-semibold tabular-nums",
          accent === "gold"
            ? "text-gold"
            : accent === "loss"
              ? "text-rose-300"
              : "text-text-primary",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function DisciplineBar({ value }: { value: number }) {
  const tone =
    value >= 80
      ? "from-gold to-gold-soft"
      : value >= 55
        ? "from-amber-300 to-gold"
        : "from-rose-400/80 to-rose-300";
  const text =
    value >= 80 ? "text-gold" : value >= 55 ? "text-amber-200" : "text-rose-300";
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-1 w-14 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tone}`}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className={`text-[11.5px] font-semibold tabular-nums ${text}`}>
        {value}%
      </span>
    </span>
  );
}

// ─── 4. Behavior Breakdown — full rebuild ──────────────────────

type ViolationRow = {
  rule: string;
  times: number;
  lastBroken: string;
  impactR: number; // negative
  occurrences: { date: string; result: string }[];
  insight: string;
};

const VIOLATIONS: ViolationRow[] = [
  {
    rule: "No Stop Loss",
    times: 8,
    lastBroken: "Apr 28",
    impactR: -4.2,
    occurrences: [
      { date: "Apr 28", result: "−1.0R" },
      { date: "Apr 22", result: "−1.0R" },
      { date: "Apr 18", result: "−0.8R" },
      { date: "Apr 14", result: "−0.6R" },
      { date: "Apr 10", result: "−0.4R" },
      { date: "Apr 06", result: "−0.2R" },
      { date: "Apr 03", result: "−0.1R" },
      { date: "Mar 29", result: "−0.1R" },
    ],
    insight:
      "Skipping stops correlates with your largest single-trade losses. This is the highest-impact rule break in your sample.",
  },
  {
    rule: "Early Exit",
    times: 5,
    lastBroken: "Apr 27",
    impactR: -2.1,
    occurrences: [
      { date: "Apr 27", result: "+0.3R (missed +1.2R)" },
      { date: "Apr 23", result: "+0.6R (missed +0.9R)" },
      { date: "Apr 19", result: "+0.4R" },
      { date: "Apr 15", result: "+0.2R" },
      { date: "Apr 11", result: "+0.1R" },
    ],
    insight:
      "Most early exits happen after a 0.5R move. You leave roughly 0.4R on the table per occurrence.",
  },
  {
    rule: "Overtrading",
    times: 3,
    lastBroken: "Apr 25",
    impactR: -1.5,
    occurrences: [
      { date: "Apr 25", result: "−0.8R" },
      { date: "Apr 17", result: "−0.4R" },
      { date: "Apr 09", result: "−0.3R" },
    ],
    insight:
      "Overtrading shows up after a winning trade — momentum bias rather than fresh setups.",
  },
  {
    rule: "Revenge Trade",
    times: 2,
    lastBroken: "Apr 22",
    impactR: -1.1,
    occurrences: [
      { date: "Apr 22", result: "−1.0R" },
      { date: "Apr 08", result: "−0.1R" },
    ],
    insight:
      "Both revenge trades occurred within 30 minutes of a stop-out. Pattern is emotional, not structural.",
  },
  {
    rule: "Counter-trend Entry",
    times: 1,
    lastBroken: "Apr 25",
    impactR: -0.0,
    occurrences: [{ date: "Apr 25", result: "−0.8R" }],
    insight: "Single occurrence — monitor before treating as a trend.",
  },
];

const TIMELINE: {
  date: string;
  items: { asset: string; rule: string; impact: string; screenshot: string | null }[];
}[] = [
  {
    date: "Apr 28",
    items: [
      { asset: "EUR/USD", rule: "No Stop Loss", impact: "−1.0R", screenshot: null },
      { asset: "BTC/USD", rule: "Revenge Trade", impact: "−0.5R", screenshot: null },
    ],
  },
  {
    date: "Apr 25",
    items: [
      { asset: "GBP/JPY", rule: "Overtrading", impact: "−0.8R", screenshot: null },
      { asset: "XAU/USD", rule: "Counter-trend Entry", impact: "−0.8R", screenshot: null },
    ],
  },
  {
    date: "Apr 23",
    items: [
      { asset: "NAS100", rule: "Early Exit", impact: "missed +0.9R", screenshot: null },
    ],
  },
  {
    date: "Apr 22",
    items: [
      { asset: "EUR/USD", rule: "No Stop Loss", impact: "−1.0R", screenshot: null },
      { asset: "ETH/USD", rule: "Revenge Trade", impact: "−0.5R", screenshot: null },
    ],
  },
];

type Timeframe = "7D" | "30D" | "90D" | "ALL";

function BehaviorBreakdownCard() {
  const [tf, setTf] = useState<Timeframe>("30D");
  const [openRule, setOpenRule] = useState<string | null>(null);

  const behaviorScore = 74;
  const adherence = 78;
  const systemRatio = 72;

  const totalViolations = VIOLATIONS.reduce((a, v) => a + v.times, 0);
  const totalImpact = VIOLATIONS.reduce((a, v) => a + v.impactR, 0);

  const sorted = useMemo(
    () => [...VIOLATIONS].sort((a, b) => a.impactR - b.impactR),
    [],
  );

  const behaviorMessage =
    behaviorScore >= 85
      ? "Controlled execution"
      : behaviorScore >= 65
        ? "Slight discipline drift"
        : "High inconsistency detected";

  return (
    <Card highlight>
      <CardEyebrow Icon={Brain}>Behavior breakdown</CardEyebrow>

      {/* PART 1 — Behavior Score */}
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
            Behavior score
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="font-display text-[44px] font-semibold leading-none tabular-nums"
              style={{
                ...metricColorStyle(behaviorScore),
                textShadow: metricGlowShadow(behaviorScore),
              }}
            >
              {behaviorScore}
            </span>
            <span className="text-[15px] text-text-secondary">/ 100</span>
          </div>
          <p className="mt-2 text-[13px] text-text-primary/85">
            {behaviorMessage}
          </p>
        </div>

        {/* PART 2 — Rule Adherence */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5">
          <div className="flex items-end justify-between">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
              Rule adherence
            </p>
            <p
              className="font-display text-[20px] font-semibold tabular-nums"
              style={metricColorStyle(adherence)}
            >
              {adherence}%
            </p>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${adherence}%`,
                backgroundColor: metricColorStyle(adherence).color,
                boxShadow: `0 0 14px ${metricColorStyle(adherence).color}55`,
              }}
            />
          </div>
          <p className="mt-3 text-[12.5px] text-text-secondary">
            You broke rules in{" "}
            <span className="font-semibold text-text-primary">6 of your last 20</span>{" "}
            trades.
          </p>
        </div>
      </div>

      <Divider />

      {/* PART 3 — Rule Violations Summary */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-[15px] w-[15px] text-rose-300" strokeWidth={2} />
            <p className="text-[13.5px] font-semibold text-text-primary">
              Rule Violations{" "}
              <span className="text-text-secondary">
                ({tf === "ALL" ? "All time" : `Last ${tf === "7D" ? "7 days" : tf === "30D" ? "30 days" : "90 days"}`})
              </span>
            </p>
          </div>
          <TimeframePicker value={tf} onChange={setTf} />
        </div>

        <p className="mt-2 text-[12.5px] text-text-secondary">
          <span className="font-semibold text-text-primary">{totalViolations} violations</span>{" "}
          — costing{" "}
          <span className="font-semibold text-rose-300 tabular-nums">
            {fmtR(totalImpact)}
          </span>
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.05]">
          <div className="grid grid-cols-[1.6fr_88px_120px_100px_36px] items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
            <span>Rule</span>
            <span className="text-right">Times</span>
            <span>Last broken</span>
            <span className="text-right">Impact</span>
            <span />
          </div>
          <ul>
            {sorted.map((v) => {
              const isOpen = openRule === v.rule;
              return (
                <li
                  key={v.rule}
                  className="border-b border-white/[0.04] last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setOpenRule(isOpen ? null : v.rule)}
                    className="grid w-full grid-cols-[1.6fr_88px_120px_100px_36px] items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors hover:bg-white/[0.025]"
                  >
                    <span className="font-medium text-text-primary">{v.rule}</span>
                    <span className="text-right tabular-nums text-text-secondary">
                      {v.times}
                    </span>
                    <span className="tabular-nums text-text-secondary">
                      {v.lastBroken}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-rose-300">
                      {fmtR(v.impactR)}
                    </span>
                    <span className="flex justify-end">
                      <ChevronRight
                        className={`h-4 w-4 text-text-secondary/70 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        strokeWidth={2}
                      />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease }}
                        className="overflow-hidden bg-white/[0.015]"
                      >
                        <div className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_1fr]">
                          <div>
                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
                              Occurrences
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {v.occurrences.map((o, i) => (
                                <li
                                  key={i}
                                  className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px]"
                                >
                                  <span className="tabular-nums text-text-secondary">
                                    {o.date}
                                  </span>
                                  <span className="tabular-nums text-text-primary">
                                    {o.result}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
                              Insight
                            </p>
                            <p className="mt-2 text-[12.5px] leading-relaxed text-text-primary/85">
                              {v.insight}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Divider />

      {/* PART 4 — Rule Violation Timeline */}
      <div>
        <div className="flex items-center gap-2">
          <Clock className="h-[15px] w-[15px] text-gold" strokeWidth={1.9} />
          <p className="text-[13.5px] font-semibold text-text-primary">
            Violation timeline
          </p>
        </div>
        <ul className="mt-3 space-y-2.5">
          {TIMELINE.map((d) => (
            <li
              key={d.date}
              className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70 tabular-nums">
                  {d.date}
                </span>
                <span className="text-[11.5px] tabular-nums text-text-secondary">
                  {d.items.length} event{d.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="mt-2 space-y-2">
                {d.items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-[12.5px]"
                  >
                    {/* Screenshot thumbnail */}
                    {it.screenshot ? (
                      <img
                        src={it.screenshot}
                        alt={`${it.asset} ${it.rule} screenshot`}
                        loading="lazy"
                        className="h-10 w-14 shrink-0 rounded-md object-cover ring-1 ring-white/[0.06]"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-white/[0.03] ring-1 ring-white/[0.06]"
                        aria-label="No screenshot"
                      >
                        <ImageIcon
                          className="h-3.5 w-3.5 text-text-secondary/50"
                          strokeWidth={1.7}
                        />
                      </div>
                    )}

                    {/* Asset + rule */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary/70 tabular-nums">
                        {it.asset}
                      </p>
                      <p className="truncate text-[12.5px] text-text-primary/90">
                        {it.rule}
                      </p>
                    </div>

                    {/* Result (R) */}
                    <span
                      className={`shrink-0 tabular-nums font-semibold ${it.impact.startsWith("missed") ? "text-amber-200" : "text-rose-300"}`}
                    >
                      {it.impact}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <Divider />

      {/* PART 5 — Execution Type */}
      <div>
        <div className="flex items-end justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
            Execution type
          </p>
          <p className="text-[12.5px] tabular-nums">
            <span className="font-semibold text-gold">{systemRatio}%</span>
            <span className="text-text-secondary"> · {100 - systemRatio}%</span>
          </p>
        </div>
        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full bg-gradient-to-r from-gold to-gold-soft"
            style={{
              width: `${systemRatio}%`,
              boxShadow: "0 0 14px rgba(198,161,91,0.3)",
            }}
          />
          <div
            className="h-full bg-rose-400/60"
            style={{ width: `${100 - systemRatio}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11.5px] text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Controlled (system)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400/70" />
            Impulsive (emotional)
          </span>
        </div>
      </div>

      <Divider />

      {/* PART 6 — Session Performance */}
      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="h-[15px] w-[15px] text-gold" strokeWidth={1.9} />
          <p className="text-[13.5px] font-semibold text-text-primary">
            Session performance
          </p>
        </div>
        <div className="mt-3 space-y-3">
          <SessionRow label="London" winRate={64} behavior="Controlled" />
          <SessionRow label="New York" winRate={51} behavior="Overtrading" />
          <SessionRow label="Asia" winRate={42} behavior="Random" />
        </div>
      </div>
    </Card>
  );
}

function TimeframePicker({
  value,
  onChange,
}: {
  value: Timeframe;
  onChange: (v: Timeframe) => void;
}) {
  const options: Timeframe[] = ["7D", "30D", "90D", "ALL"];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={[
              "rounded-md px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors",
              active
                ? "bg-gold/[0.12] text-gold"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {o === "ALL" ? "All" : o}
          </button>
        );
      })}
    </div>
  );
}

function SessionRow({
  label,
  winRate,
  behavior,
}: {
  label: string;
  winRate: number;
  behavior: "Controlled" | "Overtrading" | "Random";
}) {
  const tone =
    behavior === "Controlled"
      ? "border-gold/25 bg-gold/[0.08] text-gold"
      : behavior === "Overtrading"
        ? "border-amber-300/25 bg-amber-300/[0.08] text-amber-200"
        : "border-rose-400/25 bg-rose-400/[0.08] text-rose-200";
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="text-text-primary">{label}</span>
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${tone}`}
          >
            {behavior}
          </span>
          <span className="tabular-nums text-text-secondary">
            Win rate{" "}
            <span className="font-semibold text-gold">{winRate}%</span>
          </span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold-soft"
          style={{ width: `${winRate}%` }}
        />
      </div>
    </div>
  );
}
