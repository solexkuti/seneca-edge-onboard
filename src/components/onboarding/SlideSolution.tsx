import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Solution Intro — names the system before showing it.
 */
export default function SlideSolution({ onNext }: SlideProps) {
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
          The shift
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
      </motion.div>

      <div className="flex flex-col gap-6">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-[26px] font-bold leading-[1.2] tracking-tight text-text-primary sm:text-[28px]"
        >
          This is a system built to fix that.
        </motion.h2>

        <div className="flex flex-col gap-3 text-[16px] leading-snug text-text-secondary sm:text-[17px]">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            Not by predicting the market…
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-[18px] font-semibold text-gradient-mix sm:text-[19px]"
          >
            But by guiding your decisions.
          </motion.p>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={onNext}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 2.1 }}
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
