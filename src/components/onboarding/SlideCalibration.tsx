import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Calibration screen — appears after the 4 questions, before name input.
 * Dynamic feel: lines fade in sequentially, soft pulsing gold ambient glow,
 * minimal loading bar. Auto-advances after ~2.6s.
 */
const LINES = [
  "Analyzing your responses",
  "Mapping decision patterns",
  "Structuring your rules",
];

export default function SlideCalibration({ onNext }: SlideProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    LINES.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => setStep(i + 1), 500 + i * 600),
      );
    });
    timers.push(window.setTimeout(onNext, 2600));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [onNext]);

  return (
    <div className="relative flex w-full max-w-md flex-col items-center gap-10 px-2 text-center">
      {/* Soft pulsing gold ambient glow behind everything */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0.5, scale: 0.95 }}
        animate={{ opacity: [0.5, 0.85, 0.5], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(198,161,91,0.18),transparent_65%)] blur-2xl"
      />

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.01em] text-text-primary sm:text-[32px]"
      >
        Calibrating your{" "}
        <span className="text-gold-soft">system…</span>
      </motion.h1>

      <ul className="relative flex flex-col gap-3">
        {LINES.map((line, i) => (
          <motion.li
            key={line}
            initial={{ opacity: 0, y: 6 }}
            animate={
              step > i
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 6 }
            }
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center gap-2.5 text-[14px] text-text-secondary"
          >
            <span
              aria-hidden
              className="h-1 w-1 rounded-full bg-gold shadow-[0_0_8px_rgba(198,161,91,0.7)]"
            />
            {line}
          </motion.li>
        ))}
      </ul>

      {/* Minimal loading bar — gold sliver tracking across */}
      <div className="relative mt-2 h-[2px] w-40 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <motion.span
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-y-0 w-1/2 rounded-full bg-gold-gradient shadow-[0_0_10px_rgba(198,161,91,0.5)]"
        />
      </div>
    </div>
  );
}
