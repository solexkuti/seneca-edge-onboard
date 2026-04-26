import { motion } from "framer-motion";

export default function ProgressDots({
  count,
  active,
}: {
  count: number;
  active: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        const isPast = i < active;
        return (
          <motion.span
            key={i}
            layout
            className={`h-1.5 rounded-full ${
              isActive
                ? "bg-gradient-primary shadow-glow-primary"
                : isPast
                  ? "bg-brand/50"
                  : "bg-text-secondary/25"
            }`}
            animate={{ width: isActive ? 22 : 6 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          />
        );
      })}
    </div>
  );
}
