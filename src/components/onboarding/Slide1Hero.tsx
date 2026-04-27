import { motion } from "framer-motion";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 1 — Pressure
 * "You don't lose because of your trading strategy.
 *  You lose because of decisions made under pressure."
 */
export default function Slide1Hero(_props: SlideProps) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-10">
      {/* Glowing pulse behind text */}
      <div className="relative flex w-full items-center justify-center">
        <motion.div
          aria-hidden
          className="absolute h-72 w-72 rounded-full bg-gradient-mix opacity-30 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute h-40 w-40 rounded-full bg-highlight-pink opacity-20 blur-3xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />

        {/* Floating particles */}
        {Array.from({ length: 10 }).map((_, i) => {
          const angle = (i / 10) * Math.PI * 2;
          const r = 110 + (i % 3) * 22;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r * 0.6;
          const colors = ["#6C5CE7", "#00C6FF", "#FF7AF5"];
          return (
            <motion.span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                background: colors[i % 3],
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                boxShadow: `0 0 5px ${colors[i % 3]}40`,
              }}
              animate={{
                y: [0, -12, 0],
                opacity: [0.3, 0.9, 0.3],
                scale: [0.6, 1.2, 0.6],
              }}
              transition={{
                duration: 3 + (i % 3),
                repeat: Infinity,
                delay: (i % 5) * 0.3,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {/* Text block */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 px-2 text-center"
        >
          <p className="text-[24px] font-bold leading-[1.25] tracking-tight text-text-primary">
            You don't lose because of your{" "}
            <span className="text-text-secondary font-semibold">
              trading strategy.
            </span>
          </p>
          <p className="mt-4 text-[24px] font-bold leading-[1.25] tracking-tight text-text-primary">
            You lose because of{" "}
            <HighlightWord delay={0.6}>decisions</HighlightWord>{" "}
            made under{" "}
            <HighlightWord delay={1.1} tone="pink">
              pressure.
            </HighlightWord>
          </p>
        </motion.div>
      </div>

      {/* Subtle pulse dot */}
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.6 }}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gradient-primary" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          The truth
        </span>
      </motion.div>
    </div>
  );
}

function HighlightWord({
  children,
  delay = 0,
  tone = "primary",
}: {
  children: React.ReactNode;
  delay?: number;
  tone?: "primary" | "pink";
}) {
  const gradient =
    tone === "pink" ? "text-gradient-mix" : "text-gradient-primary";
  return (
    <span className="relative inline-block">
      <motion.span
        aria-hidden
        className={`absolute -inset-x-1 inset-y-1 -z-10 rounded-md ${
          tone === "pink" ? "bg-highlight-pink/15" : "bg-brand/12"
        }`}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "left center" }}
      />
      <span className={`relative font-bold ${gradient}`}>{children}</span>
    </span>
  );
}
