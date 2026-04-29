import { useState } from "react";
import { motion } from "framer-motion";
import type { SlideProps } from "./OnboardingFlow";
import ContinueButton from "./ContinueButton";

const BULLETS = [
  "Upload your chart. Get real feedback.",
  "Build your rules. Trade with structure.",
  "Talk to your AI mentor. Think before you act.",
];

/**
 * Slide 2 — SYSTEM
 * On Continue: bullets fade out top→bottom, then advance.
 */
export default function SlideSystem({ onNext }: SlideProps) {
  const [exiting, setExiting] = useState(false);

  const handleContinue = () => {
    if (exiting) return;
    setExiting(true);
    // last bullet fades around 80ms*2 + 280ms ≈ 440ms
    window.setTimeout(onNext, 520);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-12 px-2 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[32px] font-semibold leading-[1.15] tracking-[-0.01em] text-text-primary sm:text-[36px]"
      >
        A system for
        <br />
        <span className="text-gold-soft">disciplined trading</span>
      </motion.h1>

      <ul className="flex w-full flex-col gap-3.5">
        {BULLETS.map((b, i) => (
          <motion.li
            key={b}
            initial={{ opacity: 0, y: 12 }}
            animate={
              exiting
                ? { opacity: 0, y: -6 }
                : { opacity: 1, y: 0 }
            }
            transition={{
              duration: exiting ? 0.28 : 0.55,
              delay: exiting ? i * 0.08 : 0.25 + i * 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="card-premium flex items-center gap-3 rounded-2xl px-5 py-3.5 text-left"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold shadow-glow-gold"
            />
            <span className="text-[14.5px] font-medium text-text-primary">
              {b}
            </span>
          </motion.li>
        ))}
      </ul>

      <ContinueButton onClick={handleContinue} delay={0.85} />
    </div>
  );
}
