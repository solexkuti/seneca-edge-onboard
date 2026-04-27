import { motion } from "framer-motion";
import { Lock, Target, TrendingUp } from "lucide-react";
import PhoneFrame from "./PhoneFrame";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 4 — Discipline tracking during the trade
 * "During the trade… it monitors your discipline."
 */
export default function Slide6Building(_props: SlideProps) {
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="relative">
        <PhoneFrame className="animate-float-slow">
          <DisciplineScreen />
        </PhoneFrame>

        {/* Floating discipline tag */}
        <motion.div
          initial={{ opacity: 0, x: -20, y: 10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="absolute -left-2 top-28 animate-float-mid"
        >
          <div className="glass-strong flex items-center gap-2 rounded-2xl px-3 py-2 shadow-glow-pink">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-highlight-pink opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-highlight-pink" />
            </span>
            <span className="text-[11px] font-semibold text-text-primary">
              Discipline tracking active
            </span>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-[22px] font-bold leading-[1.25] tracking-tight text-text-primary">
          During the trade…
        </h1>
        <p className="mt-2 text-[18px] font-semibold">
          it monitors your{" "}
          <span className="text-gradient-mix">discipline.</span>
        </p>
      </motion.div>
    </div>
  );
}

function DisciplineScreen() {
  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#0F172A] via-[#1A1B3A] to-[#0F172A] p-3 pt-11">
      <div className="absolute -left-10 top-20 h-32 w-32 rounded-full bg-[#6C5CE7] opacity-40 blur-3xl animate-drift" />
      <div className="absolute -right-10 bottom-20 h-32 w-32 rounded-full bg-[#FF7AF5] opacity-25 blur-3xl animate-drift [animation-delay:-2s]" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-1">
        <div>
          <div className="text-[10px] font-bold text-white">EUR/USD</div>
          <div className="text-[9px] text-white/60">Live trade</div>
        </div>
        <div className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
          +0.42%
        </div>
      </div>

      {/* Mini chart */}
      <svg
        viewBox="0 0 220 70"
        className="mt-2 h-[70px] w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="s4-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A29BFE" />
            <stop offset="100%" stopColor="#00C6FF" />
          </linearGradient>
        </defs>
        <motion.path
          d="M0 45 C 30 30, 60 50, 90 35 S 150 18, 180 22 S 210 14, 220 18"
          fill="none"
          stroke="url(#s4-line)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
        <motion.circle
          cx="218"
          cy="18"
          r="3"
          fill="#00C6FF"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.5, 1, 1.25, 1] }}
          transition={{
            delay: 1.4,
            duration: 2.6,
            times: [0, 0.15, 0.35, 0.7, 1],
            repeat: Infinity,
            repeatDelay: 1.2,
            ease: "easeInOut",
          }}
        />
      </svg>

      {/* Trade levels */}
      <div className="mt-3 space-y-1.5">
        <LevelRow
          icon={<Target className="h-3 w-3" />}
          label="Entry"
          value="1.0942"
          tone="primary"
          delay={0.4}
        />
        <LevelRow
          icon={<Lock className="h-3 w-3" />}
          label="Stop Loss"
          value="1.0908"
          tone="pink"
          locked
          delay={0.7}
        />
        <LevelRow
          icon={<TrendingUp className="h-3 w-3" />}
          label="Take Profit"
          value="1.1024"
          tone="cyan"
          delay={1.0}
        />
      </div>

      {/* Discipline meter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="mt-3 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/60">
            Discipline
          </span>
          <span className="text-[9px] font-bold text-emerald-300">98%</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "98%" }}
            transition={{ delay: 1.4, duration: 1.2, ease: "easeOut" }}
            className="h-full bg-gradient-mix"
          />
        </div>
      </motion.div>
    </div>
  );
}

function LevelRow({
  icon,
  label,
  value,
  tone,
  locked,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "cyan" | "pink";
  locked?: boolean;
  delay: number;
}) {
  const iconBg =
    tone === "primary"
      ? "bg-gradient-primary"
      : tone === "cyan"
        ? "bg-gradient-accent"
        : "bg-gradient-flash";
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.45 }}
      className="flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10"
    >
      <div className="flex items-center gap-2">
        <motion.span
          initial={locked ? { rotate: -25, scale: 0.8 } : {}}
          animate={locked ? { rotate: 0, scale: 1 } : {}}
          transition={{
            delay: delay + 0.4,
            type: "spring",
            stiffness: 240,
          }}
          className={`flex h-6 w-6 items-center justify-center rounded-lg text-white ${iconBg}`}
        >
          {icon}
        </motion.span>
        <span className="text-[10px] font-semibold text-white/85">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-white">{value}</span>
        {locked && (
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.6 }}
            className="rounded-md bg-highlight-pink/20 px-1 py-0.5 text-[8px] font-bold text-highlight-pink"
          >
            LOCKED
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}
