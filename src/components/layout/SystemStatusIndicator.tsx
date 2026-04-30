import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTraderState } from "@/hooks/useTraderState";

// ─────────────────────────────────────────────────────────────
// SystemStatusIndicator
// Mentor-like, dynamic status line for the sidebar footer.
// Derives tone from existing TraderState — no backend logic changes.
// Phrases are short, calm, observational.
// ─────────────────────────────────────────────────────────────

type StatusTone = "stable" | "improving" | "drift" | "risk" | "locked" | "idle";

type Status = {
  tone: StatusTone;
  eyebrow: string;
  message: string;
};

const PALETTE: Record<
  StatusTone,
  { eyebrowColor: string; dot: string; pulse: string; ring: string }
> = {
  stable: {
    eyebrowColor: "text-gold/80",
    dot: "bg-gold",
    pulse: "bg-gold/40",
    ring: "ring-gold/20",
  },
  improving: {
    eyebrowColor: "text-gold/80",
    dot: "bg-gold",
    pulse: "bg-gold/40",
    ring: "ring-gold/20",
  },
  drift: {
    eyebrowColor: "text-amber-300/85",
    dot: "bg-amber-300",
    pulse: "bg-amber-300/40",
    ring: "ring-amber-300/20",
  },
  risk: {
    eyebrowColor: "text-amber-300/90",
    dot: "bg-amber-300",
    pulse: "bg-amber-300/50",
    ring: "ring-amber-300/25",
  },
  locked: {
    eyebrowColor: "text-rose-300/90",
    dot: "bg-rose-300",
    pulse: "bg-rose-300/40",
    ring: "ring-rose-300/25",
  },
  idle: {
    eyebrowColor: "text-text-secondary/70",
    dot: "bg-text-secondary/50",
    pulse: "bg-text-secondary/20",
    ring: "ring-white/10",
  },
};

function deriveStatus(
  loading: boolean,
  disciplineState: string,
  score: number,
  consecutiveBreaks: number,
  recentLen: number,
): Status {
  if (loading) {
    return {
      tone: "idle",
      eyebrow: "Edge · Calibrating",
      message: "Reading your recent decisions.",
    };
  }

  if (disciplineState === "locked") {
    return {
      tone: "locked",
      eyebrow: "Edge · Paused",
      message: "Recovery required before next decision.",
    };
  }

  if (disciplineState === "at_risk" || consecutiveBreaks >= 2) {
    return {
      tone: "risk",
      eyebrow: "Edge · Watching",
      message: "Pattern weakening. Slow down, reset.",
    };
  }

  if (disciplineState === "slipping") {
    return {
      tone: "drift",
      eyebrow: "Edge · Alert",
      message: "Execution drift detected. Stay sharp.",
    };
  }

  // in_control
  if (recentLen === 0) {
    return {
      tone: "idle",
      eyebrow: "Edge · Ready",
      message: "Standing by. Trade only your setup.",
    };
  }

  if (score >= 85) {
    return {
      tone: "stable",
      eyebrow: "Edge · Active",
      message: "Discipline stable. No violations detected.",
    };
  }

  return {
    tone: "improving",
    eyebrow: "Edge · Active",
    message: "Consistency improving. Maintain structure.",
  };
}

export default function SystemStatusIndicator() {
  const { state } = useTraderState();

  const status = useMemo(
    () =>
      deriveStatus(
        state.loading,
        state.discipline.state,
        state.discipline.score,
        state.discipline.consecutive_breaks,
        state.discipline.recent.length,
      ),
    [
      state.loading,
      state.discipline.state,
      state.discipline.score,
      state.discipline.consecutive_breaks,
      state.discipline.recent.length,
    ],
  );

  const palette = PALETTE[status.tone];
  const key = `${status.tone}:${status.message}`;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 ring-1 ${palette.ring}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${palette.pulse} opacity-75`}
          />
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${palette.dot}`}
          />
        </span>
        <p
          className={`text-[10.5px] font-semibold uppercase tracking-[0.2em] ${palette.eyebrowColor}`}
        >
          {status.eyebrow}
        </p>
      </div>
      <div className="relative mt-1 min-h-[32px]">
        <AnimatePresence mode="wait">
          <motion.p
            key={key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-[12px] leading-snug text-text-secondary"
          >
            {status.message}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
