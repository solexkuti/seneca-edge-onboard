import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 1 — Emotional Hook
 * Minimal. One headline. One CTA. No mockups, no features.
 * The whole point: name the real problem before promising anything.
 */
export default function Slide1Hero({ onNext }: SlideProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-12 px-2 text-center">
      {/* Tiny eyebrow — keeps the page from feeling empty */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          SenecaEdge
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
      </motion.div>

      {/* Headline — line 1, then 500ms pause, then line 2 */}
      <h1 className="text-[28px] font-bold leading-[1.2] tracking-tight text-text-primary sm:text-[30px]">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="block"
        >
          Most traders don't fail
          <br />
          because of strategy
          <span className="text-text-secondary">…</span>
        </motion.span>

        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0, ease: "easeOut" }}
          className="mt-3 inline-block text-gradient-mix"
        >
          They fail because they can't follow one.
        </motion.span>
      </h1>

      {/* CTA — appears 300ms after the second line lands */}
      <motion.button
        type="button"
        onClick={onNext}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.9, ease: "easeOut" }}
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
