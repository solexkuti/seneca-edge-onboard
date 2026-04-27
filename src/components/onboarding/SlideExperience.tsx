import { useState } from "react";
import { motion } from "framer-motion";
import { Sprout, TrendingUp, Crown } from "lucide-react";
import SelectionCard from "./SelectionCard";
import type { SlideProps } from "./OnboardingFlow";
import { patchProfile, type ExperienceLevel } from "@/lib/onboardingProfile";

const levels: { id: ExperienceLevel; label: string; icon: React.ReactNode }[] = [
  { id: "beginner", label: "Beginner", icon: <Sprout className="h-5 w-5" /> },
  { id: "intermediate", label: "Intermediate", icon: <TrendingUp className="h-5 w-5" /> },
  { id: "advanced", label: "Advanced", icon: <Crown className="h-5 w-5" /> },
];

export default function SlideExperience({ onNext }: SlideProps) {
  const [selected, setSelected] = useState<ExperienceLevel | null>(null);

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
          How would you describe your{" "}
          <span className="text-gradient-primary">trading experience?</span>
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
                patchProfile({ experience: m.id });
                window.setTimeout(onNext, 200);
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
