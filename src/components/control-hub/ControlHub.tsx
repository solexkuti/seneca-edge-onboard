import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  ShieldCheck,
  ArrowUpRight,
  LineChart,
  BookOpenCheck,
  Activity,
  Sparkles,
  LayoutTemplate,
  Gamepad2,
  Plus,
} from "lucide-react";
import Logo from "@/components/brand/Logo";

// ─────────────────────────────────────────────────────────────
// Stoic, Mark Douglas–inspired mental signals.
// Designed to feel variable even when the source is static.
// ─────────────────────────────────────────────────────────────
const MENTAL_SIGNALS = [
  "Your edge is useless without discipline.",
  "One impulsive trade destroys ten good ones.",
  "You are not here to be right. You are here to execute.",
  "The market owes you nothing. Your process owes you everything.",
  "Anything can happen. Trade the plan, not the outcome.",
  "Patience is a position.",
];

type ToolItem = {
  key: string;
  title: string;
  subtitle: string;
  Icon: typeof LineChart;
  to: "/hub/chart" | "/hub/journal" | "/hub/state" | "/hub/mentor" | "/hub/strategy";
};

const TOOLS: ToolItem[] = [
  {
    key: "chart",
    title: "Chart Analyzer",
    subtitle: "Analyze your trade against your rules",
    Icon: LineChart,
    to: "/hub/chart",
  },
  {
    key: "journal",
    title: "Trading Journal",
    subtitle: "Track behavior and patterns",
    Icon: BookOpenCheck,
    to: "/hub/journal",
  },
  {
    key: "state",
    title: "State Check",
    subtitle: "Assess your mental condition",
    Icon: Activity,
    to: "/hub/state",
  },
  {
    key: "mentor",
    title: "AI Mentor",
    subtitle: "Guided trading reflection",
    Icon: Sparkles,
    to: "/hub/mentor",
  },
  {
    key: "strategy",
    title: "Strategy Builder",
    subtitle: "Define and refine your system",
    Icon: LayoutTemplate,
    to: "/hub/strategy",
  },
];

export default function ControlHub({ userName }: { userName?: string }) {
  // Rotating mental signal — picks a random start and rotates every 9s.
  // Random seed initialized after mount to avoid SSR hydration mismatch.
  const [signalIdx, setSignalIdx] = useState(0);
  useEffect(() => {
    setSignalIdx(Math.floor(Math.random() * MENTAL_SIGNALS.length));
    const id = setInterval(
      () => setSignalIdx((i) => (i + 1) % MENTAL_SIGNALS.length),
      9000,
    );
    return () => clearInterval(id);
  }, []);

  const initial = useMemo(
    () => (userName ? userName.slice(0, 1).toUpperCase() : "S"),
    [userName],
  );

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />

      <div className="relative z-10 mx-auto w-full max-w-[440px] px-5 pt-7 pb-16">
        {/* HEADER */}
        <Header userName={userName} initial={initial} />

        {/* MENTAL SIGNAL */}
        <div className="mt-7">
          <MentalSignalCard
            message={MENTAL_SIGNALS[signalIdx]}
            signalIdx={signalIdx}
          />
        </div>

        {/* PRIMARY ACTION */}
        <div className="mt-7">
          <CheckBeforeTradeButton />
        </div>

        {/* YOUR SYSTEM */}
        <div className="mt-10">
          <SectionLabel>Your system</SectionLabel>
          <div className="mt-3">
            <YourSystemCard />
          </div>
        </div>

        {/* TOOLS */}
        <div className="mt-10">
          <SectionLabel>Tools</SectionLabel>
          <div className="mt-3 space-y-2.5">
            {TOOLS.map((t, i) => (
              <ToolCard key={t.key} tool={t} delay={0.04 * i} />
            ))}
          </div>
        </div>

        {/* UPCOMING */}
        <div className="mt-10">
          <SectionLabel>Upcoming</SectionLabel>
          <div className="mt-3">
            <UpcomingCard />
          </div>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="mt-10">
          <SectionLabel>Recent activity</SectionLabel>
          <div className="mt-3">
            <RecentActivityCard />
          </div>
        </div>

        <p className="mt-12 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary/70">
          SenecaEdge · Control State
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Header — small logo (no container), title, subtitle, profile.
// ─────────────────────────────────────────────────────────────
function Header({ userName, initial }: { userName?: string; initial: string }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start justify-between gap-4"
    >
      <div className="min-w-0 flex-1">
        <Logo size="sm" variant="full" className="mb-4" />
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-tight text-text-primary">
          Control State
        </h1>
        <p className="mt-1.5 text-[13px] leading-snug text-text-secondary">
          You don’t trade the market. You manage yourself.
        </p>
        {userName && (
          <p className="mt-1 text-[12px] text-text-secondary/80">
            Welcome back,{" "}
            <span className="font-semibold text-text-primary">{userName}</span>.
          </p>
        )}
      </div>

      <div
        aria-label={userName ? `Profile ${userName}` : "Profile"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border shadow-soft"
      >
        <span className="text-[13px] font-semibold text-text-primary">
          {initial}
        </span>
      </div>
    </motion.header>
  );
}

// ─────────────────────────────────────────────────────────────
// Mental signal — soft purple→blue gradient, rotating stoic line.
// ─────────────────────────────────────────────────────────────
function MentalSignalCard({
  message,
  signalIdx,
}: {
  message: string;
  signalIdx: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl bg-gradient-mix p-5 shadow-glow-primary"
    >
      {/* Slow rotating conic highlight — sweeps across surface */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-1/4 opacity-40 mix-blend-soft-light"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.55) 60deg, transparent 140deg, transparent 360deg)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 22, ease: "linear", repeat: Infinity }}
      />

      {/* Slow breathing glow — top-right halo shifts opacity & scale */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl"
        animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.12, 1] }}
        transition={{ duration: 7, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Counter-breathing glow — bottom-left, opposite phase */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/15 blur-2xl"
        animate={{ opacity: [0.5, 0.25, 0.5], scale: [1.05, 0.95, 1.05] }}
        transition={{ duration: 9, ease: "easeInOut", repeat: Infinity }}
      />

      <div className="relative flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <motion.div
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
          >
            <Eye className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
          </motion.div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
            Mental signal
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={signalIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mt-1.5 text-[15.5px] font-medium leading-snug text-white"
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Primary action — Check Before Trade.
// ─────────────────────────────────────────────────────────────
function CheckBeforeTradeButton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <span className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-mix opacity-25 blur-xl" />
      <Link
        to="/hub/mind"
        preload="intent"
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-gradient-primary px-5 py-5 shadow-glow-primary transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.3} />
          </div>
          <div className="text-left">
            <p className="text-[16px] font-semibold tracking-tight text-white">
              Check Before Trade
            </p>
            <p className="text-[12.5px] text-white/80">Run discipline check</p>
          </div>
        </div>
        <ArrowUpRight className="h-5 w-5 text-white transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Your System — empty-state card with Define System action.
// UI only, no flow.
// ─────────────────────────────────────────────────────────────
const SYSTEM_FIELDS: { label: string; value: string }[] = [
  { label: "Entry", value: "—" },
  { label: "Confirmation", value: "—" },
  { label: "Risk", value: "—" },
  { label: "Grade Logic", value: "—" },
];

function YourSystemCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl bg-card px-5 py-5 ring-1 ring-border shadow-soft"
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {SYSTEM_FIELDS.map((f) => (
          <div key={f.label} className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/80">
              {f.label}
            </p>
            <p className="mt-1 text-[14px] font-medium text-text-primary/70">
              {f.value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[12.5px] leading-snug text-text-secondary">
        You haven’t defined your system yet.
      </p>

      <Link
        to="/hub/strategy"
        preload="intent"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-mix px-4 py-2 text-[12.5px] font-semibold text-white shadow-glow-primary transition-transform active:scale-[0.98]"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Define System
      </Link>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section label.
// ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80">
      <span>{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-text-secondary/20 to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tool card — uniform, clean, clickable placeholder.
// ─────────────────────────────────────────────────────────────
function ToolCard({ tool, delay }: { tool: ToolItem; delay: number }) {
  const { Icon } = tool;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.99 }}
    >
      <Link
        to={tool.to}
        preload="intent"
        className="group flex w-full items-center gap-3.5 rounded-xl bg-card px-4 py-3.5 ring-1 ring-border transition-all hover:shadow-soft"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-text-primary/80">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold tracking-tight text-text-primary">
            {tool.title}
          </h3>
          <p className="truncate text-[12px] text-text-secondary">
            {tool.subtitle}
          </p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-secondary/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-primary" />
      </Link>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Upcoming — Simulator only.
// ─────────────────────────────────────────────────────────────
function UpcomingCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3.5 rounded-xl bg-card/70 px-4 py-3.5 ring-1 ring-border opacity-80"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-text-primary/70">
        <Gamepad2 className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[14px] font-semibold tracking-tight text-text-primary/80">
          Simulator
        </h3>
        <p className="truncate text-[12px] text-text-secondary">
          Train decisions in controlled scenarios
        </p>
      </div>
      <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
        Coming soon
      </span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Recent activity — single summary card.
// ─────────────────────────────────────────────────────────────
function RecentActivityCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl bg-card px-5 py-4 ring-1 ring-border shadow-soft"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/80">
            Last trade
          </p>
          <p className="mt-1 text-[14.5px] font-semibold text-text-primary">
            EUR/USD{" "}
            <span className="text-emerald-600">+0.8R</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary/80">
            Discipline
          </p>
          <p className="mt-1 text-[14.5px] font-semibold text-text-primary">
            72%
          </p>
        </div>
      </div>
    </motion.div>
  );
}
