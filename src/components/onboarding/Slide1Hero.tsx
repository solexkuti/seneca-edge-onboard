import { motion } from "framer-motion";
import PhoneFrame from "./PhoneFrame";
import type { SlideProps } from "./OnboardingFlow";
import { Sparkles, TrendingUp } from "lucide-react";

export default function Slide1Hero(_props: SlideProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative">
        <PhoneFrame className="animate-float-slow">
          <PhoneChartScreen />
        </PhoneFrame>

        {/* Floating cards */}
        <motion.div
          initial={{ opacity: 0, x: -30, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -left-6 top-12 animate-float-mid"
        >
          <FloatingTag
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="AI detected setup"
            tone="primary"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30, y: 10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -right-4 bottom-20 animate-float-slow"
        >
          <FloatingTag
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="+32% accuracy"
            tone="cyan"
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight text-text-primary">
          Trade smarter, <span className="text-gradient-primary">not harder.</span>
        </h1>
        <p className="mt-3 text-[15px] text-text-secondary">
          AI analyzes your chart in seconds.
        </p>
      </motion.div>
    </div>
  );
}

function FloatingTag({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "primary" | "cyan";
}) {
  const toneClass =
    tone === "primary"
      ? "shadow-glow-primary"
      : "shadow-glow-cyan";
  const iconBg =
    tone === "primary" ? "bg-gradient-primary" : "bg-gradient-accent";
  return (
    <div
      className={`glass-strong flex items-center gap-2 rounded-2xl px-3 py-2 ${toneClass}`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-lg text-white ${iconBg}`}
      >
        {icon}
      </span>
      <span className="text-[12px] font-semibold text-text-primary">
        {label}
      </span>
    </div>
  );
}

function PhoneChartScreen() {
  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#0F172A] via-[#1A1B3A] to-[#0F172A]">
      {/* Glow orbs */}
      <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-[#6C5CE7] opacity-40 blur-3xl" />
      <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full bg-[#00C6FF] opacity-30 blur-3xl" />

      {/* Status row */}
      <div className="absolute left-0 right-0 top-9 flex items-center justify-between px-4">
        <div className="text-[10px] font-semibold text-white/80">EUR/USD</div>
        <div className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
          +1.42%
        </div>
      </div>
      <div className="absolute left-4 top-[58px] text-[18px] font-bold text-white">
        1.0942
      </div>

      {/* Chart */}
      <svg
        className="absolute inset-x-0 top-[90px] h-[180px] w-full"
        viewBox="0 0 260 180"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ph-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A29BFE" />
            <stop offset="50%" stopColor="#6C5CE7" />
            <stop offset="100%" stopColor="#00C6FF" />
          </linearGradient>
          <linearGradient id="ph-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6C5CE7" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[40, 80, 120, 160].map((y) => (
          <line
            key={y}
            x1="0"
            x2="260"
            y1={y}
            y2={y}
            stroke="white"
            strokeOpacity="0.05"
          />
        ))}

        {/* Area */}
        <motion.path
          d="M0 130 C 30 110, 50 140, 80 120 S 130 70, 160 90 S 210 50, 260 30 L 260 180 L 0 180 Z"
          fill="url(#ph-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        />

        {/* Animated line */}
        <motion.path
          d="M0 130 C 30 110, 50 140, 80 120 S 130 70, 160 90 S 210 50, 260 30"
          fill="none"
          stroke="url(#ph-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        />

        {/* End dot */}
        <motion.circle
          cx="258"
          cy="30"
          r="5"
          fill="#00C6FF"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.4, 1] }}
          transition={{ delay: 1.6, duration: 0.5 }}
        />
        <motion.circle
          cx="258"
          cy="30"
          r="10"
          fill="#00C6FF"
          opacity="0.35"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 2, 1] }}
          transition={{ delay: 1.6, duration: 1, repeat: Infinity }}
        />
      </svg>

      {/* Bottom signal card */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/10 p-3 backdrop-blur-md ring-1 ring-white/15"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Signal
          </span>
          <span className="text-[10px] font-bold text-emerald-300">STRONG</span>
        </div>
        <div className="mt-1 text-[13px] font-semibold text-white">
          Bullish breakout
        </div>
      </motion.div>
    </div>
  );
}
