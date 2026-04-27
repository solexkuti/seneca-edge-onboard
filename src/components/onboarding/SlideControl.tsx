import { motion } from "framer-motion";
import { Power } from "lucide-react";
import PhoneFrame from "./PhoneFrame";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 5 — Control moment
 * "Most traders lose control after entry. This is where the system takes over."
 *
 * Animation: chaotic chart settles into a stable trajectory + "System Active"
 * indicator turns on.
 */
export default function SlideControl(_props: SlideProps) {
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="relative">
        <PhoneFrame className="animate-float-slow">
          <ControlScreen />
        </PhoneFrame>

        {/* Calm glow halo */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[44px] bg-gradient-mix opacity-0 blur-3xl"
          animate={{ opacity: [0, 0.45, 0.3] }}
          transition={{ delay: 1.6, duration: 1.4, ease: "easeOut" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-[20px] font-bold leading-[1.3] tracking-tight text-text-primary">
          Most traders lose control after entry.
        </h1>
        <p className="mt-2 text-[18px] font-semibold">
          This is where the{" "}
          <span className="text-gradient-mix">system takes over.</span>
        </p>
      </motion.div>
    </div>
  );
}

function ControlScreen() {
  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#0F172A] via-[#1A1B3A] to-[#0F172A] p-3 pt-11">
      <div className="absolute -left-10 top-20 h-32 w-32 rounded-full bg-[#FF7AF5] opacity-25 blur-3xl animate-drift" />
      <motion.div
        className="absolute -right-10 bottom-16 h-40 w-40 rounded-full bg-[#00C6FF] opacity-0 blur-3xl"
        animate={{ opacity: [0, 0.5] }}
        transition={{ delay: 1.6, duration: 1.2, ease: "easeOut" }}
      />

      {/* Status header */}
      <div className="relative flex items-center justify-between px-1">
        <div>
          <div className="text-[10px] font-bold text-white">EUR/USD</div>
          <div className="text-[9px] text-white/60">Live</div>
        </div>
        {/* System Active indicator */}
        <SystemIndicator />
      </div>

      {/* Chart: chaotic → stable */}
      <svg
        viewBox="0 0 220 110"
        className="mt-2 h-[110px] w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="s5-chaos" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF7AF5" />
            <stop offset="100%" stopColor="#FF7AF5" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="s5-calm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A29BFE" />
            <stop offset="100%" stopColor="#00C6FF" />
          </linearGradient>
        </defs>

        {/* Chaotic line — fast, then fades */}
        <motion.path
          d="M0 60 L 12 30 L 22 80 L 34 25 L 44 78 L 58 40 L 70 92 L 84 28 L 98 70 L 112 35 L 126 88 L 140 50 L 154 28 L 168 75 L 182 40 L 196 70 L 220 55"
          fill="none"
          stroke="url(#s5-chaos)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{
            duration: 1.6,
            times: [0, 0.6, 1],
            ease: "easeInOut",
          }}
        />

        {/* Stable line — emerges */}
        <motion.path
          d="M0 70 C 30 60, 60 55, 90 48 S 150 32, 180 26 S 210 18, 220 14"
          fill="none"
          stroke="url(#s5-calm)"
          strokeWidth="2.2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1.4, duration: 1.2, ease: "easeOut" }}
        />

        {/* Locked end dot */}
        <motion.circle
          cx="218"
          cy="14"
          r="3.5"
          fill="#00C6FF"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.6, 1] }}
          transition={{ delay: 2.4, duration: 0.5 }}
        />
        <motion.circle
          cx="218"
          cy="14"
          r="9"
          fill="#00C6FF"
          opacity="0.35"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 2, 1] }}
          transition={{
            delay: 2.4,
            duration: 1,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      </svg>

      {/* Bottom panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.5 }}
        className="mt-2 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/60">
            Volatility
          </span>
          <span className="text-[9px] font-bold text-emerald-300">
            Stabilized
          </span>
        </div>
        <div className="mt-1.5 flex items-end gap-1">
          {[14, 28, 22, 36, 20, 12, 10, 8, 8, 8].map((h, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-sm"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 2 + i * 0.04, duration: 0.4 }}
              style={{
                height: `${h}px`,
                background:
                  i < 5
                    ? "linear-gradient(180deg, #FF7AF5, #6C5CE7)"
                    : "linear-gradient(180deg, #00C6FF, #6C5CE7)",
                transformOrigin: "bottom",
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function SystemIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-1 ring-1 ring-emerald-300/40"
    >
      <motion.span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400"
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(52, 211, 153, 0.4)",
            "0 0 0 5px rgba(52, 211, 153, 0)",
          ],
        }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <Power className="h-2 w-2 text-[#0F172A]" strokeWidth={3} />
      </motion.span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">
        System Active
      </span>
    </motion.div>
  );
}
