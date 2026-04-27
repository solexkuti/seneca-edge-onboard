import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, LogOut, Shield, Brain } from "lucide-react";
import SelectionCard from "./SelectionCard";
import type { SlideProps } from "./OnboardingFlow";
import { patchProfile, type ChallengeChoice } from "@/lib/onboardingProfile";

const struggles: { id: ChallengeChoice; label: string; icon: React.ReactNode }[] = [
  { id: "entries", label: "Entries", icon: <LogIn className="h-5 w-5" /> },
  { id: "exits", label: "Exits", icon: <LogOut className="h-5 w-5" /> },
  { id: "risk", label: "Risk management", icon: <Shield className="h-5 w-5" /> },
  { id: "discipline", label: "Discipline / emotions", icon: <Brain className="h-5 w-5" /> },
];

export default function SlideStruggle({ onNext }: SlideProps) {
  const [selected, setSelected] = useState<ChallengeChoice | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-mix" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            Step 3 of 4
          </span>
        </div>
        <h1 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-text-primary">
          What do you struggle with{" "}
          <span className="text-gradient-mix">the most?</span>
        </h1>
      </motion.div>

      <div className="space-y-2.5">
        {struggles.map((m, i) => (
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
                patchProfile({ challenge: m.id });
                window.setTimeout(onNext, 200);
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
