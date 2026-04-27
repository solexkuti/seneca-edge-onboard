import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Single continuous progress bar for onboarding.
 *
 * - Total progress = (completed slides + active dwell) / total slides
 * - Auto-fills smoothly during the active slide's dwell (`duration` ms)
 * - Snaps instantly on swipe / jump (driven by `active` change)
 * - Click anywhere on the track to jump back to the nearest past slide
 */
export default function SegmentedProgress({
  count,
  active,
  duration,
  onSelect,
}: {
  count: number;
  active: number;
  /** ms — 0 means no auto-advance (bar holds at the slide's start position) */
  duration: number;
  onSelect?: (i: number) => void;
}) {
  const controls = useAnimationControls();
  const baseRef = useRef(0);

  // Base progress = portion already cleared by completed slides.
  const base = count > 0 ? active / count : 0;
  // Target progress at the end of the current dwell.
  const target = count > 0 ? (active + 1) / count : 0;

  useEffect(() => {
    baseRef.current = base;
    // Snap to the slide's starting position immediately on slide change.
    controls.set({ width: `${base * 100}%` });

    if (duration > 0) {
      controls.start({
        width: `${target * 100}%`,
        transition: { duration: duration / 1000, ease: "linear" },
      });
    }
  }, [active, duration, base, target, controls]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSelect) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const target = Math.max(0, Math.min(active, Math.floor(ratio * count)));
    if (target < active) onSelect(target);
  };

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={active + 1}
      onClick={handleTrackClick}
      className="relative h-[3px] w-full cursor-pointer rounded-full bg-text-secondary/15"
    >
      {/* Filled portion — drives both the bar and the leading-edge bloom */}
      <motion.span
        animate={controls}
        initial={{ width: `${base * 100}%` }}
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-primary"
      >
        {/* Soft outward bloom riding the fill edge */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 h-3 w-6 -translate-y-1/2 translate-x-1/2 rounded-full bg-gradient-primary opacity-60 blur-md"
        />
        {/* Crisp glowing tip dot for definition */}
        <motion.span
          aria-hidden
          animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.15, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute right-0 top-1/2 h-[7px] w-[7px] -translate-y-1/2 translate-x-1/2 rounded-full bg-gradient-primary shadow-[0_0_8px_rgba(108,92,231,0.55)]"
        />
      </motion.span>
    </div>
  );
}
