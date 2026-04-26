import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

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
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl p-4 text-left transition-all ${
        selected
          ? "shadow-glow-primary ring-2 ring-brand"
          : "shadow-soft ring-1 ring-border hover:ring-brand/40"
      }`}
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(108,92,231,0.10), rgba(0,198,255,0.10))"
          : "white",
      }}
    >
      {selected && (
        <motion.span
          layoutId="select-glow"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-mix opacity-10"
        />
      )}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-white transition-all ${
            selected ? "bg-gradient-primary shadow-glow-primary" : "bg-gradient-to-br from-text-secondary/30 to-text-secondary/10"
          }`}
        >
          <div className={selected ? "" : "text-text-primary"}>{icon}</div>
        </div>
        <span
          className={`flex-1 text-[15px] font-semibold ${
            selected ? "text-text-primary" : "text-text-primary"
          }`}
        >
          {label}
        </span>
        <motion.span
          initial={false}
          animate={{
            scale: selected ? 1 : 0,
            opacity: selected ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-white shadow-glow-primary"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </motion.span>
      </div>
    </motion.button>
  );
}
