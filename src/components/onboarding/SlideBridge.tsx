import { motion } from "framer-motion";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Bridge — Problem Awareness
 * Three lines, each separated by a calm 0.5s pause, then a quiet subtext.
 */
export default function SlideBridge(_: SlideProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-12 px-2 text-center">
      {/* Tiny eyebrow */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          The real problem
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
      </motion.div>

      {/* Three-line reveal */}
      <div className="flex flex-col gap-5">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-[24px] font-semibold leading-[1.3] tracking-tight text-text-primary sm:text-[26px]"
        >
          You already know how to trade.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="text-[22px] font-medium leading-[1.4] text-text-secondary sm:text-[24px]"
        >
          But in the moment…
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-[22px] font-semibold leading-[1.4] text-gradient-mix sm:text-[24px]"
        >
          You don't always follow what you know.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2.5 }}
          className="text-[13px] text-text-secondary/80"
        >
          That's where most losses come from.
        </motion.p>
      </div>

    </div>
  );
}
