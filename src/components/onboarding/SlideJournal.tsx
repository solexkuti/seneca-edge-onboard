import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Check, X, AlertTriangle } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Trading Journal preview — auto-advance narrative slide.
 * Shows animated trade cards and a stats panel with counting numbers.
 * Preview only — no user interaction.
 */
export default function SlideJournal(_props: SlideProps) {
  const trades = [
    {
      pair: "EUR/USD",
      result: "Win",
      tone: "win" as const,
      Icon: Check,
      pnl: "+1.8R",
    },
    {
      pair: "BTC/USD",
      result: "Loss",
      tone: "loss" as const,
      Icon: X,
      pnl: "-1.0R",
    },
    {
      pair: "NAS100",
      result: "Rule broken",
      tone: "warn" as const,
      Icon: AlertTriangle,
      pnl: "-0.6R",
    },
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header copy first */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="text-center"
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1">
          <BookOpen className="h-3 w-3 text-brand" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            Trading Journal
          </span>
        </div>
        <h1 className="mt-3 text-[24px] font-bold leading-[1.2] tracking-tight text-text-primary">
          Track every trade.{" "}
          <span className="text-gradient-mix">See your real patterns.</span>
        </h1>
        <p className="mt-2 text-[13.5px] leading-[1.5] text-text-secondary">
          You don't improve by guessing.
          <br />
          You improve by tracking.
        </p>
      </motion.div>

      {/* Trade cards stack */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="w-full space-y-2"
      >
        {trades.map((t, i) => (
          <TradeCard key={t.pair} delay={0.65 + i * 0.35} {...t} />
        ))}
      </motion.div>

      {/* Stats panel */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.9, duration: 0.55 }}
        className="grid w-full grid-cols-3 gap-2 rounded-2xl bg-card p-3 shadow-card-premium ring-1 ring-border"
      >
        <Stat label="Win rate" value={63} suffix="%" tone="primary" delay={2.1} />
        <Stat label="Rules broken" value={4} tone="warn" delay={2.25} />
        <Stat label="Overtrades" value={2} tone="loss" delay={2.4} />
      </motion.div>
    </div>
  );
}

function TradeCard({
  pair,
  result,
  tone,
  Icon,
  pnl,
  delay,
}: {
  pair: string;
  result: string;
  tone: "win" | "loss" | "warn";
  Icon: React.ComponentType<{ className?: string }>;
  pnl: string;
  delay: number;
}) {
  const toneClasses = {
    win: {
      badge: "bg-emerald-500 text-white",
      pill: "bg-emerald-500/10 text-emerald-600",
      ring: "ring-emerald-500/20",
    },
    loss: {
      badge: "bg-rose-500 text-white",
      pill: "bg-rose-500/10 text-rose-600",
      ring: "ring-rose-500/20",
    },
    warn: {
      badge: "bg-amber-500 text-white",
      pill: "bg-amber-500/10 text-amber-600",
      ring: "ring-amber-500/20",
    },
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-center justify-between rounded-2xl bg-card px-3 py-2.5 shadow-soft ring-1 ${toneClasses.ring}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses.badge}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-text-primary">
            {pair}
          </div>
          <div className="text-[10.5px] font-medium text-text-secondary">
            {result}
          </div>
        </div>
      </div>
      <span
        className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${toneClasses.pill}`}
      >
        {pnl}
      </span>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  suffix = "",
  tone,
  delay,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: "primary" | "warn" | "loss";
  delay: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const startDelay = delay * 1000;
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start - startDelay;
      if (t < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, t / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);

  const toneClass =
    tone === "primary"
      ? "text-gradient-primary"
      : tone === "warn"
        ? "text-amber-600"
        : "text-rose-600";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-secondary/40 px-2 py-2.5 text-center">
      <div className={`text-[20px] font-bold leading-none ${toneClass}`}>
        {display}
        {suffix}
      </div>
      <div className="mt-1 text-[9.5px] font-medium uppercase tracking-wider text-text-secondary">
        {label}
      </div>
    </div>
  );
}
