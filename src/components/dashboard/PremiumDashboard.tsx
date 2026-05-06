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
import { type Ssot, type SsotTrade, type SsotViolation, formatCurrency, rToCurrency } from "@/lib/ssot";
import { MISSED_REASON_LABELS, type MissedReason } from "@/lib/trade/types";

function missedReasonLabel(reason: string | null): string {
  if (!reason) return "Missed";
  return MISSED_REASON_LABELS[reason as MissedReason] ?? reason.replace(/_/g, " ");
}
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
  const { state } = useTraderState();
  const { ssot } = useSsot();
  const score = ssot.behavior.discipline_score;
  const dsLabel = disciplineLabel(score);
  const bp = state.strategy?.blueprint ?? null;
  const winRatePct = Math.round((ssot.metrics.win_rate ?? 0) * 100);
  const recent = useMemo(() => ssot.trades.slice(0, 5), [ssot.trades]);
  const hasTrades = ssot.trades.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 py-8 md:px-8 md:py-10">
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

      <div className="mb-6">
        <SsotAlerts />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card>
          <CardEyebrow Icon={Wallet}>Account</CardEyebrow>
          {ssot.account.balance != null ? (
            <>
              <p className="mt-3 font-display text-[28px] font-semibold tracking-tight text-text-primary">
                {formatCurrency(ssot.account.balance, ssot.account.currency)}
              </p>
              <p className="mt-1 text-[12.5px] text-text-secondary">
                {ssot.account.source === "synced" ? "Synced" : "Manual"} balance · {ssot.account.currency}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 font-display text-[20px] font-semibold tracking-tight text-text-primary">
                Set your balance
              </p>
              <p className="mt-1 text-[12.5px] text-text-secondary">
                Discipline and risk math need a real balance.
              </p>
              <Link
                to="/hub/settings"
                preload="intent"
                className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold hover:text-gold-soft"
              >
                Set balance <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
              </Link>
            </>
          )}
          <Divider />
          <Row
            label="Total PnL"
            value={
              hasTrades
                ? (() => {
                    const cur = rToCurrency(ssot.metrics.total_r, ssot.account.risk_per_trade);
                    return cur != null
                      ? formatCurrency(cur, ssot.account.currency, { showSign: true })
                      : "—";
                  })()
                : "—"
            }
          />
          <Row label="Total R" value={hasTrades ? `${ssot.metrics.total_r >= 0 ? "+" : ""}${ssot.metrics.total_r.toFixed(2)}R` : "—"} />
        </Card>

        <Card highlight>
          <CardEyebrow Icon={ShieldCheck}>Discipline score</CardEyebrow>
          <div className="mt-3 flex items-end gap-2">
            <span
              className="font-display text-[44px] font-semibold leading-none tabular-nums"
              style={{
                ...metricColorStyle(score),
                textShadow: metricGlowShadow(score),
              }}
            >
              {score}
            </span>
            <span className="mb-1.5 text-[13px] text-text-secondary">/100</span>
          </div>
          <p className={`mt-1 text-[12.5px] font-medium ${metricTextClass(score)}`}>
            {dsLabel}
          </p>
          <Divider />
          <Row label="Trades logged" value={String(ssot.behavior.total_trades)} />
          <Row label="Clean trades" value={String(ssot.behavior.clean_trades)} />
          <Row label="Violations" value={String(ssot.behavior.violation_count)} />
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

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardEyebrow Icon={LineChart}>Performance snapshot</CardEyebrow>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <Stat label="Win rate" value={hasTrades ? `${winRatePct}%` : "—"} />
            <Stat label="Avg R" value={hasTrades ? ssot.metrics.avg_r.toFixed(2) : "—"} />
            <Stat
              label="Profit factor"
              value={hasTrades && Number.isFinite(ssot.metrics.profit_factor)
                ? ssot.metrics.profit_factor.toFixed(2)
                : hasTrades ? "∞" : "—"}
            />
          </div>
          <Divider />
          <div className="space-y-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
              Recent trades
            </p>
            {recent.length === 0 ? (
              <p className="text-[13px] text-text-secondary">
                No trade data yet. Metrics will appear once trades are logged.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {recent.map((t) => {
                  const r = typeof t.rr === "number" ? t.rr : null;
                  const positive = r != null && r > 0;
                  const negative = r != null && r < 0;
                  return (
                    <li key={t.id} className="flex items-center justify-between py-2.5 text-[13px]">
                      <span className="truncate text-text-primary">{t.asset || t.market || "—"}</span>
                      <span className="text-text-secondary">{t.direction === "long" ? "Buy" : "Sell"}</span>
                      <span
                        className={
                          positive ? "font-semibold text-gold"
                          : negative ? "font-semibold text-rose-300"
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
            <ActionRow to="/hub/chart" title="Chart Analyzer" subtitle="Run a trade against your rules" Icon={LineChart} />
            <ActionRow to="/hub/journal" title="Trading Journal" subtitle="Log behavior and patterns" Icon={BookOpenCheck} />
            <ActionRow to="/hub/mentor" title="AI Mentor" subtitle="Reflect with Seneca" Icon={Sparkles} />
          </div>
        </Card>
      </div>

      <div className="mt-5"><PerformanceTrendCard ssot={ssot} /></div>
      <div className="mt-5"><FullStatsPanel ssot={ssot} /></div>
      <div className="mt-5"><TradeHistoryPanel ssot={ssot} /></div>
      <div className="mt-5"><BehaviorBreakdownCard ssot={ssot} /></div>
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

// ─── 1. Performance Trend — real equity progression ────────────

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function PerformanceTrendCard({ ssot }: { ssot: Ssot }) {
  const W = 1100;
  const H = 260;
  const PAD_X = 24;
  const PAD_Y = 24;

  // Real equity curve = chronological cumulative R from executed trades only.
  const curve = useMemo(() => {
    const chrono = [...ssot.trades]
      .filter((t) => typeof t.rr === "number")
      .sort(
        (a, b) =>
          new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime(),
      );
    let cum = 0;
    return chrono.map((t) => {
      cum += t.rr ?? 0;
      return { date: t.executed_at, value: cum };
    });
  }, [ssot.trades]);

  if (curve.length < 2) {
    return (
      <Card>
        <CardEyebrow Icon={TrendingUp}>Performance trend</CardEyebrow>
        <p className="mt-4 text-[13px] text-text-secondary">
          Log at least two trades to see your equity progression.
        </p>
      </Card>
    );
  }

  const values = curve.map((d) => d.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(0.0001, max - min);

  const xFor = (i: number) =>
    PAD_X + (i / (curve.length - 1)) * (W - PAD_X * 2);
  const yFor = (v: number) => PAD_Y + (1 - (v - min) / range) * (H - PAD_Y * 2);

  const linePath = curve
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(d.value).toFixed(2)}`,
    )
    .join(" ");
  const areaPath =
    `${linePath} L ${xFor(curve.length - 1).toFixed(2)} ${(H - PAD_Y).toFixed(2)} ` +
    `L ${xFor(0).toFixed(2)} ${(H - PAD_Y).toFixed(2)} Z`;

  const end = curve[curve.length - 1].value;

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow Icon={TrendingUp}>Performance trend</CardEyebrow>
          <p className="mt-3 font-display text-[26px] font-semibold tracking-tight text-text-primary tabular-nums">
            {end >= 0 ? "+" : ""}
            {end.toFixed(2)}R
          </p>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            {curve.length} trade{curve.length === 1 ? "" : "s"} · cumulative R
          </p>
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
              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
            </linearGradient>
          </defs>
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
            stroke={end >= 0 ? "#22C55E" : "#EF4444"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={xFor(curve.length - 1)}
            cy={yFor(end)}
            r="4"
            fill={end >= 0 ? "#22C55E" : "#EF4444"}
          />
        </svg>
      </div>
    </Card>
  );
}

// ─── 2. Full Stats Panel — SSOT only ───────────────────────────

function FullStatsPanel({ ssot }: { ssot: Ssot }) {
  const m = ssot.metrics;
  const has = m.total_trades > 0;
  const cur = ssot.account.currency;
  const risk = ssot.account.risk_per_trade;
  const fmtRMoney = (rVal: number, signed = true): string => {
    const c = rToCurrency(rVal, risk);
    if (c == null) return "";
    return ` · ${formatCurrency(c, cur, { showSign: signed })}`;
  };
  const stats: { label: string; value: string; sub?: string; tone?: "ok" | "risk" }[] = [
    {
      label: "Win rate",
      value: has ? `${Math.round(m.win_rate * 100)}%` : "—",
    },
    {
      label: "Profit factor",
      value: has
        ? Number.isFinite(m.profit_factor)
          ? m.profit_factor.toFixed(2)
          : "∞"
        : "—",
    },
    {
      label: "Avg R",
      value: has ? `${m.avg_r >= 0 ? "+" : ""}${m.avg_r.toFixed(2)}R` : "—",
      sub: has ? fmtRMoney(m.avg_r) : "",
    },
    {
      label: "Max drawdown",
      value: has ? `−${m.max_drawdown_r.toFixed(2)}R` : "—",
      sub: has ? fmtRMoney(-m.max_drawdown_r, false) : "",
      tone: m.max_drawdown_r > 0 ? "risk" : undefined,
    },
    {
      label: "Expectancy",
      value: has ? `${m.expectancy_r >= 0 ? "+" : ""}${m.expectancy_r.toFixed(2)}R` : "—",
      sub: has ? fmtRMoney(m.expectancy_r) : "",
    },
    {
      label: "Total PnL",
      value: has ? `${m.total_r >= 0 ? "+" : ""}${m.total_r.toFixed(2)}R` : "—",
      sub: has ? fmtRMoney(m.total_r) : "",
      tone: m.total_r < 0 ? "risk" : undefined,
    },
  ];

  return (
    <Card>
      <CardEyebrow Icon={Activity}>Full statistics</CardEyebrow>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
              {s.label}
            </p>
            <p
              className={[
                "mt-1.5 font-display text-[22px] font-semibold tracking-tight tabular-nums",
                s.tone === "risk" ? "text-rose-300" : "text-text-primary",
              ].join(" ")}
            >
              {s.value}
            </p>
            {s.sub && (
              <p className="mt-0.5 text-[11px] text-text-secondary/80 tabular-nums">
                {s.sub.replace(/^ · /, "")}
              </p>
            )}
          </div>
        ))}
      </div>
      {!has && (
        <p className="mt-5 text-[11.5px] text-text-secondary/80">
          Metrics will populate as you log trades.
        </p>
      )}
      {has && risk == null && (
        <p className="mt-3 text-[11px] text-text-secondary/70">
          Set a risk-per-trade value in <Link to="/hub/settings" className="text-gold hover:text-gold-soft">settings</Link> to also see PnL in {cur}.
        </p>
      )}
    </Card>
  );
}

// ─── 3. Trade History — SSOT only ──────────────────────────────

function fmtR(r: number) {
  const sign = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${sign}${Math.abs(r).toFixed(2)}R`;
}

function TradeHistoryPanel({ ssot }: { ssot: Ssot }) {
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Combined: executed + missed, newest-first.
  const all = useMemo(() => {
    const merged = [...ssot.trades, ...ssot.missed];
    merged.sort(
      (a, b) =>
        new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime(),
    );
    return merged;
  }, [ssot.trades, ssot.missed]);

  const visible = expanded ? all : all.slice(0, 6);

  const stats = useMemo(() => {
    const exec = ssot.trades;
    const total = exec.length;
    const wins = exec.filter((t) => t.result === "win").length;
    const losses = exec.filter((t) => t.result === "loss").length;
    const decided = wins + losses;
    const sumR = exec.reduce(
      (a, t) => a + (typeof t.rr === "number" ? t.rr : 0),
      0,
    );
    const sampled = exec.filter((t) => typeof t.rr === "number").length;
    return {
      total,
      winRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
      avgR: sampled > 0 ? sumR / sampled : 0,
      totalR: sumR,
    };
  }, [ssot.trades]);

  if (all.length === 0) {
    return (
      <Card>
        <CardEyebrow Icon={BookOpenCheck}>Trade history</CardEyebrow>
        <p className="mt-4 text-[13px] text-text-secondary">
          No trades logged yet. Your history will appear here.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardEyebrow Icon={BookOpenCheck}>Trade history</CardEyebrow>
        <span className="text-[11.5px] text-text-secondary">
          {all.length} record{all.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.04] sm:grid-cols-4">
        <SummaryCell label="Executed" value={String(stats.total)} />
        <SummaryCell
          label="Win Rate"
          value={`${stats.winRate}%`}
          accent="gold"
        />
        <SummaryCell label="Avg R" value={stats.avgR.toFixed(2)} />
        <SummaryCell
          label="Total R"
          value={fmtR(stats.totalR)}
          accent={stats.totalR >= 0 ? "gold" : "loss"}
        />
      </div>

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
              const clean = t.rules_broken.length === 0;
              const isOpen = openId === t.id;
              const isMissed = t.trade_type === "missed";
              const r = typeof t.rr === "number" ? t.rr : null;
              const dispScore = isMissed ? null : clean ? 100 : Math.max(0, 100 - t.rules_broken.length * 10);
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
                    <span className="tabular-nums text-text-secondary">
                      {shortDate(t.executed_at)}
                    </span>
                    <span className="font-medium text-text-primary">
                      {t.asset || t.market || "—"}
                    </span>
                    <span
                      className={
                        isMissed
                          ? "text-amber-300"
                          : t.direction === "long"
                            ? "text-emerald-400"
                            : "text-rose-300"
                      }
                    >
                      {isMissed ? "Missed" : t.direction === "long" ? "Buy" : "Sell"}
                    </span>
                    <span
                      className={[
                        "font-semibold tabular-nums",
                        isMissed
                          ? "text-amber-300"
                          : r != null && r > 0
                            ? "text-emerald-400"
                            : r != null && r < 0
                              ? "text-rose-300"
                              : "text-text-secondary",
                      ].join(" ")}
                    >
                      {isMissed
                        ? t.missed_potential_r != null
                          ? `missed ${fmtR(t.missed_potential_r)}`
                          : "missed"
                        : r != null
                          ? fmtR(r)
                          : "—"}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {isMissed ? (
                        <span className="inline-flex items-center rounded-md border border-amber-300/25 bg-amber-300/[0.07] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-300">
                          {missedReasonLabel(t.missed_reason)}
                        </span>
                      ) : clean ? (
                        <span className="inline-flex items-center rounded-md border border-emerald-400/25 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-400">
                          Clean
                        </span>
                      ) : (
                        t.rules_broken.map((rule) => (
                          <span
                            key={rule}
                            className="inline-flex items-center rounded-md border border-rose-400/20 bg-rose-400/[0.07] px-1.5 py-0.5 text-[10.5px] font-medium text-rose-200"
                          >
                            {rule}
                          </span>
                        ))
                      )}
                    </span>
                    {dispScore != null ? (
                      <DisciplineBar value={dispScore} />
                    ) : (
                      <span className="text-[11px] text-text-secondary/60">—</span>
                    )}
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
                            {isMissed ? "Reason missed" : "Notes"}
                          </p>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-text-primary/90">
                            {isMissed
                              ? t.missed_reason || "No reason recorded."
                              : t.notes || "No notes."}
                          </p>
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

      {all.length > 6 && (
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
      )}
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
            ? "text-emerald-400"
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
      ? "bg-emerald-500"
      : value >= 55
        ? "bg-amber-300"
        : "bg-rose-400";
  const text =
    value >= 80
      ? "text-emerald-400"
      : value >= 55
        ? "text-amber-200"
        : "text-rose-300";
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-1 w-14 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${tone}`}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className={`text-[11.5px] font-semibold tabular-nums ${text}`}>
        {value}%
      </span>
    </span>
  );
}

// ─── 4. Behavior Breakdown — SSOT only ─────────────────────────

type ViolationRow = {
  rule: string;
  times: number;
  lastBroken: string;
  impactR: number;
  occurrences: { date: string; result: string }[];
};

type Timeframe = "7D" | "30D" | "90D" | "ALL";

function tfDays(tf: Timeframe): number | null {
  if (tf === "ALL") return null;
  return tf === "7D" ? 7 : tf === "30D" ? 30 : 90;
}

function aggregateViolations(
  violations: SsotViolation[],
  trades: SsotTrade[],
): ViolationRow[] {
  const tradeById = new Map(trades.map((t) => [t.id, t]));
  const byRule: Record<string, SsotViolation[]> = {};
  for (const v of violations) {
    (byRule[v.type] = byRule[v.type] || []).push(v);
  }
  const rows: ViolationRow[] = Object.entries(byRule).map(([rule, list]) => {
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
    const occurrences = sorted.slice(0, 8).map((v) => {
      const t = tradeById.get(v.trade_id);
      const r = t && typeof t.rr === "number" ? fmtR(t.rr) : fmtR(v.impact_r);
      return { date: shortDate(v.occurred_at), result: r };
    });
    return {
      rule,
      times: list.length,
      lastBroken: shortDate(sorted[0].occurred_at),
      impactR: list.reduce((a, v) => a + (v.impact_r ?? 0), 0),
      occurrences,
    };
  });
  rows.sort((a, b) => a.impactR - b.impactR);
  return rows;
}

function buildTimeline(
  violations: SsotViolation[],
  trades: SsotTrade[],
  missed: SsotTrade[],
): {
  date: string;
  items: { asset: string; rule: string; impact: string }[];
}[] {
  const tradeById = new Map(trades.map((t) => [t.id, t]));
  const buckets: Record<
    string,
    { asset: string; rule: string; impact: string }[]
  > = {};

  for (const v of violations) {
    const key = shortDate(v.occurred_at);
    const t = tradeById.get(v.trade_id);
    const r = t && typeof t.rr === "number" ? fmtR(t.rr) : fmtR(v.impact_r);
    (buckets[key] = buckets[key] || []).push({
      asset: (t?.asset || t?.market || "—").toString(),
      rule: v.type,
      impact: r,
    });
  }
  for (const m of missed) {
    const key = shortDate(m.executed_at);
    const r =
      m.missed_potential_r != null
        ? `missed ${fmtR(m.missed_potential_r)}`
        : "missed";
    (buckets[key] = buckets[key] || []).push({
      asset: (m.asset || m.market || "—").toString(),
      rule: m.missed_reason || "Missed setup",
      impact: r,
    });
  }
  const ordered = Object.entries(buckets).map(([date, items]) => ({
    date,
    items,
  }));
  return ordered.slice(0, 6);
}

function BehaviorBreakdownCard({ ssot }: { ssot: Ssot }) {
  const [tf, setTf] = useState<Timeframe>("30D");
  const [openRule, setOpenRule] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const days = tfDays(tf);
    if (days == null) return ssot.violations;
    const cutoff = Date.now() - days * 86400_000;
    return ssot.violations.filter(
      (v) => new Date(v.occurred_at).getTime() >= cutoff,
    );
  }, [ssot.violations, tf]);

  const filteredMissed = useMemo(() => {
    const days = tfDays(tf);
    if (days == null) return ssot.missed;
    const cutoff = Date.now() - days * 86400_000;
    return ssot.missed.filter(
      (t) => new Date(t.executed_at).getTime() >= cutoff,
    );
  }, [ssot.missed, tf]);

  const rows = useMemo(
    () => aggregateViolations(filtered, ssot.trades),
    [filtered, ssot.trades],
  );

  const timeline = useMemo(
    () => buildTimeline(filtered, ssot.trades, filteredMissed),
    [filtered, ssot.trades, filteredMissed],
  );

  const behaviorScore = ssot.behavior.discipline_score;
  const adherence = Math.round((ssot.behavior.rule_adherence ?? 0) * 100);
  const totalViolations = filtered.length;
  const totalImpact = filtered.reduce((a, v) => a + (v.impact_r ?? 0), 0);

  const has = ssot.behavior.total_trades > 0;
  const behaviorMessage = !has
    ? "No trades logged yet"
    : behaviorScore >= 85
      ? "Controlled execution"
      : behaviorScore >= 65
        ? "Slight discipline drift"
        : "High inconsistency detected";

  const exec = ssot.execution_type;

  return (
    <Card highlight>
      <CardEyebrow Icon={Brain}>Behavior breakdown</CardEyebrow>

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

        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5">
          <div className="flex items-end justify-between">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
              Rule adherence
            </p>
            <p
              className="font-display text-[20px] font-semibold tabular-nums"
              style={metricColorStyle(adherence)}
            >
              {has ? `${adherence}%` : "—"}
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
            {has ? (
              <>
                Clean in{" "}
                <span className="font-semibold text-text-primary">
                  {ssot.behavior.clean_trades} of {ssot.behavior.total_trades}
                </span>{" "}
                trades.
              </>
            ) : (
              "Adherence will appear once trades are logged."
            )}
          </p>
        </div>
      </div>

      <Divider />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="h-[15px] w-[15px] text-rose-300"
              strokeWidth={2}
            />
            <p className="text-[13.5px] font-semibold text-text-primary">
              Rule Violations{" "}
              <span className="text-text-secondary">
                (
                {tf === "ALL"
                  ? "All time"
                  : `Last ${tf === "7D" ? "7 days" : tf === "30D" ? "30 days" : "90 days"}`}
                )
              </span>
            </p>
          </div>
          <TimeframePicker value={tf} onChange={setTf} />
        </div>

        <p className="mt-2 text-[12.5px] text-text-secondary">
          <span className="font-semibold text-text-primary">
            {totalViolations} violation{totalViolations === 1 ? "" : "s"}
          </span>{" "}
          {totalViolations > 0 && (
            <>
              — costing{" "}
              <span className="font-semibold text-rose-300 tabular-nums">
                {fmtR(totalImpact)}
              </span>
            </>
          )}
        </p>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-6 text-center text-[13px] text-text-secondary">
            No rule violations in this window.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.05]">
            <div className="grid grid-cols-[1.6fr_88px_120px_100px_36px] items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
              <span>Rule</span>
              <span className="text-right">Times</span>
              <span>Last broken</span>
              <span className="text-right">Impact</span>
              <span />
            </div>
            <ul>
              {rows.map((v) => {
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
                      <span className="font-medium text-text-primary">
                        {v.rule}
                      </span>
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
                          <div className="px-4 py-4">
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <Divider />

      <div>
        <div className="flex items-center gap-2">
          <Clock className="h-[15px] w-[15px] text-gold" strokeWidth={1.9} />
          <p className="text-[13.5px] font-semibold text-text-primary">
            Violation timeline
          </p>
        </div>
        {timeline.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-text-secondary">
            No events in this window.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {timeline.map((d) => (
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
                    <li key={i} className="flex items-center gap-3 text-[12.5px]">
                      <div
                        className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-white/[0.03] ring-1 ring-white/[0.06]"
                        aria-label="No screenshot"
                      >
                        <ImageIcon
                          className="h-3.5 w-3.5 text-text-secondary/50"
                          strokeWidth={1.7}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary/70 tabular-nums">
                          {it.asset}
                        </p>
                        <p className="truncate text-[12.5px] text-text-primary/90">
                          {it.rule}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 tabular-nums font-semibold ${it.impact.startsWith("missed") ? "text-amber-300" : "text-rose-300"}`}
                      >
                        {it.impact}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Divider />

      <div>
        <div className="flex items-end justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
            Execution type
          </p>
          {exec.executed_total > 0 ? (
            <p className="text-[12.5px] tabular-nums text-text-secondary">
              <span className="font-semibold text-emerald-400">{exec.controlled_pct}%</span>
              {" · "}
              <span className="font-semibold text-amber-300">{exec.semi_controlled_pct}%</span>
              {" · "}
              <span className="font-semibold text-rose-300">{exec.impulsive_pct}%</span>
            </p>
          ) : (
            <p className="text-[12.5px] text-text-secondary">—</p>
          )}
        </div>
        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div className="h-full bg-emerald-500" style={{ width: `${exec.controlled_pct}%` }} />
          <div className="h-full bg-amber-300" style={{ width: `${exec.semi_controlled_pct}%` }} />
          <div className="h-full bg-rose-400/80" style={{ width: `${exec.impulsive_pct}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px] text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Controlled ({exec.controlled})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            Semi-controlled ({exec.semi_controlled})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400/80" />
            Impulsive ({exec.impulsive})
          </span>
        </div>
        {exec.missed > 0 && (
          <p className="mt-2 text-[11.5px] text-text-secondary">
            <span className="font-semibold text-amber-200">{exec.missed}</span> missed observation
            {exec.missed === 1 ? "" : "s"} — behavioral only, excluded from execution mix.
          </p>
        )}
      </div>

      <Divider />

      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="h-[15px] w-[15px] text-gold" strokeWidth={1.9} />
          <p className="text-[13.5px] font-semibold text-text-primary">
            Session performance
          </p>
        </div>
        <div className="mt-3 space-y-3">
          {ssot.session_performance.map((s) => (
            <SessionRow
              key={s.session}
              label={s.session === "NY" ? "New York" : s.session}
              winRatePct={Math.round(s.win_rate * 100)}
              total={s.total_trades}
              violations={s.violations}
              totalR={s.total_r}
              missed={s.missed}
            />
          ))}
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
  winRatePct,
  total,
  violations,
  totalR,
  missed,
}: {
  label: string;
  winRatePct: number;
  total: number;
  violations: number;
  totalR: number;
  missed: number;
}) {
  const behavior =
    total === 0
      ? "No data"
      : violations === 0
        ? "Controlled"
        : violations / Math.max(1, total) >= 0.4
          ? "High break"
          : "Drifting";
  const tone =
    behavior === "Controlled"
      ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-400"
      : behavior === "High break"
        ? "border-rose-400/25 bg-rose-400/[0.08] text-rose-200"
        : behavior === "Drifting"
          ? "border-amber-300/25 bg-amber-300/[0.08] text-amber-200"
          : "border-white/[0.06] bg-white/[0.02] text-text-secondary";
  const rText = `${totalR >= 0 ? "+" : ""}${totalR.toFixed(2)}R`;
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
            {total > 0 ? (
              <>
                <span className="font-semibold text-emerald-400">{winRatePct}%</span>
                <span className="mx-1 text-text-secondary/50">·</span>
                <span className={`font-semibold ${totalR >= 0 ? "text-emerald-400" : "text-rose-300"}`}>
                  {rText}
                </span>
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${total > 0 ? winRatePct : 0}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-text-secondary/80 tabular-nums">
        {total > 0 ? (
          <>
            {total} executed · {violations} violation{violations === 1 ? "" : "s"}
            {missed > 0 ? ` · ${missed} missed` : ""}
          </>
        ) : missed > 0 ? (
          `${missed} missed observation${missed === 1 ? "" : "s"}`
        ) : (
          "No data"
        )}
      </p>
    </div>
  );
}
