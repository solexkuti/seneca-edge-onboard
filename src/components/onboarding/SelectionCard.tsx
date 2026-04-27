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
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      onClick={() => {
        playFeedback("tap");
        onClick();
      }}
      className={`interactive-glow group relative w-full overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 ${
        selected
          ? "shadow-card ring-1 ring-brand/50"
          : "shadow-soft ring-1 ring-border hover:ring-brand/25 hover:shadow-card"
      }`}
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(110,98,201,0.06), rgba(120,180,210,0.05))"
          : "hsl(var(--card))",
      }}
    >
      {selected && (
        <motion.span
          layoutId="select-glow"
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "linear-gradient(135deg, rgba(110,98,201,0.05), rgba(120,180,210,0.04))",
          }}
        />
      )}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 ${
            selected
              ? "bg-gradient-primary text-white"
              : "bg-muted/60 text-text-primary ring-1 ring-border/60"
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
          className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/30"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
        </motion.span>
      </div>
    </motion.button>
  );
}
