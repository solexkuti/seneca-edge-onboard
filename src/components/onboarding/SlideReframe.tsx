import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Reframe — shifts the conversation from "strategy" to "control".
 * Two lines, calm pause between them.
 */
export default function SlideReframe({ onNext }: SlideProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-12 px-2 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          Reframe
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
      </motion.div>

      <div className="flex flex-col gap-6">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-[26px] font-semibold leading-[1.25] tracking-tight text-text-secondary sm:text-[28px]"
        >
          It's not a strategy problem.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="text-[28px] font-bold leading-[1.2] tracking-tight text-gradient-mix sm:text-[30px]"
        >
          It's a control problem.
        </motion.p>
      </div>

      <motion.button
        type="button"
        onClick={onNext}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.7 }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-soft"
      >
        Continue
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2.4}
        />
      </motion.button>
    </div>
  );
}
