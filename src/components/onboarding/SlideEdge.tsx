import { motion } from "framer-motion";
import type { SlideProps } from "./OnboardingFlow";
import ContinueButton from "./ContinueButton";

/**
 * Slide 3 — EDGE
 * One idea. Two short lines.
 */
export default function SlideEdge({ onNext }: SlideProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-12 px-2 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[34px] font-semibold leading-[1.12] tracking-[-0.01em] text-text-primary sm:text-[38px]"
      >
        Consistency is the
        <br />
        <span className="text-gold-soft">real edge</span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="space-y-1.5"
      >
        <p className="text-[15px] leading-relaxed text-text-secondary">
          Most traders don't lose from bad strategy.
        </p>
        <p className="text-[15px] leading-relaxed text-text-primary">
          They lose from broken discipline.
        </p>
      </motion.div>

      <ContinueButton onClick={onNext} delay={0.65} />
    </div>
  );
}
