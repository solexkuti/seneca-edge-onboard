import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";
import ContinueButton from "./ContinueButton";

/**
 * Testimonial slide — separate from body copy.
 * Glass card with soft gold border glow. Fades in after the headline.
 */
export default function SlideTestimonial({ onNext }: SlideProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-10 px-2 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[24px] font-semibold leading-tight tracking-tight text-text-primary"
      >
        Built with traders<br />
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
        <blockquote className="font-display text-[18px] leading-[1.45] text-text-primary">
          "I stopped entering trades I couldn't explain."
        </blockquote>
        <figcaption className="mt-5 flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-gradient text-[12px] font-semibold text-[#0B0B0D]"
          >
            MD
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold text-text-primary">
              Marco D.
            </span>
            <span className="text-[11.5px] text-text-secondary">
              Swing trader • 14 months
            </span>
          </span>
        </figcaption>
      </motion.figure>

      <ContinueButton onClick={onNext} delay={0.95} />
    </div>
  );
}
