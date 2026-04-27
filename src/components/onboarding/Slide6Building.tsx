import { motion } from "framer-motion";
import { LineChart, Settings2, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ContinueButton from "./ContinueButton";
import type { SlideProps } from "./OnboardingFlow";

/**
 * Slide 3 — Feature Experience
 * Three clean cards. Icon + label + one-liner. No buttons.
 * Auto-advances. Spacing intentionally generous = premium feel.
 */

type Feature = {
  icon: LucideIcon;
  title: string;
  desc: string;
  tint: string; // text color
  bg: string; // icon bg
};

const FEATURES: Feature[] = [
  {
    icon: LineChart,
    title: "Analyze your trades",
    desc: "Drop a chart. Break it down step by step.",
    tint: "text-accent-cyan",
    bg: "bg-accent-cyan/10 ring-accent-cyan/20",
  },
  {
    icon: Settings2,
    title: "Build your system",
    desc: "Define rules you can actually follow.",
    tint: "text-brand",
    bg: "bg-brand/10 ring-brand/20",
  },
  {
    icon: ShieldCheck,
    title: "Stay in control",
    desc: "Track behavior, not just results.",
    tint: "text-accent-blue",
    bg: "bg-accent-blue/10 ring-accent-blue/20",
  },
];

export default function Slide6Building({ onNext }: SlideProps) {
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
          What you get
        </p>
        <h2 className="mt-2 text-[24px] font-bold leading-[1.2] tracking-tight text-text-primary">
          Three tools.
          <br />
          <span className="text-gradient-mix">One disciplined trader.</span>
        </h2>
      </motion.div>

      {/* Feature cards */}
      <div className="flex w-full flex-col gap-2.5">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.2 + i * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${f.bg}`}
              >
                <Icon className={`h-5 w-5 ${f.tint}`} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-text-primary">
                  {f.title}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-text-secondary">
                  {f.desc}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <ContinueButton onClick={onNext} delay={0.7} />
    </div>
  );
}
