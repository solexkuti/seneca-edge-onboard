import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";
import ContinueButton from "./ContinueButton";

/**
 * Testimonial slide — same glass card layout, but quotes rotate
 * (fade + slight rise) every ~2.7s until the user presses Continue.
 */

type Testimonial = {
  quote: string;
  initials: string;
  name: string;
  meta: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "I stopped entering trades I couldn't explain.",
    initials: "MD",
    name: "Marco D.",
    meta: "Swing trader • 14 months",
  },
  {
    quote: "I finally saw how often I break my own rules.",
    initials: "AR",
    name: "Aisha R.",
    meta: "Forex • 5 years",
  },
  {
    quote: "It made me slow down before entering.",
    initials: "KT",
    name: "Kenji T.",
    meta: "Crypto • 2 years",
  },
  {
    quote: "I realized my problem wasn't strategy.",
    initials: "JL",
    name: "Jonas L.",
    meta: "Indices • 3 years",
  },
];

export default function SlideTestimonial({ onNext }: SlideProps) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = window.setInterval(
      () => setI((p) => (p + 1) % TESTIMONIALS.length),
      2700,
    );
    return () => window.clearInterval(t);
  }, []);

  const t = TESTIMONIALS[i];

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-10 px-2 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[24px] font-semibold leading-tight tracking-tight text-text-primary"
      >
        Built for traders<br />
        <span className="text-gold-soft">who chose discipline</span>
      </motion.h2>

      <motion.figure
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="card-premium relative w-full rounded-3xl px-6 py-7 text-left"
        style={{
          boxShadow:
            "0 0 0 1px rgba(198,161,91,0.18), 0 0 32px -8px rgba(198,161,91,0.18), 0 18px 40px -28px rgba(0,0,0,0.7)",
        }}
      >
        <Quote
          className="absolute -top-3 left-6 h-6 w-6 text-gold/70"
          strokeWidth={1.6}
        />

        {/* Rotating content — fixed min-height keeps the card from jumping */}
        <div className="min-h-[150px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <blockquote className="font-display text-[18px] leading-[1.45] text-text-primary">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-gradient text-[12px] font-semibold text-[#0B0B0D]"
                >
                  {t.initials}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-semibold text-text-primary">
                    {t.name}
                  </span>
                  <span className="text-[11.5px] text-text-secondary">
                    {t.meta}
                  </span>
                </span>
              </figcaption>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.figure>

      <ContinueButton onClick={onNext} delay={0.95} />
    </div>
  );
}
