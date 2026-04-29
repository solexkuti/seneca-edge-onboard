import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { playFeedback } from "@/lib/feedback";

export default function SelectionCard({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      data-active={selected ? "true" : "false"}
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      onClick={() => {
        playFeedback("tap");
        onClick();
      }}
      className={`focus-glow group relative w-full overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 ${
        selected
          ? "border border-[rgba(198,161,91,0.45)] shadow-glow-gold"
          : "border border-[rgba(255,255,255,0.08)] hover:border-[rgba(198,161,91,0.28)]"
      }`}
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(198,161,91,0.10), rgba(230,194,122,0.04))"
          : "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
        backdropFilter: "blur(12px) saturate(130%)",
        WebkitBackdropFilter: "blur(12px) saturate(130%)",
      }}
    >
      {selected && (
        <motion.span
          layoutId="select-glow"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, rgba(198,161,91,0.16), transparent 60%)",
          }}
        />
      )}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 ${
            selected
              ? "bg-gold-gradient text-[#0B0B0D] shadow-glow-gold"
              : "bg-[rgba(255,255,255,0.04)] text-text-primary ring-1 ring-[rgba(255,255,255,0.08)]"
          }`}
        >
          {icon}
        </div>
        <span className="flex-1 text-[15px] font-semibold text-text-primary">
          {label}
        </span>
        <motion.span
          initial={false}
          animate={{
            scale: selected ? 1 : 0.6,
            opacity: selected ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(198,161,91,0.14)] text-gold ring-1 ring-[rgba(198,161,91,0.40)]"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
        </motion.span>
      </div>
    </motion.button>
  );
}
