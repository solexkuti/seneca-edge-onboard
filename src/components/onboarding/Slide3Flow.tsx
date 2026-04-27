import { motion } from "framer-motion";
import { Upload, ShieldCheck } from "lucide-react";
import PhoneFrame from "./PhoneFrame";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 3 — Pre-trade rule check
 * "Before you enter a trade… it checks your setup against your rules."
 */
export default function Slide3Flow(_props: SlideProps) {
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="relative">
        <PhoneFrame className="animate-float-slow">
          <RuleCheckScreen />
        </PhoneFrame>

        {/* Floating rule-check tag */}
        <motion.div
          initial={{ opacity: 0, x: 20, y: 10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          className="absolute -right-3 top-24 animate-float-mid"
        >
          <div className="glass-strong flex items-center gap-2 rounded-2xl px-3 py-2 shadow-glow-primary">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-primary text-white">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <span className="text-[12px] font-semibold text-text-primary">
              Rules verified
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
          Drop your chart.
        </h1>
        <p className="mt-2 text-[18px] font-semibold text-text-primary">
          Get instant insight based on{" "}
          <span className="text-gradient-primary">how YOU trade.</span>
        </p>
      </motion.div>
    </div>
  );
}

function RuleCheckScreen() {
  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#0F172A] via-[#1A1B3A] to-[#0F172A] p-4 pt-12">
      <div className="absolute -left-10 top-16 h-32 w-32 rounded-full bg-[#6C5CE7] opacity-40 blur-3xl animate-drift" />
      <div className="absolute -right-10 bottom-16 h-32 w-32 rounded-full bg-[#00C6FF] opacity-30 blur-3xl animate-drift [animation-delay:-3s]" />

      {/* Upload card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative rounded-2xl border border-dashed border-white/20 bg-white/5 p-3 backdrop-blur"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary">
            <Upload className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-white">
              Upload Chart
            </div>
            <div className="text-[9px] text-white/60">EUR/USD · M15</div>
          </div>
        </div>
      </motion.div>

      {/* Mini chart preview */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="relative mt-3 overflow-hidden rounded-2xl bg-white/5 p-2 ring-1 ring-white/10"
      >
        <svg
          viewBox="0 0 220 70"
          className="h-[70px] w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="s3-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#A29BFE" />
              <stop offset="100%" stopColor="#00C6FF" />
            </linearGradient>
            <linearGradient id="s3-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6C5CE7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d="M0 50 C 30 40, 50 55, 80 42 S 130 18, 160 28 S 200 12, 220 8 L 220 70 L 0 70 Z"
            fill="url(#s3-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          />
          <motion.path
            d="M0 50 C 30 40, 50 55, 80 42 S 130 18, 160 28 S 200 12, 220 8"
            fill="none"
            stroke="url(#s3-line)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.8, duration: 1.4, ease: "easeInOut" }}
          />
          <motion.circle
            cx="218"
            cy="8"
            r="3"
            fill="#00C6FF"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.5, 1, 1.25, 1] }}
            transition={{
              delay: 2.1,
              duration: 2.6,
              times: [0, 0.15, 0.35, 0.7, 1],
              repeat: Infinity,
              repeatDelay: 1.2,
              ease: "easeInOut",
            }}
          />
        </svg>
      </motion.div>

      {/* Analyzing card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="mt-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Analyzing…
          </span>
          <span className="text-[10px] font-bold text-white/80">
            Rule check
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 1.0, duration: 1.6, ease: "easeOut" }}
            className="h-full bg-gradient-mix"
          />
        </div>

        {/* Rule items */}
        <div className="mt-3 space-y-1.5">
          {["Risk ≤ 1%", "Trend aligned", "No FOMO entry"].map((r, i) => (
            <motion.div
              key={r}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 + i * 0.25, duration: 0.4 }}
              className="flex items-center gap-2"
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400/90">
                <svg viewBox="0 0 12 12" className="h-2 w-2">
                  <path
                    d="M2 6 L5 9 L10 3"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-[10px] font-medium text-white/85">
                {r}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
