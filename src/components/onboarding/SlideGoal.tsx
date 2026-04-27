import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Crosshair, Shield, Settings2 } from "lucide-react";
import SelectionCard from "./SelectionCard";
import type { SlideProps } from "./OnboardingFlow";
import { patchProfile, type GoalChoice } from "@/lib/onboardingProfile";

const goals: { id: GoalChoice; label: string; icon: React.ReactNode }[] = [
  { id: "consistency", label: "Consistency", icon: <Target className="h-5 w-5" /> },
  { id: "better-entries", label: "Better entries", icon: <Crosshair className="h-5 w-5" /> },
  { id: "risk-control", label: "Better risk control", icon: <Shield className="h-5 w-5" /> },
  { id: "build-system", label: "Build a solid system", icon: <Settings2 className="h-5 w-5" /> },
];

export default function SlideGoal({ onNext }: SlideProps) {
  const [selected, setSelected] = useState<GoalChoice | null>(null);

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
          What are you trying to{" "}
          <span className="text-gradient-mix">improve right now?</span>
        </h1>
      </motion.div>

      <div className="space-y-2.5">
        {goals.map((m, i) => {
          const isSelected = selected === m.id;
          const isOther = selected !== null && !isSelected;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -16 }}
              animate={
                isOther
                  ? { opacity: 0, y: -6, filter: "blur(2px)" }
                  : isSelected
                    ? { opacity: 1, y: -2, scale: 1.012 }
                    : { opacity: 1, x: 0, y: 0, scale: 1 }
              }
              transition={{
                delay: selected ? 0 : 0.1 + i * 0.06,
                duration: isOther ? 0.32 : 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <SelectionCard
                icon={m.icon}
                label={m.label}
                selected={isSelected}
                onClick={() => {
                  if (selected) return;
                  setSelected(m.id);
                  patchProfile({ goal: m.id });
                  // Slightly longer dwell so the confirming motion lands
                  // before the slide hand-off begins.
                  window.setTimeout(onNext, 360);
                }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
