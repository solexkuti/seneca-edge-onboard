import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, MessageSquareQuote } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Testimonial slide — stacked card carousel.
 * Three honest, calm testimonials focused on:
 *   1. Discipline
 *   2. Overtrading
 *   3. Rule breaking
 *
 * Auto-rotates through cards. Behind the active card, the next two cards
 * peek out to suggest depth (stacked layout). Tap dots to jump.
 */
export default function SlideTestimonials(_props: SlideProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = window.setInterval(
      () => setActive((i) => (i + 1) % testimonials.length),
      2200,
    );
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex w-full flex-col items-center">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1"
      >
        <MessageSquareQuote className="h-3 w-3 text-brand" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
          From real traders
        </span>
      </motion.div>

      {/* MESSAGE */}
      <div className="mt-8 max-w-[320px] text-center">
        <h1 className="text-[22px] font-bold leading-[1.2] tracking-tight text-text-primary">
          Discipline is what changed.{" "}
          <span className="text-gradient-mix">Not the market.</span>
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] text-text-secondary">
          Honest words from traders who stopped fighting themselves.
        </p>
      </div>

      {/* STACKED CARDS */}
      <div className="relative mt-8 h-[230px] w-full max-w-[340px]">
        {testimonials.map((t, i) => {
          const offset =
            (i - active + testimonials.length) % testimonials.length;
          return (
            <TestimonialCard
              key={t.name}
              testimonial={t}
              offset={offset}
              total={testimonials.length}
            />
          );
        })}
      </div>

      {/* Dots */}
      <div className="mt-5 flex items-center gap-1.5">
        {testimonials.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Show testimonial ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active
                ? "w-5 bg-brand"
                : "w-1.5 bg-text-secondary/30 hover:bg-text-secondary/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Data ----------

type Testimonial = {
  name: string;
  role: string;
  initials: string;
  tag: "Discipline" | "Overtrading" | "Rule breaking";
  quote: string;
  tone: "violet" | "blue" | "magenta";
};

const testimonials: Testimonial[] = [
  {
    name: "Marco D.",
    role: "Futures · 3 yrs",
    initials: "MD",
    tag: "Discipline",
    tone: "violet",
    quote:
      "I didn't need a better strategy. I needed something to slow me down before I clicked. The check-in does exactly that.",
  },
  {
    name: "Aisha R.",
    role: "Forex · 5 yrs",
    initials: "AR",
    tag: "Overtrading",
    tone: "blue",
    quote:
      "I used to take 12 trades a day out of boredom. Seeing my own pattern in numbers made it impossible to keep lying to myself.",
  },
  {
    name: "Kenji T.",
    role: "Crypto · 2 yrs",
    initials: "KT",
    tag: "Rule breaking",
    tone: "magenta",
    quote:
      "I always broke my own rules. Now I have to confirm them out loud before I enter. That tiny pause changed my month.",
  },
];

// ---------- Card ----------

const TONE_MAP: Record<
  Testimonial["tone"],
  { avatar: string; tag: string; quoteIcon: string }
> = {
  violet: {
    avatar: "bg-gradient-to-br from-[#6C5CE7] to-[#8B7CF7]",
    tag: "bg-[#6C5CE7]/10 text-[#6C5CE7] ring-[#6C5CE7]/20",
    quoteIcon: "text-[#6C5CE7]/30",
  },
  blue: {
    avatar: "bg-gradient-to-br from-[#4F8BFF] to-[#00C6FF]",
    tag: "bg-[#00C6FF]/10 text-[#0092C7] ring-[#00C6FF]/20",
    quoteIcon: "text-[#00C6FF]/30",
  },
  magenta: {
    avatar: "bg-gradient-to-br from-[#FF7AF5] to-[#A29BFE]",
    tag: "bg-[#FF7AF5]/10 text-[#C026D3] ring-[#FF7AF5]/20",
    quoteIcon: "text-[#FF7AF5]/30",
  },
};

function TestimonialCard({
  testimonial,
  offset,
  total,
}: {
  testimonial: Testimonial;
  offset: number;
  total: number;
}) {
  const t = TONE_MAP[testimonial.tone];

  // Stack layout: active = 0 (front), then 1, 2 peek behind.
  // Anything beyond index 2 is hidden.
  const isActive = offset === 0;
  const visible = offset < 3;

  const y = offset * 14;
  const scale = 1 - offset * 0.05;
  const opacity = visible ? (offset === 0 ? 1 : 0.55 - offset * 0.15) : 0;
  const zIndex = total - offset;

  return (
    <motion.article
      aria-hidden={!isActive}
      initial={false}
      animate={{
        y,
        scale,
        opacity,
        zIndex,
      }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-x-0 top-0 mx-auto rounded-2xl bg-card/95 p-5 shadow-card-premium ring-1 ring-border backdrop-blur"
      style={{ zIndex }}
    >
      {/* Top row: tag */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${t.tag}`}
        >
          {testimonial.tag}
        </span>
        <Quote
          className={`h-5 w-5 ${t.quoteIcon}`}
          strokeWidth={2.2}
          aria-hidden
        />
      </div>

      {/* Quote */}
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.p
            key={testimonial.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-3 text-[14px] leading-[1.55] text-text-primary"
          >
            “{testimonial.quote}”
          </motion.p>
        )}
        {!isActive && (
          <p className="mt-3 text-[14px] leading-[1.55] text-text-primary">
            “{testimonial.quote}”
          </p>
        )}
      </AnimatePresence>

      {/* Footer: avatar + name */}
      <div className="mt-4 flex items-center gap-2.5">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white ${t.avatar}`}
          aria-hidden
        >
          {testimonial.initials}
        </div>
        <div className="leading-tight">
          <div className="text-[12.5px] font-semibold text-text-primary">
            {testimonial.name}
          </div>
          <div className="text-[10.5px] text-text-secondary">
            {testimonial.role}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
