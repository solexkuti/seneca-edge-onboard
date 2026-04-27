import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, AtSign } from "lucide-react";
import type { SlideProps } from "./OnboardingFlow";

export default function SlideName({
  onNext,
  value,
  onChange,
}: SlideProps & {
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [name, setName] = useState(value ?? "");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onChange?.(trimmed);
    onNext();
  };

  return (
    <div className="flex flex-col gap-7">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            Almost there
          </span>
        </div>
        <h1 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-text-primary">
          What should we{" "}
          <span className="text-gradient-mix">call you?</span>
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary">
          This is how your system will address you.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative"
      >
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
          <AtSign className="h-5 w-5" />
        </div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="e.g. markfx"
          maxLength={40}
          className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-[16px] font-semibold text-text-primary shadow-soft outline-none ring-0 transition-all placeholder:font-normal placeholder:text-text-secondary/60 focus:border-brand/60"
        />
      </motion.div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={name.trim().length === 0}
        onClick={handleSubmit}
        animate={{ opacity: name.trim().length === 0 ? 0.4 : 1 }}
        className="interactive-glow group relative w-full overflow-hidden rounded-2xl bg-gradient-primary px-6 py-4 shadow-soft disabled:cursor-not-allowed"
      >
        <span className="relative flex items-center justify-center gap-2 text-[16px] font-semibold text-white">
          Continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </motion.button>
    </div>
  );
}
