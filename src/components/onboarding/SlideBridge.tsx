import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Bridge — Problem Awareness
 * Sits between the emotional hook and the feature preview.
 * Two lines arrive in sequence (0.5s pause) so the second one lands deeper.
 */
export default function SlideBridge({ onNext }: SlideProps) {
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

      {/* Two-line reveal with a deliberate pause between them */}
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
          transition={{
            duration: 0.8,
            delay: 0.9, // first line + 0.5s breathing room
            ease: [0.22, 1, 0.36, 1],
          }}
          className="text-[22px] font-medium leading-[1.4] text-text-secondary sm:text-[24px]"
        >
          The problem is… in the moment,
          <br />
          <span className="text-gradient-mix font-semibold">
            you don't always follow what you know.
          </span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.8 }}
          className="text-[13px] text-text-secondary/80"
        >
          This is where most mistakes happen.
        </motion.p>
      </div>

      {/* CTA */}
      <motion.button
        type="button"
        onClick={onNext}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 2.2 }}
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
