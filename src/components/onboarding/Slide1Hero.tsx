import { motion } from "framer-motion";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 1 — Emotional Hook
 * Minimal. One headline. One CTA. No mockups, no features.
 * The whole point: name the real problem before promising anything.
 */
export default function Slide1Hero(_: SlideProps) {
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

      {/* Headline — the emotional hook */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="text-[28px] font-bold leading-[1.2] tracking-tight text-text-primary sm:text-[30px]"
      >
        Most traders don't fail
        <br />
        because of strategy
        <span className="text-text-secondary">…</span>
        <br />
        <span className="mt-2 inline-block text-gradient-mix">
          They fail because they can't follow one.
        </span>
      </motion.h1>

    </div>
  );
}
