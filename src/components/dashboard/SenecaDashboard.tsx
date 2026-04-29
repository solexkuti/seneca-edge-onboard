// SenecaDashboard — intelligence-first hub.
// Hierarchy:
//   Primary    → Control State + Behavior Insight
//   Secondary  → Discipline metrics + Your System
//   Tertiary   → Tools (quick actions)
// Calm, serious, low-decoration. No blocking — every action stays open.

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
  Pencil,
  Plus,
  Sparkles,
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
const TONE_BAR: Record<string, string> = {
  ok: "bg-emerald-400/70",
  drift: "bg-amber-400/70",
  warn: "bg-orange-400/70",
  risk: "bg-rose-400/70",
};

function fmtR(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}R`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function useCountUp(target: number, ms = 600): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// Compress a long rule into a single sharp clause.
function shortLine(input: string | null | undefined, max = 64): string | null {
  if (!input) return null;
  const s = input.replace(/[\r\n]+/g, " ").trim();
  if (!s) return null;
  const first = s.split(/(?<=[.;:])\s|\s—\s/)[0] ?? s;
  return first.length > max ? first.slice(0, max - 1) + "…" : first;
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
  const bp = state.strategy?.blueprint ?? null;

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Single very subtle ambient layer — no top radial halo. */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-60" />

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-5 pt-8 pb-24">
        <Header userName={userName} initial={initial} />

        {/* ── PRIMARY ─────────────────────────────────────────── */}
        <Section delay={0.05} className="mt-8">
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
        </Section>

        <Section delay={0.1} label="Behavior insight" className="mt-10">
          <BehaviorInsightPanel
            pattern={pattern.message}
            kind={pattern.kind}
            sample={rows.length}
          />
        </Section>

        {/* ── SECONDARY ───────────────────────────────────────── */}
        <Section delay={0.15} label="Behavior intelligence" className="mt-12">
          <IntelligencePanel
            score={score}
            label={dl.label}
            tone={dl.tone}
            cleanStreak={perf.cleanStreak}
            worstStreak={perf.worstStreak}
            breakdown={state.discipline.breakdown}
            perf={perf}
            edge={edge}
          />
        </Section>

        <Section delay={0.2} label="Your system" className="mt-12">
          <SystemPanel
            name={bp?.name ?? null}
            locked={!!bp?.locked}
            entry={shortLine(bp?.rules?.entry?.[0] ?? bp?.raw_input ?? null)}
            confirmation={shortLine(
              bp?.rules?.confirmation?.[0] ?? bp?.rules?.entry?.[1] ?? null,
            )}
            risk={shortLine(bp?.rules?.risk?.[0] ?? null)}
            grade={shortLine(
              bp?.tier_rules?.a_plus ?? bp?.tier_rules?.b_plus ?? null,
            )}
            hasStrategy={!!bp}
            loading={state.loading}
          />
        </Section>

        {/* ── TERTIARY ────────────────────────────────────────── */}
        <Section delay={0.25} label="Tools" className="mt-12">
          <QuickActions />
        </Section>

        <p className="mt-14 text-center text-[10.5px] font-medium uppercase tracking-[0.24em] text-text-secondary/45">
          Seneca Edge · Trading Intelligence
        </p>
      </div>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────

function Section({
  delay,
  label,
  children,
  className,
}: {
  delay: number;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease, delay }}
      className={className}
    >
      {label && (
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-secondary/60">
          {label}
        </p>
      )}
      {children}
    </motion.section>
  );
}

function Header({ userName, initial }: { userName?: string; initial: string }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-text-secondary/55">
          Seneca Edge
        </p>
        <h1 className="mt-2 text-[22px] font-semibold leading-[1.15] tracking-tight text-text-primary">
          {userName ? `Welcome back, ${userName}.` : "Welcome back."}
        </h1>
      </div>
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border">
        <span className="text-[12.5px] font-semibold text-text-primary">
          {initial}
        </span>
      </div>
    </header>
  );
}

// ── PRIMARY · 1. Control State ───────────────────────────────────────

function ControlStatePanel({
  score, label, tone, insight, winRate, pnlDayR, cleanStreak, sample, loading,
}: {
  score: number; label: string; tone: string; insight: string;
  winRate: number; pnlDayR: number; cleanStreak: number; sample: number;
  loading: boolean;
}) {
  const animScore = useCountUp(score, 700);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card ring-1 ring-border ring-accent-primary">
      {/* Top accent line — thin, intentional */}
      <div
        aria-hidden
        className={`absolute inset-x-0 top-0 h-px ${
          tone === "ok"
            ? "bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent"
            : tone === "drift"
            ? "bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"
            : tone === "warn"
            ? "bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"
            : "bg-gradient-to-r from-transparent via-rose-400/50 to-transparent"
        }`}
      />

      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-text-secondary/60">
            Control state
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-background/60 px-2.5 py-1 ring-1 ring-border">
            <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
            <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${TONE_TEXT[tone]}`}>
              {label}
            </span>
          </div>
        </div>

        {/* Anchor metric — discipline */}
        <div className="mt-5 flex items-end gap-3">
          <span className={`text-[56px] font-semibold leading-none tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>
            {loading ? "—" : Math.round(animScore)}
          </span>
          <span className="mb-2 text-[14px] font-medium text-text-secondary/70 tabular-nums">
            /100
          </span>
          <span className="mb-2 ml-auto text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/55">
            Discipline
          </span>
        </div>

        {/* Insight line — spoken plainly, no icon decoration */}
        <p className="mt-5 text-[13.5px] leading-snug text-text-primary/85">
          {sample === 0
            ? "Log your first trade to see your real-time state."
            : insight}
        </p>
      </div>

      {/* Inline micro-metrics — separated with a thin divider */}
      <div className="grid grid-cols-3 border-t border-border/80">
        <MicroMetric label="Win rate" value={sample === 0 ? "—" : fmtPct(winRate)} />
        <MicroMetric
          label="Today"
          value={sample === 0 ? "—" : fmtR(pnlDayR)}
          tone={pnlDayR > 0 ? "ok" : pnlDayR < 0 ? "risk" : undefined}
          divider
        />
        <MicroMetric
          label="Clean streak"
          value={sample === 0 ? "—" : `${cleanStreak}`}
          divider
        />
      </div>
    </div>
  );
}

function MicroMetric({
  label, value, tone, divider,
}: {
  label: string;
  value: string;
  tone?: string;
  divider?: boolean;
}) {
  return (
    <div className={`px-5 py-3.5 ${divider ? "border-l border-border/80" : ""}`}>
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/55">
        {label}
      </p>
      <p
        className={`mt-1 text-[15px] font-semibold tabular-nums leading-none ${
          tone ? TONE_TEXT[tone] : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ── PRIMARY · 2. Behavior Insight ────────────────────────────────────

function BehaviorInsightPanel({
  pattern, kind, sample,
}: { pattern: string; kind: string; sample: number }) {
  const tag =
    kind === "discipline" ? "Holding" :
    kind === "rule_breaking" ? "Rule drift" :
    kind === "revenge" ? "Reactive entries" :
    kind === "overtrading" ? "Overtrading" :
    kind === "empty" ? "No data yet" : "Observation";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-border">
      <div
        aria-hidden
        className="absolute left-0 top-5 bottom-5 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent"
      />
      <div className="pl-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/90 ring-1 ring-primary/20">
            {tag}
          </span>
          {sample > 0 && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-secondary/55 tabular-nums">
              n = {Math.min(sample, 10)}
            </span>
          )}
        </div>
        <p className="mt-3 text-[16px] font-semibold leading-snug tracking-tight text-text-primary">
          {pattern}
        </p>
      </div>
    </div>
  );
}

// ── SECONDARY · Behavior Intelligence (consolidated) ─────────────────

function IntelligencePanel({
  score, label, tone, cleanStreak, worstStreak, breakdown, perf, edge,
}: {
  score: number; label: string; tone: string;
  cleanStreak: number; worstStreak: number;
  breakdown: {
    decision_score: number;
    execution_score: number;
    penalties: { reason: string; impact: number }[];
  };
  perf: ReturnType<typeof computePerformance>;
  edge: ReturnType<typeof detectEdge>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border">
      {/* Discipline header row */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
              Discipline
            </p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className={`text-[26px] font-semibold leading-none tabular-nums ${TONE_TEXT[tone]}`}>
                {score}
              </span>
              <span className="text-[12px] text-text-secondary/60 tabular-nums">/100</span>
              <span className="ml-2 text-[11px] uppercase tracking-wider text-text-secondary/70">
                {label}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
              Streaks
            </p>
            <p className="mt-1.5 text-[12.5px] tabular-nums text-text-primary">
              {cleanStreak}
              <span className="ml-1 text-text-secondary/60">clean</span>
              <span className="px-1.5 text-text-secondary/35">·</span>
              {worstStreak}
              <span className="ml-1 text-text-secondary/60">break</span>
            </p>
          </div>
        </div>

        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-text-primary/[0.05]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.7, ease }}
            className={`h-full rounded-full ${TONE_BAR[tone]}`}
          />
        </div>
      </div>

      {/* Performance — diagnostic strip */}
      {perf.sample > 0 ? (
        <div className="grid grid-cols-3 border-t border-border/80">
          <DiagCell label="Today" value={fmtR(perf.pnlDayR)} pos={perf.pnlDayR > 0} neg={perf.pnlDayR < 0} />
          <DiagCell label="Week" value={fmtR(perf.pnlWeekR)} pos={perf.pnlWeekR > 0} neg={perf.pnlWeekR < 0} divider />
          <DiagCell label="Win rate" value={fmtPct(perf.winRate)} divider />
          <DiagCell
            label="Profit factor"
            value={Number.isFinite(perf.profitFactor) ? perf.profitFactor.toFixed(2) : "∞"}
          />
          <DiagCell label="Avg R" value={perf.avgRR.toFixed(2)} divider />
          <DiagCell label="Best streak" value={`${perf.bestStreak}`} divider />
        </div>
      ) : (
        <div className="border-t border-border/80 px-5 py-4 text-[12.5px] text-text-secondary/80">
          Performance metrics will appear after your first logged trade.
        </div>
      )}

      {/* Edge — narrative read */}
      <div className="border-t border-border/80 px-5 py-4">
        <div className="flex items-start gap-3">
          <Compass className="mt-0.5 h-4 w-4 shrink-0 text-accent-cyan" strokeWidth={2.2} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
              Your edge
            </p>
            <p className="mt-1 text-[13.5px] font-medium leading-snug text-text-primary">
              {edge.headline}
            </p>
            {edge.detail && (
              <p className="mt-1 text-[12px] leading-snug text-text-secondary/80">
                {edge.detail}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Score breakdown — collapsible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-t border-border/80 px-5 py-3 text-[11.5px] font-semibold text-text-secondary transition hover:text-text-primary"
      >
        <span className="uppercase tracking-[0.18em]">Score breakdown</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.25, ease }}
          className="overflow-hidden"
        >
          <div className="space-y-2 px-5 pb-5">
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

function DiagCell({
  label, value, pos, neg, divider,
}: { label: string; value: string; pos?: boolean; neg?: boolean; divider?: boolean }) {
  return (
    <div className={`px-5 py-3.5 ${divider ? "border-l border-border/80" : ""}`}>
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/55">
        {label}
      </p>
      <p
        className={`mt-1 text-[14px] font-semibold tabular-nums leading-none ${
          pos ? "text-profit" : neg ? "text-loss" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-text-primary/[0.025] px-3 py-2 ring-1 ring-border/70">
      <span className="text-[11.5px] capitalize text-text-secondary">
        {label.replace(/_/g, " ")}
      </span>
      <span
        className={`text-[12px] font-semibold tabular-nums ${
          negative ? "text-loss" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ── SECONDARY · Your System ──────────────────────────────────────────

function SystemPanel({
  name, locked, entry, confirmation, risk, grade, hasStrategy, loading,
}: {
  name: string | null;
  locked: boolean;
  entry: string | null;
  confirmation: string | null;
  risk: string | null;
  grade: string | null;
  hasStrategy: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <div className="h-3 w-24 rounded-full bg-text-secondary/10" />
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-2 w-16 rounded-full bg-text-secondary/10" />
              <div className="h-3 w-28 rounded-full bg-text-secondary/[0.08]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasStrategy) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <p className="text-[13px] leading-snug text-text-secondary">
          You haven't defined your system yet. Build it once — every other
          tool will run against it.
        </p>
        <Link
          to="/hub/strategy"
          preload="intent"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3.5 py-2 text-[12px] font-semibold text-text-primary ring-1 ring-primary/30 transition-transform active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Define system
        </Link>
      </div>
    );
  }

  const fields = [
    { label: "Entry", value: entry },
    { label: "Confirmation", value: confirmation },
    { label: "Risk", value: risk },
    { label: "Grade", value: grade },
  ].filter((f) => f.value);

  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
            {locked ? "Locked system" : "Active system"}
          </p>
          <p className="mt-1 truncate text-[14px] font-semibold tracking-tight text-text-primary">
            {name || "Untitled strategy"}
          </p>
        </div>
        <Link
          to="/hub/strategy"
          preload="intent"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background/60 px-3 py-1.5 text-[11px] font-semibold text-text-primary ring-1 ring-border transition-colors hover:bg-text-primary/[0.04]"
        >
          <Pencil className="h-3 w-3" strokeWidth={2.4} />
          Edit system
        </Link>
      </div>

      {fields.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
          {fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary/55">
                {f.label}
              </p>
              <p
                className="mt-1.5 truncate text-[13px] font-medium leading-snug text-text-primary"
                title={f.value ?? undefined}
              >
                {f.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] leading-snug text-text-secondary">
          Your system exists but doesn't have rules yet. Open it to fill in the
          essentials.
        </p>
      )}
    </div>
  );
}

// ── TERTIARY · Tools ─────────────────────────────────────────────────

const ACTIONS = [
  { to: "/hub/chart", label: "Analyze trade", Icon: LineChart },
  { to: "/hub/journal", label: "Log trade", Icon: BookOpenCheck },
  { to: "/hub/strategy", label: "Review system", Icon: Sparkles },
] as const;

function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACTIONS.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          preload="intent"
          className="group flex flex-col items-start gap-3 rounded-xl bg-card p-3.5 ring-1 ring-border transition-all active:scale-[0.97] hover:ring-primary/25"
        >
          <Icon className="h-4 w-4 text-text-secondary group-hover:text-primary" strokeWidth={2.2} />
          <div className="flex w-full items-center justify-between">
            <span className="text-[11.5px] font-semibold text-text-primary">
              {label}
            </span>
            <ArrowUpRight className="h-3 w-3 text-text-secondary/70 group-hover:text-text-primary" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// Re-export for callers that want activity icon
export { Activity };
