// PremiumDashboard — desktop-first dashboard for /hub.
// Read-only: pulls metrics from existing hooks. No engine or DB changes.

import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  LineChart,
  BookOpenCheck,
  Sparkles,
  ShieldCheck,
  Wallet,
  Target,
} from "lucide-react";
import { useMemo } from "react";
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
