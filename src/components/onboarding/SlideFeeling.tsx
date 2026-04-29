import { motion } from "framer-motion";
import type { SlideProps } from "./OnboardingFlow";
import ContinueButton from "./ContinueButton";

/**
 * Slide 1 — FEELING
 * One idea. Calm presence. Premium typographic hierarchy.
 */
export default function SlideFeeling({ onNext }: SlideProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-14 px-2 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="inline-flex items-center gap-2"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-soft">
          Seneca Edge
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[34px] font-semibold leading-[1.12] tracking-[-0.01em] text-text-primary sm:text-[38px]"
      >
        It watches your discipline
        <br />
        <span className="text-gold-soft">while you trade</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
        className="text-[15px] leading-relaxed text-text-secondary"
      >
        Stay aligned when it matters most.
      </motion.p>

      <ContinueButton onClick={onNext} delay={0.7} />
    </div>
  );
}
