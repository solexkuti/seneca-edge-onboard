import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Target, Shield, LogOut, Brain } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Strategy Builder preview — auto-advance narrative slide.
 * Floating modular rule cards animate in one by one with connecting lines.
 * Headline cross-fades to a second message after ~2.5s.
 * Preview only — no user interaction.
 */
export default function SlideStrategy(_props: SlideProps) {
  const [phase, setPhase] = useState<0 | 1>(0);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase(1), 2500);
    return () => window.clearTimeout(t);
  }, []);

  const rules = [
    { key: "entry", label: "Entry Rule", value: "Break + retest", Icon: Target, tone: "violet" as const },
    { key: "risk", label: "Risk Rule", value: "1% per trade", Icon: Shield, tone: "blue" as const },
    { key: "exit", label: "Exit Rule", value: "2R or invalidation", Icon: LogOut, tone: "cyan" as const },
    { key: "behavior", label: "Behavior Rule", value: "No revenge trades", Icon: Brain, tone: "magenta" as const },
  ];

  return (
    <div className="flex w-full flex-col items-center">
      {/* 1. HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1"
      >
        <Layers className="h-3 w-3 text-brand" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
          Strategy Builder
        </span>
      </motion.div>

      {/* 2. MESSAGE — focus area, breathes, never overlapped */}
      <div className="relative mt-8 w-full px-2">
        <div className="relative mx-auto min-h-[120px] max-w-[320px] text-center">
          <motion.div
            key="phase-0"
            initial={false}
            animate={{
              opacity: phase === 0 ? 1 : 0,
              y: phase === 0 ? 0 : -10,
            }}
            transition={{ duration: 0.55 }}
            className="absolute inset-0"
            style={{ pointerEvents: phase === 0 ? "auto" : "none" }}
          >
            <h1 className="text-[22px] font-bold leading-[1.2] tracking-tight text-text-primary">
              Most traders don't have a strategy.
              <br />
              <span className="text-gradient-mix">They have habits.</span>
            </h1>
            <p className="mt-2 text-[13px] leading-[1.5] text-text-secondary">
              You think you're following a system…
              <br />
              but nothing is clearly defined.
            </p>
          </motion.div>

          <motion.div
            key="phase-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: phase === 1 ? 1 : 0,
              y: phase === 1 ? 0 : 10,
            }}
            transition={{ duration: 0.55 }}
            className="absolute inset-0"
            style={{ pointerEvents: phase === 1 ? "auto" : "none" }}
          >
            <h1 className="text-[22px] font-bold leading-[1.2] tracking-tight text-text-primary">
              Build your strategy.{" "}
              <span className="text-gradient-mix">Lock your rules.</span>
            </h1>
            <p className="mt-2 text-[13px] leading-[1.5] text-text-secondary">
              Define your entry, risk, and exit.
            </p>
          </motion.div>
        </div>
      </div>

      {/* 3. CARDS — clean grid below text, nothing floats over message */}
      <div className="mt-6 w-full">
        <RuleSystem rules={rules} />
      </div>

      {/* Final line */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.4, duration: 0.6 }}
        className="mt-5 text-center text-[12.5px] leading-[1.55] text-text-secondary"
      >
        No more guessing what to do next.
        <br />
        <span className="font-semibold text-text-primary">
          Your system decides before you act.
        </span>
      </motion.p>
    </div>
  );
}

type Tone = "violet" | "blue" | "cyan" | "magenta";

const TONE_MAP: Record<
  Tone,
  { badge: string; ring: string; dot: string }
> = {
  violet: {
    badge: "bg-gradient-to-br from-[#6C5CE7] to-[#8B7CF7] text-white",
    ring: "ring-[#6C5CE7]/25",
    dot: "#6C5CE7",
  },
  blue: {
    badge: "bg-gradient-to-br from-[#4F8BFF] to-[#00C6FF] text-white",
    ring: "ring-[#4F8BFF]/25",
    dot: "#4F8BFF",
  },
  cyan: {
    badge: "bg-gradient-to-br from-[#00C6FF] to-[#22D3EE] text-white",
    ring: "ring-[#00C6FF]/25",
    dot: "#00C6FF",
  },
  magenta: {
    badge: "bg-gradient-to-br from-[#FF7AF5] to-[#A29BFE] text-white",
    ring: "ring-[#FF7AF5]/25",
    dot: "#FF7AF5",
  },
};

function RuleSystem({
  rules,
}: {
  rules: {
    key: string;
    label: string;
    value: string;
    Icon: React.ComponentType<{ className?: string }>;
    tone: Tone;
  }[];
}) {
  // Each card animates in one after another; lines draw in sync.
  const cardDelay = (i: number) => 0.4 + i * 0.45;
  const finalGlowDelay = 0.4 + rules.length * 0.45;

  return (
    <div className="relative w-full">
      {/* Background gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 50%, rgba(108,92,231,0.18), rgba(0,198,255,0.12) 55%, transparent 75%)",
        }}
      />

      {/* Final completion glow pulse */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0.25] }}
        transition={{ delay: finalGlowDelay, duration: 1.4, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(60% 50% at 50% 50%, rgba(0,198,255,0.35), transparent 70%)",
        }}
      />

      {/* Grid + connection lines (lines are scoped to grid, never overlap text) */}
      <div className="relative">
        <svg
          viewBox="0 0 320 220"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="strat-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#00C6FF" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          <motion.line
            x1="115" y1="55" x2="205" y2="55"
            stroke="url(#strat-line)" strokeWidth="1.4" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: cardDelay(1) - 0.1, duration: 0.45 }}
          />
          <motion.line
            x1="65" y1="80" x2="65" y2="140"
            stroke="url(#strat-line)" strokeWidth="1.4" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: cardDelay(2) - 0.1, duration: 0.45 }}
          />
          <motion.line
            x1="255" y1="80" x2="255" y2="140"
            stroke="url(#strat-line)" strokeWidth="1.4" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: cardDelay(3) - 0.1, duration: 0.45 }}
          />
          <motion.line
            x1="115" y1="165" x2="205" y2="165"
            stroke="url(#strat-line)" strokeWidth="1.4" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: cardDelay(3) + 0.1, duration: 0.45 }}
          />
        </svg>

        {/* 2x2 modular grid */}
        <div className="relative grid grid-cols-2 gap-3 p-2">
          {rules.map((r, i) => (
            <RuleCard
              key={r.key}
              label={r.label}
              value={r.value}
              Icon={r.Icon}
              tone={r.tone}
              delay={cardDelay(i)}
            />
          ))}
        </div>
      </div>

      {/* "System Locked" pill appears after all rules connect */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: finalGlowDelay + 0.2, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1.5 shadow-card-premium ring-1 ring-border"
      >
        <motion.span
          className="h-2 w-2 rounded-full bg-emerald-400"
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(52,211,153,0.35)",
              "0 0 0 5px rgba(52,211,153,0)",
            ],
          }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-primary">
          System Locked
        </span>
      </motion.div>
    </div>
  );
}

function RuleCard({
  label,
  value,
  Icon,
  tone,
  delay,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  delay: number;
}) {
  const t = TONE_MAP[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex flex-col gap-1.5 rounded-2xl bg-card p-3 shadow-soft ring-1 ${t.ring}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.badge}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </span>
      </div>
      <div className="text-[13px] font-bold leading-tight text-text-primary">
        {value}
      </div>

      {/* Connection node dot */}
      <motion.span
        className="absolute -right-1 -top-1 h-2 w-2 rounded-full"
        style={{ background: t.dot, boxShadow: `0 1px 3px rgba(30,41,59,0.12)` }}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.4, 1] }}
        transition={{ delay: delay + 0.2, duration: 0.45 }}
      />
    </motion.div>
  );
}
