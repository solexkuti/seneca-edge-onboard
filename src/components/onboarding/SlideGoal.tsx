import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Target, Coins, Award, Sparkles } from "lucide-react";
import SelectionCard from "./SelectionCard";
import type { SlideProps } from "./OnboardingFlow";

const goals = [
  { id: "consistency", label: "Become consistently profitable", icon: <Target className="h-5 w-5" /> },
  { id: "income", label: "Build full-time income", icon: <Coins className="h-5 w-5" /> },
  { id: "funded", label: "Pass a funded challenge", icon: <Award className="h-5 w-5" /> },
  { id: "control", label: "Master my own discipline", icon: <Sparkles className="h-5 w-5" /> },
];

export default function SlideGoal({ onNext }: SlideProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-accent-cyan/15 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-blue">
            Step 4 of 4
          </span>
        </div>
        <h1 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-text-primary">
          What's your <span className="text-gradient-mix">main goal?</span>
        </h1>
      </motion.div>

      <div className="space-y-2.5">
        {goals.map((m, i) => (
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
          Build my system
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </motion.button>
    </div>
  );
}
