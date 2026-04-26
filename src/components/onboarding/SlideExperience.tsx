import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sprout, TrendingUp, Trophy, Crown } from "lucide-react";
import SelectionCard from "./SelectionCard";
import type { SlideProps } from "./OnboardingFlow";

const levels = [
  { id: "new", label: "New · Less than 1 year", icon: <Sprout className="h-5 w-5" /> },
  { id: "growing", label: "Growing · 1–3 years", icon: <TrendingUp className="h-5 w-5" /> },
  { id: "experienced", label: "Experienced · 3–5 years", icon: <Trophy className="h-5 w-5" /> },
  { id: "pro", label: "Pro · 5+ years", icon: <Crown className="h-5 w-5" /> },
];

export default function SlideExperience({ onNext }: SlideProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            Step 2 of 4
          </span>
        </div>
        <h1 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-text-primary">
          How long have you{" "}
          <span className="text-gradient-primary">been trading?</span>
        </h1>
      </motion.div>

      <div className="space-y-2.5">
        {levels.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
          >
            <SelectionCard
              icon={m.icon}
              label={m.label}
              selected={selected === m.id}
              onClick={() => {
                setSelected(m.id);
                window.setTimeout(onNext, 380);
              }}
            />
          </motion.div>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={!selected}
        onClick={onNext}
        animate={{ opacity: selected ? 1 : 0.4 }}
        className="group relative mt-2 w-full overflow-hidden rounded-2xl bg-gradient-primary px-6 py-4 shadow-glow-primary disabled:cursor-not-allowed"
      >
        <span className="relative flex items-center justify-center gap-2 text-[16px] font-semibold text-white">
          Continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </motion.button>
    </div>
  );
}
