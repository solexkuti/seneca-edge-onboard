import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Quote } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 4 — Soft Proof
 * Headline reframes the promise as a virtue (consistency = edge).
 * Three quiet trust lines + one understated testimonial card.
 * No numbers theatre, no five-star ratings, no "X traders" hype.
 */

const PROOF_LINES = [
  "Built from real trading behavior patterns",
  "Used by traders working to stay disciplined under pressure",
  "Structured around how decisions actually break down",
];

export default function SlideProof({ onNext }: SlideProps) {
  const [pressing, setPressing] = useState(false);
  const handleStep = () => {
    setPressing(true);
    window.setTimeout(() => onNext(), 350);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-7 px-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          The real edge
        </p>
        <h2 className="mt-2 text-[24px] font-bold leading-[1.25] tracking-tight text-text-primary">
          Consistency is what most
          <br />
          <span className="text-gradient-mix">traders are really chasing.</span>
        </h2>
      </motion.div>

      {/* Proof lines */}
      <div className="flex w-full flex-col gap-2">
        {PROOF_LINES.map((line, i) => (
          <motion.div
            key={line}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.2 + i * 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex items-start gap-2.5 rounded-xl bg-card/60 px-3.5 py-2.5 ring-1 ring-border/70"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-brand"
              strokeWidth={2.2}
            />
            <span className="text-[13px] leading-snug text-text-primary">
              {line}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Testimonial card */}
      <motion.figure
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.7 }}
        className="relative w-full overflow-hidden rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft"
      >
        <Quote
          className="absolute right-3 top-3 h-5 w-5 text-brand/20"
          strokeWidth={2.2}
        />
        <blockquote className="text-[14px] leading-snug text-text-primary">
          “I stopped losing on revenge trades the week I started reviewing
          every setup here. The rules don't change — I finally do.”
        </blockquote>
        <figcaption className="mt-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-mix text-[11px] font-bold text-white">
            M
          </span>
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-text-primary">
              Marco D.
            </span>
            <span className="text-[10.5px] text-text-secondary">
              Swing trader · 14 months
            </span>
          </div>
        </figcaption>
      </motion.figure>

      {/* Quiet, intentional CTA — only one button in the entire narrative flow */}
      <motion.button
        type="button"
        onClick={handleStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, scale: pressing ? 0.97 : 1 }}
        transition={{ duration: 0.5, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -1 }}
        className="group mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-6 py-3 text-[14px] font-medium text-text-primary backdrop-blur-sm transition-all hover:border-brand/40 hover:bg-card/70 hover:shadow-soft"
      >
        Step into control
        <ArrowRight
          className="h-4 w-4 text-brand transition-transform group-hover:translate-x-0.5"
          strokeWidth={2.2}
        />
      </motion.button>
    </div>
  );
}
