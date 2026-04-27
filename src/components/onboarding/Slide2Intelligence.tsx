import { motion } from "framer-motion";
import PhoneFrame from "./PhoneFrame";
import ContinueButton from "./ContinueButton";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 2 — Visual Experience
 * Animated phone mockup. Inside the screen we show:
 *   • Entry / Stop Loss / Take Profit
 *   • Discipline tracking active
 *   • Progress bar
 * Floating overlay text rotates calmly outside/around the phone.
 *
 * The phone itself loops a subtle breathing/float (already in PhoneFrame).
 * No tap required — auto-advances from OnboardingFlow.
 */

const FLOATERS = [
  { text: "Set your rules once", x: "-12%", y: "12%", delay: 0.6 },
  { text: "Lock your risk", x: "78%", y: "32%", delay: 0.8 },
  { text: "No impulsive entries", x: "-8%", y: "70%", delay: 1.0 },
];

export default function Slide2Intelligence({ onNext }: SlideProps) {
  return (
    <div className="relative flex w-full max-w-md flex-col items-center gap-6 px-2">
      {/* Caption above */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          How it feels
        </p>
        <h2 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-text-primary">
          It watches your discipline
          <br />
          <span className="text-gradient-mix">while you trade.</span>
        </h2>
      </motion.div>

      {/* Phone + floating overlay text */}
      <div className="relative w-full">
        {/* Floating overlay lines */}
        {FLOATERS.map((f) => (
          <motion.div
            key={f.text}
            initial={{ opacity: 0, x: 0 }}
            animate={{
              opacity: [0, 1, 1, 1],
              x: [0, 3, -3, 0],
            }}
            transition={{
              opacity: { duration: 0.6, delay: f.delay, ease: "easeOut" },
              x: {
                duration: 6,
                delay: f.delay + 0.6,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              },
            }}
            className="pointer-events-none absolute z-20 rounded-full bg-card/85 px-3 py-1.5 text-[11px] font-medium text-text-primary shadow-soft ring-1 ring-border backdrop-blur-md"
            style={{ left: f.x, top: f.y }}
          >
            {f.text}
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <PhoneFrame>
            <PhoneScreen />
          </PhoneFrame>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="text-center text-[13px] text-text-secondary"
      >
        It keeps you aligned when it matters most.
      </motion.p>

      <ContinueButton onClick={onNext} delay={0.9} />
    </div>
  );
}

/* ─────────── Inside the phone ─────────── */

function PhoneScreen() {
  return (
    <div className="flex h-full w-full flex-col gap-3 px-3 pb-3 pt-9 text-white">
      {/* App header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">
            Live trade
          </span>
        </div>
        <span className="text-[9px] font-medium text-white/50">EUR/USD</span>
      </div>

      {/* Mini chart */}
      <div className="relative h-[78px] overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/10">
        <svg viewBox="0 0 200 78" className="h-full w-full">
          <defs>
            <linearGradient id="s2-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6C5CE7" />
              <stop offset="100%" stopColor="#00C6FF" />
            </linearGradient>
            <linearGradient id="s2-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00C6FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* TP line */}
          <line
            x1="0" y1="18" x2="200" y2="18"
            stroke="#34D399" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7"
          />
          {/* SL line */}
          <line
            x1="0" y1="62" x2="200" y2="62"
            stroke="#F87171" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7"
          />
          {/* Entry line */}
          <line
            x1="0" y1="42" x2="200" y2="42"
            stroke="#94A3B8" strokeWidth="0.6" strokeDasharray="2 4" opacity="0.6"
          />
          {/* Animated price path */}
          <motion.path
            d="M0 50 L25 46 L50 48 L75 40 L100 42 L125 34 L150 36 L175 28 L200 30"
            fill="none"
            stroke="url(#s2-line)"
            strokeWidth="1.6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 2 }}
          />
          <motion.path
            d="M0 50 L25 46 L50 48 L75 40 L100 42 L125 34 L150 36 L175 28 L200 30 L200 78 L0 78 Z"
            fill="url(#s2-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0.9, 0] }}
            transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Labels */}
          <text x="3" y="14" fill="#34D399" fontSize="6" fontWeight="600">TP</text>
          <text x="3" y="40" fill="#94A3B8" fontSize="6" fontWeight="600">ENTRY</text>
          <text x="3" y="74" fill="#F87171" fontSize="6" fontWeight="600">SL</text>
        </svg>
      </div>

      {/* Levels */}
      <div className="grid grid-cols-3 gap-1.5">
        <LevelChip label="Entry" value="1.0842" tone="neutral" />
        <LevelChip label="SL" value="1.0815" tone="loss" />
        <LevelChip label="TP" value="1.0894" tone="win" />
      </div>

      {/* Discipline tracker */}
      <div className="rounded-xl bg-white/[0.05] p-2.5 ring-1 ring-white/10">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">
            Discipline
          </span>
          <motion.span
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[9px] font-semibold text-emerald-400"
          >
            ● Active
          </motion.span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: "20%" }}
            animate={{ width: ["20%", "78%", "78%", "20%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="h-full rounded-full bg-gradient-to-r from-[#6C5CE7] to-[#00C6FF]"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[8.5px] text-white/50">
          <span>Rules followed</span>
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            className="text-white/80"
          >
            6 / 7
          </motion.span>
        </div>
      </div>
    </div>
  );
}

function LevelChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "win" | "loss" | "neutral";
}) {
  const toneColor =
    tone === "win"
      ? "text-emerald-400"
      : tone === "loss"
      ? "text-rose-400"
      : "text-white/80";
  return (
    <div className="rounded-lg bg-white/[0.04] px-1.5 py-1.5 ring-1 ring-white/10">
      <div className="text-[8px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </div>
      <div className={`mt-0.5 text-[10.5px] font-bold tabular-nums ${toneColor}`}>
        {value}
      </div>
    </div>
  );
}
