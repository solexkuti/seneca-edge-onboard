import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bitcoin,
  CandlestickChart,
  DollarSign,
  Globe2,
  LineChart,
} from "lucide-react";
import SelectionCard from "./SelectionCard";
import type { SlideProps } from "./OnboardingFlow";
import { patchProfile, type MarketChoice } from "@/lib/onboardingProfile";

const markets: { id: MarketChoice; label: string; icon: React.ReactNode }[] = [
  { id: "forex", label: "Forex", icon: <DollarSign className="h-5 w-5" /> },
  { id: "crypto", label: "Crypto", icon: <Bitcoin className="h-5 w-5" /> },
  { id: "stocks", label: "Stocks", icon: <CandlestickChart className="h-5 w-5" /> },
  { id: "indices", label: "Indices", icon: <LineChart className="h-5 w-5" /> },
  { id: "all", label: "All Markets", icon: <Globe2 className="h-5 w-5" /> },
];

export default function Slide4Market({ onNext }: SlideProps) {
  const [selected, setSelected] = useState<MarketChoice | null>(null);

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
            Step 1 of 4
          </span>
        </div>
        <h1 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-text-primary">
          Which market do you{" "}
          <span className="text-gradient-primary">trade most?</span>
        </h1>
      </motion.div>

      <div className="space-y-2.5">
        {markets.map((m, i) => (
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
                patchProfile({ market: m.id });
                window.setTimeout(onNext, 200);
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
