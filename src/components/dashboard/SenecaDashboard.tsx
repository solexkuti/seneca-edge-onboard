// SenecaDashboard — intelligence-first hub.
// Six panels: Control State, Behavior Insight, Performance Snapshot,
// Your Edge, Discipline Metrics, Quick Actions. Nothing here ever blocks
// the user — every action remains active at all times.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BookOpenCheck,
  ChevronDown,
  Compass,
  LineChart,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useDbJournal } from "@/hooks/useDbJournal";
import { useTraderState } from "@/hooks/useTraderState";
import { detectBehaviorPattern } from "@/lib/behaviorPattern";
import { computePerformance, detectEdge } from "@/lib/performanceMetrics";

const ease = [0.22, 1, 0.36, 1] as const;

function disciplineLabel(score: number): {
  label: string;
  tone: "ok" | "drift" | "warn" | "risk";
} {
  if (score >= 85) return { label: "Controlled", tone: "ok" };
  if (score >= 70) return { label: "Slight drift", tone: "drift" };
  if (score >= 50) return { label: "Undisciplined", tone: "warn" };
  return { label: "High risk", tone: "risk" };
}

const TONE_TEXT: Record<string, string> = {
  ok: "text-emerald-300",
  drift: "text-amber-300",
  warn: "text-orange-300",
  risk: "text-rose-300",
};
const TONE_DOT: Record<string, string> = {
  ok: "bg-emerald-400",
  drift: "bg-amber-400",
  warn: "bg-orange-400",
  risk: "bg-rose-400",
};

function fmtR(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}R`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

// Small count-up hook for metric numbers.
function useCountUp(target: number, ms = 600): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export default function SenecaDashboard({ userName }: { userName?: string }) {
  const { rows, entries, loading } = useDbJournal();
  const { state } = useTraderState();
  const perf = useMemo(() => computePerformance(rows), [rows]);
  const pattern = useMemo(() => detectBehaviorPattern(entries), [entries]);
  const edge = useMemo(() => detectEdge(rows), [rows]);

  const score = state.discipline.score;
  const dl = disciplineLabel(score);
  const initial = userName ? userName.slice(0, 1).toUpperCase() : "S";

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Subtle ambient depth */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 22%, transparent), transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-5 pt-8 pb-24">
        <Header userName={userName} initial={initial} dlTone={dl.tone} dlLabel={dl.label} score={score} />

        {/* 1. CONTROL STATE */}
        <Panel index={0}>
          <ControlStatePanel
            score={score}
            label={dl.label}
            tone={dl.tone}
            insight={pattern.message}
            winRate={perf.winRate}
            pnlDayR={perf.pnlDayR}
            cleanStreak={perf.cleanStreak}
            sample={perf.sample}
            loading={loading}
          />
        </Panel>

        {/* 2. BEHAVIOR INSIGHT */}
        <Panel index={1} label="Behavior insight">
          <BehaviorInsightPanel pattern={pattern.message} kind={pattern.kind} sample={rows.length} />
        </Panel>

        {/* 3. PERFORMANCE SNAPSHOT */}
        <Panel index={2} label="Performance snapshot">
          <PerformancePanel perf={perf} />
        </Panel>

        {/* 4. YOUR EDGE */}
        <Panel index={3} label="Your edge">
          <EdgePanel headline={edge.headline} detail={edge.detail} />
        </Panel>

        {/* 5. DISCIPLINE METRICS */}
        <Panel index={4} label="Discipline">
          <DisciplinePanel
            score={score}
            label={dl.label}
            tone={dl.tone}
            cleanStreak={perf.cleanStreak}
            worstStreak={perf.worstStreak}
            breakdown={state.discipline.breakdown}
          />
        </Panel>

        {/* 6. QUICK ACTIONS */}
        <Panel index={5} label="Quick actions">
          <QuickActions />
        </Panel>

        <p className="mt-12 text-center text-[10.5px] font-medium uppercase tracking-[0.24em] text-text-secondary/55">
          Seneca Edge · Trading Intelligence
        </p>
      </div>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────

function Panel({
  index,
  label,
  children,
}: {
  index: number;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease, delay: 0.05 + index * 0.05 }}
      className="mt-7"
    >
      {label && (
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
          {label}
        </p>
      )}
      {children}
    </motion.section>
  );
}

function Header({
  userName,
  initial,
  dlTone,
  dlLabel,
  score,
}: {
  userName?: string;
  initial: string;
  dlTone: string;
  dlLabel: string;
  score: number;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
          Control State
        </p>
        <h1 className="mt-2 text-[26px] font-semibold leading-[1.1] tracking-tight text-text-primary">
          {userName ? `Welcome back, ${userName}.` : "Welcome back."}
        </h1>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-card/80 px-2.5 py-1 ring-1 ring-border">
          <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[dlTone]}`} />
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${TONE_TEXT[dlTone]}`}>
            {dlLabel}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-text-secondary">
            {score}
          </span>
        </div>
      </div>
      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border shadow-soft">
        <span className="text-[13px] font-semibold text-text-primary">{initial}</span>
      </div>
    </header>
  );
}

// ── 1. Control State ─────────────────────────────────────────────────

function ControlStatePanel({
  score, label, tone, insight, winRate, pnlDayR, cleanStreak, sample, loading,
}: {
  score: number; label: string; tone: string; insight: string;
  winRate: number; pnlDayR: number; cleanStreak: number; sample: number;
  loading: boolean;
}) {
  const animScore = useCountUp(score, 700);
  return (
    <div className="ambient-glow">
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-card-premium">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Activity className="h-[18px] w-[18px] text-primary" strokeWidth={2.2} />
          </div>
          <p className="mt-1 text-[14px] leading-snug text-text-primary/90">
            {sample === 0 ? "Log your first trade to see your real-time state." : insight}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          <Metric
            label="Discipline"
            value={loading ? "…" : Math.round(animScore).toString()}
            suffix={loading ? "" : "/100"}
            sub={label}
            tone={tone}
          />
          <Metric
            label="Win rate"
            value={sample === 0 ? "—" : fmtPct(winRate)}
          />
          <Metric
            label="Today"
            value={sample === 0 ? "—" : fmtR(pnlDayR)}
            tone={pnlDayR > 0 ? "ok" : pnlDayR < 0 ? "risk" : undefined}
          />
          <Metric
            label="Streak"
            value={sample === 0 ? "—" : `${cleanStreak}`}
            sub={cleanStreak === 1 ? "clean" : "clean"}
          />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label, value, suffix, sub, tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
        {label}
      </p>
      <p
        className={`mt-1 text-[18px] font-semibold tabular-nums leading-none ${
          tone ? TONE_TEXT[tone] : "text-text-primary"
        }`}
      >
        {value}
        {suffix && <span className="text-[11px] text-text-secondary/70">{suffix}</span>}
      </p>
      {sub && (
        <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-text-secondary/60">
          {sub}
        </p>
      )}
    </div>
  );
}

// ── 2. Behavior Insight ──────────────────────────────────────────────

function BehaviorInsightPanel({
  pattern, kind, sample,
}: { pattern: string; kind: string; sample: number }) {
  const eyebrow =
    kind === "discipline" ? "Holding" :
    kind === "rule_breaking" ? "Rule drift" :
    kind === "revenge" ? "Reactive entries" :
    kind === "overtrading" ? "Overtrading" :
    kind === "empty" ? "No data yet" : "Observation";

  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
        {eyebrow}
      </p>
      <p className="mt-2 text-[15.5px] font-semibold leading-snug tracking-tight text-text-primary">
        {pattern}
      </p>
      {sample > 0 && (
        <p className="mt-2 text-[12px] text-text-secondary/80">
          Pattern derived from your last {Math.min(sample, 10)} trade
          {Math.min(sample, 10) === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}

// ── 3. Performance Snapshot ──────────────────────────────────────────

function PerformancePanel({ perf }: { perf: ReturnType<typeof computePerformance> }) {
  if (perf.sample === 0) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
        <p className="text-[13px] text-text-secondary">
          Performance metrics will appear after your first logged trade.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
      <div className="grid grid-cols-3 gap-4">
        <PerfCell label="Today" value={fmtR(perf.pnlDayR)} positive={perf.pnlDayR > 0} negative={perf.pnlDayR < 0} />
        <PerfCell label="This week" value={fmtR(perf.pnlWeekR)} positive={perf.pnlWeekR > 0} negative={perf.pnlWeekR < 0} />
        <PerfCell label="Win rate" value={fmtPct(perf.winRate)} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <PerfCell label="Profit factor" value={Number.isFinite(perf.profitFactor) ? perf.profitFactor.toFixed(2) : "∞"} />
        <PerfCell label="Avg R" value={perf.avgRR.toFixed(2)} />
        <PerfCell label="Best streak" value={`${perf.bestStreak}`} />
      </div>
    </div>
  );
}

function PerfCell({
  label, value, positive, negative,
}: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">
        {label}
      </p>
      <p
        className={`mt-1.5 text-[17px] font-semibold tabular-nums ${
          positive ? "text-profit" : negative ? "text-loss" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ── 4. Your Edge ─────────────────────────────────────────────────────

function EdgePanel({ headline, detail }: { headline: string; detail: string | null }) {
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-cyan/10 ring-1 ring-accent-cyan/20">
          <Compass className="h-[18px] w-[18px] text-accent-cyan" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug tracking-tight text-text-primary">
            {headline}
          </p>
          {detail && (
            <p className="mt-1.5 text-[12.5px] leading-snug text-text-secondary/85">
              {detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 5. Discipline Metrics (expandable) ───────────────────────────────

function DisciplinePanel({
  score, label, tone, cleanStreak, worstStreak, breakdown,
}: {
  score: number; label: string; tone: string;
  cleanStreak: number; worstStreak: number;
  breakdown: {
    decision_score: number;
    execution_score: number;
    penalties: { reason: string; impact: number }[];
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
            Score
          </p>
          <p className={`mt-1 text-[34px] font-semibold leading-none tabular-nums ${TONE_TEXT[tone]}`}>
            {score}
            <span className="text-[14px] text-text-secondary/70">/100</span>
          </p>
          <p className="mt-1 text-[12px] uppercase tracking-wider text-text-secondary/80">{label}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70">
            Streaks
          </p>
          <p className="mt-1 text-[14px] tabular-nums text-text-primary">
            {cleanStreak} <span className="text-text-secondary/70">clean</span>
            <span className="px-1.5 text-text-secondary/50">·</span>
            {worstStreak} <span className="text-text-secondary/70">break</span>
          </p>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-text-primary/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.7, ease }}
          className={`h-full rounded-full ${
            tone === "ok" ? "bg-emerald-400/80" :
            tone === "drift" ? "bg-amber-400/80" :
            tone === "warn" ? "bg-orange-400/80" :
            "bg-rose-400/80"
          }`}
        />
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-4 flex w-full items-center justify-between rounded-xl bg-text-primary/[0.04] px-3.5 py-2.5 text-[12.5px] font-semibold text-text-primary ring-1 ring-border transition hover:bg-text-primary/[0.07]"
      >
        <span>Score breakdown</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.25, ease }}
          className="overflow-hidden"
        >
          <div className="mt-3 space-y-2">
            <Row label="Decision quality" value={`${breakdown.decision_score}/100`} />
            <Row label="Execution quality" value={`${breakdown.execution_score}/100`} />
            {breakdown.penalties.length === 0 ? (
              <Row label="Penalties" value="None" />
            ) : (
              breakdown.penalties.map((p, i) => (
                <Row key={i} label={p.reason} value={`-${Math.abs(p.impact)}`} negative />
              ))
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-text-primary/[0.03] px-3 py-2 ring-1 ring-border">
      <span className="text-[12px] capitalize text-text-secondary">{label.replace(/_/g, " ")}</span>
      <span className={`text-[12.5px] font-semibold tabular-nums ${negative ? "text-loss" : "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

// ── 6. Quick Actions ─────────────────────────────────────────────────

const ACTIONS = [
  { to: "/hub/chart", label: "Analyze trade", Icon: LineChart },
  { to: "/hub/journal", label: "Log trade", Icon: BookOpenCheck },
  { to: "/hub/strategy", label: "Review system", Icon: Sparkles },
] as const;

function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {ACTIONS.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          preload="intent"
          className="group flex flex-col items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft transition-transform active:scale-[0.97] hover:ring-primary/30"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
            <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={2.2} />
          </div>
          <div className="flex w-full items-center justify-between">
            <span className="text-[12.5px] font-semibold text-text-primary">{label}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-text-secondary group-hover:text-text-primary" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// Unused but exported so tree-shake keeps icons available if a caller wants
// to render trend arrows beside metrics later.
export { TrendingUp, TrendingDown };
