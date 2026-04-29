// SenecaDashboard — the live mirror of the trader's discipline.
//
// Controlled rollback: more presence, momentum, and reward — without losing
// the calm Seneca structure. Hero discipline score + streak, momentum strip,
// state cards, optional warning, primary CTA, quiet nav.

import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Flame, Sparkles, TrendingUp, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  SenecaScreen,
  SenecaHeader,
  MentorLine,
  FadeIn,
} from "@/components/seneca";
import { useSenecaContext } from "@/hooks/useSenecaContext";
import { SenecaVoice } from "@/lib/senecaVoice";
import { fetchDailyStreak, type DailyStreak } from "@/lib/dailyStreak";
import type { TraderState } from "@/lib/traderState";

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

function statusLine(t: TraderState): string {
  if (t.blocks.in_recovery) return "You're stepping back. Recovery first.";
  if (t.blocks.discipline_locked) return "You're one mistake past the line. Pause before the next move.";
  if (t.blocks.no_strategy) return "No system yet. Build your rules before you trade.";
  if (t.blocks.not_confirmed) return "Confirm today's checklist before you take a setup.";
  const breaks = t.discipline.consecutive_breaks;
  if (t.discipline.state === "at_risk") return "You're forcing entries. Slow down.";
  if (t.discipline.state === "slipping" && breaks >= 1) return "Edge is dulling. One mistake away from a block.";
  if (t.discipline.state === "slipping") return "Mostly aligned, but the last few decisions wavered.";
  if (t.discipline.state === "in_control") return "You're trading within your rules. Keep the rhythm.";
  return "Quiet for now. Watching with you.";
}

type Tone = "calm" | "watch" | "warn";

function disciplineTone(t: TraderState): Tone {
  const s = t.discipline.state;
  if (s === "at_risk" || s === "locked") return "warn";
  if (s === "slipping") return "watch";
  return "calm";
}

// ---------------------------------------------------------------------------
// Hero ring — discipline score, expressive but calm
// ---------------------------------------------------------------------------

function ScoreRing({ score, tone }: { score: number; tone: Tone }) {
  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;

  const stops =
    tone === "warn"
      ? ["var(--destructive)", "var(--highlight-pink)"]
      : tone === "watch"
        ? ["var(--brand-soft)", "var(--accent-cyan)"]
        : ["var(--brand)", "var(--accent-cyan)"];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="discGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="100%" stopColor={stops[1]} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
          opacity={0.55}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#discGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDasharray: c, strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          key={pct}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-3xl font-semibold leading-none tracking-tight"
        >
          {Math.round(pct)}
        </motion.div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Discipline
        </div>
      </div>
    </div>
  );
}

function stateLabel(t: TraderState): { label: string; sub: string } {
  switch (t.discipline.state) {
    case "in_control":
      return { label: "In control", sub: "Decisions match the plan." };
    case "slipping":
      return { label: "Slipping", sub: "A few entries drifted." };
    case "at_risk":
      return { label: "At risk", sub: "Tighten up — fast." };
    case "locked":
      return { label: "Locked", sub: "Step back. Recover first." };
  }
}

// ---------------------------------------------------------------------------
// Momentum stat tile
// ---------------------------------------------------------------------------

type Stat = {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: Tone;
};

function StatTile({ stat }: { stat: Stat }) {
  const accent =
    stat.tone === "warn"
      ? "text-destructive"
      : stat.tone === "watch"
        ? "text-foreground/80"
        : "text-foreground";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-4 shadow-[var(--shadow-soft)] backdrop-blur transition hover:shadow-[var(--shadow-card)]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: "var(--gradient-mix)" }}
        aria-hidden
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {stat.label}
        </span>
        <span className={`${accent}`}>{stat.icon}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold leading-none tracking-tight ${accent}`}>
        {stat.value}
      </div>
      <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {stat.hint}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

type Action = {
  to: "/hub/recovery" | "/hub/strategy" | "/hub/daily" | "/hub/mentor" | "/hub/chart" | "/hub/journal";
  label: string;
  hint: string;
};

function nextAction(t: TraderState): Action {
  if (t.blocks.in_recovery) return { to: "/hub/recovery", label: "Continue recovery", hint: "Finish this before anything else." };
  if (t.blocks.discipline_locked) return { to: "/hub/recovery", label: "Start recovery", hint: "Reset before your next decision." };
  if (t.blocks.no_strategy) return { to: "/hub/strategy", label: "Build your strategy", hint: "Seneca needs your rules first." };
  if (t.blocks.not_confirmed) return { to: "/hub/daily", label: "Confirm today's checklist", hint: "Lock in the plan to unlock trading." };
  if (t.discipline.state === "at_risk") return { to: "/hub/mentor", label: "Talk to Seneca", hint: "A short check before the next setup." };
  if (t.discipline.state === "slipping") return { to: "/hub/chart", label: "Check the next setup", hint: "Run it through your rules first." };
  return { to: "/hub/chart", label: "Analyze a setup", hint: "Take it one trade at a time." };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SenecaDashboard({ userName }: { userName?: string }) {
  const ctx = useSenecaContext();
  const t = ctx.trader;

  const [streak, setStreak] = useState<DailyStreak | null>(null);
  useEffect(() => {
    void fetchDailyStreak().then(setStreak);
  }, [t.session.checklist_confirmed, t.discipline.score]);

  const status = ctx.loading ? SenecaVoice.thinking : statusLine(t);
  const action = nextAction(t);
  const tone = disciplineTone(t);
  const sl = stateLabel(t);

  const cleanDecisions = ctx.recentAnalyses.filter(
    (a) => a.verdict === "valid" || a.verdict === "valid_clean",
  ).length;
  const totalDecisions = ctx.recentAnalyses.length;

  const stats: Stat[] = [
    {
      key: "streak",
      label: "Streak",
      value: streak ? `${streak.current_streak}d` : "—",
      hint: streak?.identity_label ?? "Build your first clean day.",
      icon: <Flame className="h-4 w-4" />,
      tone: (streak?.current_streak ?? 0) >= 3 ? "calm" : "watch",
    },
    {
      key: "decisions",
      label: "Recent decisions",
      value: totalDecisions ? `${cleanDecisions}/${totalDecisions}` : "0",
      hint: totalDecisions
        ? `${cleanDecisions} clean of last ${totalDecisions}`
        : "No setups checked yet today.",
      icon: <TrendingUp className="h-4 w-4" />,
      tone:
        totalDecisions === 0
          ? "watch"
          : cleanDecisions / Math.max(1, totalDecisions) >= 0.7
            ? "calm"
            : "warn",
    },
    {
      key: "session",
      label: "Session",
      value: t.session.trading_allowed ? "Active" : t.session.checklist_confirmed ? "Ready" : "Waiting",
      hint: t.session.trading_allowed
        ? "Cleared to take valid setups."
        : t.session.checklist_confirmed
          ? "Plan locked. Watch for your setup."
          : "Confirm your checklist to begin.",
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: t.session.trading_allowed ? "calm" : "watch",
    },
    {
      key: "best",
      label: "Best run",
      value: streak?.longest_streak ? `${streak.longest_streak}d` : "—",
      hint: streak?.longest_streak
        ? "Your longest disciplined stretch."
        : "Stack clean days to set a record.",
      icon: <Sparkles className="h-4 w-4" />,
      tone: "calm",
    },
  ];

  const warning =
    t.discipline.consecutive_breaks >= 2 && !t.blocks.in_recovery
      ? "Same kind of break has shown up twice in a row. Worth a pause."
      : null;

  const greeting = userName ? `${userName}, here's where you stand.` : "Here's where you stand.";

  return (
    <SenecaScreen>
      <SenecaHeader title="Today" subtitle={greeting} />

      {/* Hero — score ring + state + streak ribbon */}
      <FadeIn>
        <div
          className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-5 shadow-[var(--shadow-card)] backdrop-blur"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: "var(--gradient-bg-glow)" }}
            aria-hidden
          />
          <div className="relative flex items-center gap-5">
            <ScoreRing score={t.discipline.score} tone={tone} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    tone === "warn"
                      ? "bg-destructive"
                      : tone === "watch"
                        ? "bg-foreground/40"
                        : "bg-[color:var(--brand)]"
                  }`}
                />
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Status
                </span>
              </div>
              <div className="text-xl font-semibold leading-tight tracking-tight">
                {sl.label}
              </div>
              <div className="text-sm leading-relaxed text-muted-foreground">
                {sl.sub}
              </div>
              {streak && streak.current_streak > 0 && (
                <div className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-foreground/80">
                  <Flame className="h-3 w-3 text-[color:var(--highlight-pink)]" />
                  <span className="font-medium">{streak.current_streak}-day streak</span>
                  <span className="text-muted-foreground">· {streak.identity_label}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Mentor status sentence */}
      <AnimatePresence mode="popLayout">
        <MentorLine
          key={status}
          tone={
            t.blocks.in_recovery || t.blocks.discipline_locked || t.discipline.state === "at_risk"
              ? "block"
              : "calm"
          }
        >
          {status}
        </MentorLine>
      </AnimatePresence>

      {/* Momentum strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.key} stat={s} />
        ))}
      </div>

      {warning && (
        <FadeIn>
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-foreground/90">
            {warning}
          </div>
        </FadeIn>
      )}

      {/* Primary action */}
      <FadeIn>
        <Link
          to={action.to}
          className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-foreground px-5 py-4 text-background shadow-[var(--shadow-card)] transition hover:opacity-95"
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30"
            style={{ background: "var(--gradient-mix)" }}
            aria-hidden
          />
          <div className="relative flex flex-col">
            <span className="text-sm font-medium">{action.label}</span>
            <span className="text-xs text-background/70">{action.hint}</span>
          </div>
          <ArrowRight className="relative h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </FadeIn>

      {/* Quiet nav */}
      <FadeIn>
        <div className="flex flex-wrap gap-2 pt-1">
          <QuietLink to="/hub/mentor">Seneca</QuietLink>
          <QuietLink to="/hub/chart">Analyzer</QuietLink>
          <QuietLink to="/hub/daily">Checklist</QuietLink>
          <QuietLink to="/hub/journal">Journal</QuietLink>
          <QuietLink to="/hub/strategy">Strategy</QuietLink>
        </div>
      </FadeIn>
    </SenecaScreen>
  );
}

function QuietLink({
  to,
  children,
}: {
  to: "/hub/mentor" | "/hub/chart" | "/hub/daily" | "/hub/journal" | "/hub/strategy";
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-card/80 hover:text-foreground"
    >
      {children}
    </Link>
  );
}
