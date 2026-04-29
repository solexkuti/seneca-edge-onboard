// SenecaDashboard — the live mirror of the trader's discipline.
//
// Not a stats screen. Not a tool grid. A calm status surface that answers
// one question: "Am I trading correctly right now?"
//
// Structure:
//   1. MentorLine — one short, judgment-based status sentence.
//   2. Four state blocks — Discipline, Trade State, Risk, Session.
//   3. Optional warning + a single primary action (only when relevant).
//
// All copy comes from SenecaVoice or is derived inline with the same tone.
// Tokens come from src/styles.css. No raw colors.

import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  SenecaScreen,
  SenecaHeader,
  MentorLine,
  FadeIn,
} from "@/components/seneca";
import { useSenecaContext } from "@/hooks/useSenecaContext";
import { SenecaVoice } from "@/lib/senecaVoice";
import type { TraderState } from "@/lib/traderState";

// ---------------------------------------------------------------------------
// Status derivation — pure, calm copy. One sentence per state.
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
  if (t.discipline.state === "in_control") return "You're trading within your rules.";
  return "Quiet for now. Watching with you.";
}

// ---------------------------------------------------------------------------
// Block helpers — each returns label, value, meaning, tone.
// ---------------------------------------------------------------------------

type Tone = "calm" | "watch" | "warn";

type Block = {
  key: string;
  label: string;
  value: string;
  meaning: string;
  tone: Tone;
};

function disciplineBlock(t: TraderState): Block {
  const s = t.discipline.state;
  const tone: Tone = s === "in_control" ? "calm" : s === "slipping" ? "watch" : "warn";
  const meaning =
    s === "in_control"
      ? "Decisions are matching the plan."
      : s === "slipping"
        ? "A few entries drifted from your rules."
        : s === "at_risk"
          ? "You're close to the line. Tighten up."
          : "You've stepped over the line. Recover first.";
  const value =
    s === "in_control"
      ? "Aligned"
      : s === "slipping"
        ? "Drifting"
        : s === "at_risk"
          ? "At risk"
          : "Locked";
  return { key: "discipline", label: "Discipline", value, meaning, tone };
}

function tradeStateBlock(t: TraderState): Block {
  if (t.blocks.in_recovery)
    return { key: "trade", label: "Trade state", value: "In recovery", meaning: "Trading is paused while you reset.", tone: "warn" };
  if (t.blocks.discipline_locked)
    return { key: "trade", label: "Trade state", value: "Blocked", meaning: "Discipline lock is active.", tone: "warn" };
  if (!t.session.trading_allowed)
    return { key: "trade", label: "Trade state", value: "Waiting", meaning: "Confirm your checklist to unlock trading.", tone: "watch" };
  return { key: "trade", label: "Trade state", value: "Active", meaning: "Cleared to take valid setups.", tone: "calm" };
}

function riskBlock(t: TraderState): Block {
  // Risk read is behavior-driven, not P&L-driven: consecutive breaks +
  // discipline state are the truest signals of overexposure intent.
  const breaks = t.discipline.consecutive_breaks;
  if (t.discipline.state === "locked" || breaks >= 3)
    return { key: "risk", label: "Risk", value: "Overexposed", meaning: "Recent decisions show you're pushing too hard.", tone: "warn" };
  if (t.discipline.state === "at_risk" || breaks === 2)
    return { key: "risk", label: "Risk", value: "Stretched", meaning: "Size and frequency are creeping up.", tone: "warn" };
  if (t.discipline.state === "slipping" || breaks === 1)
    return { key: "risk", label: "Risk", value: "Watch", meaning: "One slip recently. Stay measured.", tone: "watch" };
  return { key: "risk", label: "Risk", value: "Safe", meaning: "Exposure is in line with your plan.", tone: "calm" };
}

function sessionBlock(t: TraderState): Block {
  if (t.blocks.in_recovery)
    return { key: "session", label: "Session", value: "Resetting", meaning: "Use this time to step back.", tone: "watch" };
  const s = t.discipline.state;
  if (s === "at_risk" || s === "locked")
    return { key: "session", label: "Session", value: "Emotional", meaning: "Decisions feel reactive right now.", tone: "warn" };
  if (s === "slipping")
    return { key: "session", label: "Session", value: "Wavering", meaning: "Focus is in and out. Slow the next entry.", tone: "watch" };
  if (!t.session.checklist_confirmed)
    return { key: "session", label: "Session", value: "Not started", meaning: "Run the checklist to begin the day.", tone: "watch" };
  return { key: "session", label: "Session", value: "Calm", meaning: "Composed and on plan.", tone: "calm" };
}

// ---------------------------------------------------------------------------
// Visual tokens — derive from semantic colors, never raw palette.
// ---------------------------------------------------------------------------

function toneClasses(tone: Tone) {
  // Ring + dot. Background stays card so the screen reads as one calm field.
  switch (tone) {
    case "warn":
      return {
        ring: "ring-1 ring-destructive/25",
        dot: "bg-destructive/70",
        value: "text-foreground",
      };
    case "watch":
      return {
        ring: "ring-1 ring-foreground/15",
        dot: "bg-foreground/40",
        value: "text-foreground",
      };
    default:
      return {
        ring: "ring-1 ring-foreground/10",
        dot: "bg-foreground/20",
        value: "text-foreground",
      };
  }
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function StateCard({ block }: { block: Block }) {
  const t = toneClasses(block.tone);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl bg-card/60 p-4 backdrop-blur ${t.ring}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {block.label}
        </div>
        <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden />
      </div>
      <div className={`mt-2 text-lg font-medium leading-tight ${t.value}`}>
        {block.value}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {block.meaning}
      </div>
    </motion.div>
  );
}

type Action = {
  to: "/hub/recovery" | "/hub/strategy" | "/hub/daily" | "/hub/mentor" | "/hub/chart" | "/hub/journal";
  label: string;
  hint: string;
};

function nextAction(t: TraderState): Action {
  if (t.blocks.in_recovery) return { to: "/hub/recovery", label: "Continue recovery", hint: "Finish this before anything else." };
  if (t.blocks.discipline_locked) return { to: "/hub/recovery", label: "Start recovery", hint: "Reset before your next decision." };
  if (t.blocks.no_strategy) return { to: "/hub/strategy", label: "Build your strategy", hint: "Seneca needs your rules first." };
  if (t.blocks.not_confirmed) return { to: "/hub/daily", label: "Confirm checklist", hint: "Lock in today's plan." };
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

  const status = ctx.loading ? SenecaVoice.thinking : statusLine(t);
  const blocks: Block[] = [
    disciplineBlock(t),
    tradeStateBlock(t),
    riskBlock(t),
    sessionBlock(t),
  ];
  const action = nextAction(t);

  // Subtle warning surfaces only when the trader needs to know something
  // they might miss otherwise. Otherwise — silence.
  const warning =
    t.discipline.consecutive_breaks >= 2 && !t.blocks.in_recovery
      ? "Same kind of break has shown up twice in a row. Worth a pause."
      : null;

  const greeting = userName ? `${userName}, here's where you stand.` : "Here's where you stand.";

  return (
    <SenecaScreen>
      <SenecaHeader title="Today" subtitle={greeting} />

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

      <div className="grid grid-cols-2 gap-3">
        {blocks.map((b) => (
          <StateCard key={b.key} block={b} />
        ))}
      </div>

      {warning && (
        <FadeIn>
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-foreground/90">
            {warning}
          </div>
        </FadeIn>
      )}

      <FadeIn>
        <Link
          to={action.to}
          className="group flex items-center justify-between gap-3 rounded-2xl bg-foreground px-5 py-4 text-background shadow-sm transition hover:opacity-95"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">{action.label}</span>
            <span className="text-xs text-background/70">{action.hint}</span>
          </div>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </FadeIn>

      {/* Quiet nav. Not the focus — just a way out to the modules. */}
      <FadeIn>
        <div className="flex flex-wrap gap-2 pt-2">
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
      className="rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-card/70 hover:text-foreground"
    >
      {children}
    </Link>
  );
}
