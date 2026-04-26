import { motion } from "framer-motion";

export default function ProgressDots({
  count,
  active,
  onSelect,
}: {
  count: number;
  active: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        const isPast = i < active;
        const tappable = !!onSelect && i <= active;
        return (
          <motion.button
            key={i}
            layout
            type="button"
            disabled={!tappable}
            onClick={() => tappable && onSelect?.(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`h-1.5 rounded-full transition-opacity ${
              isActive
                ? "bg-gradient-primary shadow-glow-primary"
                : isPast
                  ? "bg-brand/50 hover:bg-brand/80"
                  : "bg-text-secondary/25"
            } ${tappable ? "cursor-pointer" : "cursor-default"}`}
            animate={{ width: isActive ? 22 : 6 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          />
        );
      })}
    </div>
  );
}
