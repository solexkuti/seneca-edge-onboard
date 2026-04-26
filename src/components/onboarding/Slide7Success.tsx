import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

export default function Slide7Success({ onNext }: SlideProps) {
  return (
    <div className="flex flex-col items-center gap-10">
      {/* Logo with particles */}
      <div className="relative flex h-[280px] w-full items-center justify-center">
        {/* Outer glow */}
        <motion.div
          className="absolute h-56 w-56 rounded-full bg-gradient-mix opacity-40 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Orbiting rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute h-48 w-48 rounded-full border border-dashed border-brand/30"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute h-64 w-64 rounded-full border border-dashed border-accent-cyan/25"
        />

        {/* Particles */}
        {Array.from({ length: 18 }).map((_, i) => {
          const angle = (i / 18) * Math.PI * 2;
          const r = 90 + (i % 3) * 18;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          const colors = ["#6C5CE7", "#00C6FF", "#FF7AF5"];
          return (
            <motion.span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                background: colors[i % 3],
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                boxShadow: `0 0 12px ${colors[i % 3]}`,
              }}
              animate={{
                scale: [0.5, 1.4, 0.5],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 2 + (i % 4) * 0.4,
                repeat: Infinity,
                delay: (i % 6) * 0.2,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="relative"
        >
          <div className="relative h-28 w-28 rounded-[34px] bg-gradient-mix p-[2px] shadow-glow-primary">
            <div className="flex h-full w-full items-center justify-center rounded-[32px] bg-card">
              <svg viewBox="0 0 48 48" className="h-14 w-14">
                <defs>
                  <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6C5CE7" />
                    <stop offset="100%" stopColor="#00C6FF" />
                  </linearGradient>
                </defs>
                <path
                  d="M6 32 L18 20 L26 28 L42 12"
                  fill="none"
                  stroke="url(#logo-g)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="42" cy="12" r="3.5" fill="#00C6FF" />
              </svg>
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
          You're in.
        </h1>
        <h2 className="mt-1 text-[24px] font-bold leading-[1.1] tracking-tight">
          <span className="text-gradient-mix">Let's trade smarter.</span>
        </h2>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        onClick={onNext}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-primary px-6 py-4 shadow-glow-primary"
      >
        <span className="absolute inset-0 bg-gradient-flash opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="relative flex items-center justify-center gap-2 text-[16px] font-semibold text-white">
          Start Trading
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </motion.button>
    </div>
  );
}
