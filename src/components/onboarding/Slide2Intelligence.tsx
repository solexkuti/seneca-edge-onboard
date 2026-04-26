import { motion } from "framer-motion";
import { Lock, Target, TrendingUp } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

export default function Slide2Intelligence(_props: SlideProps) {
  return (
    <div className="flex flex-col items-center gap-10">
      <div className="relative h-[340px] w-full">
        {/* Connection lines */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 360 340"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="conn" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00C6FF" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <motion.path
            d="M80 70 Q 180 130 280 70"
            stroke="url(#conn)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 6"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.6, duration: 1 }}
          />
          <motion.path
            d="M80 70 Q 180 230 280 270"
            stroke="url(#conn)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 6"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.9, duration: 1 }}
          />
        </svg>

        {/* Entry card - top left, glows */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-2 top-4"
        >
          <SignalCard
            icon={<Target className="h-5 w-5" />}
            label="Entry"
            value="1.0942"
            tone="primary"
            pulsing
          />
        </motion.div>

        {/* Stop loss - top right, locks in */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-2 top-4"
        >
          <SignalCard
            icon={
              <motion.div
                initial={{ rotate: -25, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 1.1, type: "spring", stiffness: 220 }}
              >
                <Lock className="h-5 w-5" />
              </motion.div>
            }
            label="Stop Loss"
            value="1.0908"
            tone="pink"
            locked
          />
        </motion.div>

        {/* Take profit - bottom right, expands */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: [0.85, 1.06, 1], y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="absolute right-3 bottom-2"
        >
          <SignalCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Take Profit"
            value="1.1024"
            tone="cyan"
            big
          />
        </motion.div>

        {/* Center node */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="absolute left-1/2 top-[140px] -translate-x-1/2"
        >
          <div className="relative">
            <div className="absolute inset-0 animate-pulse-glow rounded-full bg-gradient-mix opacity-60 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-mix shadow-glow-primary">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card">
                <span className="text-gradient-mix text-[18px] font-bold">AI</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight text-text-primary">
          We don't guess.{" "}
          <span className="text-gradient-mix">We calculate.</span>
        </h1>
        <p className="mt-3 text-[15px] text-text-secondary">
          Your edge, built into every trade.
        </p>
      </motion.div>
    </div>
  );
}

function SignalCard({
  icon,
  label,
  value,
  tone,
  pulsing,
  locked,
  big,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "cyan" | "pink";
  pulsing?: boolean;
  locked?: boolean;
  big?: boolean;
}) {
  const glow =
    tone === "primary"
      ? "shadow-glow-primary"
      : tone === "cyan"
        ? "shadow-glow-cyan"
        : "shadow-glow-pink";
  const iconBg =
    tone === "primary"
      ? "bg-gradient-primary"
      : tone === "cyan"
        ? "bg-gradient-accent"
        : "bg-gradient-flash";
  return (
    <div
      className={`glass-strong relative rounded-2xl p-3 ${glow} ${big ? "scale-[1.05]" : ""}`}
    >
      {pulsing && (
        <span className="pointer-events-none absolute inset-0 animate-pulse-glow rounded-2xl bg-brand/15" />
      )}
      <div className="relative flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${iconBg}`}
        >
          {icon}
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            {label}
          </div>
          <div className="text-[15px] font-bold leading-tight text-text-primary">
            {value}
          </div>
        </div>
      </div>
      {locked && (
        <div className="mt-2 flex items-center gap-1">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-text-secondary/15">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="h-full bg-gradient-flash"
            />
          </div>
          <span className="text-[9px] font-bold text-highlight-pink">
            LOCKED
          </span>
        </div>
      )}
    </div>
  );
}
