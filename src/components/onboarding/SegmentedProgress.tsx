import { motion } from "framer-motion";

/**
 * Segmented progress bar — one segment per slide.
 * - Past segments are fully filled.
 * - Active segment animates from 0 → 100% over `duration` ms (paused if `paused`).
 * - Future segments are dim.
 * Tap a past/active segment to jump back.
 */
export default function SegmentedProgress({
  count,
  active,
  duration,
  paused,
  onSelect,
}: {
  count: number;
  active: number;
  /** ms — 0 means no auto-advance (segment shows as fully filled, static) */
  duration: number;
  paused: boolean;
  onSelect?: (i: number) => void;
}) {
  return (
    <div className="flex w-full items-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => {
        const isPast = i < active;
        const isActive = i === active;
        const tappable = !!onSelect && i <= active;
        return (
          <button
            key={i}
            type="button"
            disabled={!tappable}
            onClick={() => tappable && onSelect?.(i)}
            aria-label={`Step ${i + 1}`}
            className={`relative h-[3px] flex-1 overflow-hidden rounded-full bg-text-secondary/20 ${
              tappable ? "cursor-pointer" : "cursor-default"
            }`}
          >
            {isPast && (
              <span className="absolute inset-0 rounded-full bg-gradient-primary" />
            )}
            {isActive && duration > 0 && (
              <motion.span
                key={`${i}-${duration}-${paused ? "p" : "r"}`}
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-primary"
                initial={{ width: "0%" }}
                animate={{ width: paused ? "0%" : "100%" }}
                transition={{
                  duration: paused ? 0 : duration / 1000,
                  ease: "linear",
                }}
              />
            )}
            {isActive && duration === 0 && (
              <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
