// PreTradeIntercept — full-screen psychological pressure layer rendered
// before a trade is logged. Calm but serious. No flashing, no noise.
//
// Renders inline (not modal). Caller controls when to show it via
// `evaluatePressure(state)`. Caller receives `onConfirm` (after hold
// completes) or `onCancel`.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import {
  TRIGGER_LABEL,
  type PressureEvaluation,
} from "@/lib/pressure";

type Props = {
  evaluation: PressureEvaluation;
  onConfirm: () => void;
  onCancel: () => void;
};

const TONE_RING: Record<string, string> = {
  ok: "ring-emerald-500/25 bg-emerald-500/[0.06] text-emerald-900",
  warn: "ring-amber-500/30 bg-amber-500/[0.07] text-amber-900",
  danger: "ring-red-600/30 bg-red-600/[0.06] text-red-900",
};

const SEVERITY_ACCENT: Record<string, string> = {
  low: "text-amber-700",
  medium: "text-orange-700",
  high: "text-red-700",
};

export default function PreTradeIntercept({
  evaluation,
  onConfirm,
  onCancel,
}: Props) {
  const [affirmed, setAffirmed] = useState({ entry: false, force: false });
  const allAffirmed = !evaluation.requires_affirm ||
    (affirmed.entry && affirmed.force);

  const [progress, setProgress] = useState(0); // 0..1
  const holdingRef = useRef(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const holdMs = evaluation.hold_seconds * 1000;

  function tick() {
    if (!holdingRef.current || startRef.current == null) return;
    const elapsed = performance.now() - startRef.current;
    const p = Math.min(1, elapsed / holdMs);
    setProgress(p);
    if (p >= 1 && !completedRef.current) {
      completedRef.current = true;
      holdingRef.current = false;
      onConfirm();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function startHold() {
    if (!allAffirmed || completedRef.current) return;
    holdingRef.current = true;
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }

  function endHold() {
    if (completedRef.current) return;
    holdingRef.current = false;
    startRef.current = null;
    setProgress(0);
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const sev = evaluation.severity;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 backdrop-blur-sm px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Pre-trade decision intercept"
    >
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-3xl bg-card p-6 ring-1 ring-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ring-1 ${TONE_RING[evaluation.preview.tone]}`}
          >
            {sev === "high" ? (
              <ShieldAlert className="h-5 w-5" strokeWidth={2.3} />
            ) : (
              <AlertTriangle className="h-5 w-5" strokeWidth={2.3} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Pressure layer · {sev}
            </p>
            <h2 className="mt-1 text-[19px] font-semibold leading-tight text-foreground">
              Pause. Confirm your decision.
            </h2>
          </div>
        </div>

        {/* Context block */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ContextCell
            label="Discipline"
            value={`${evaluation.context.discipline_score}/100`}
            sub={evaluation.context.discipline_state.replace("_", " ")}
            tone={
              evaluation.context.discipline_state === "in_control"
                ? "ok"
                : evaluation.context.discipline_state === "locked"
                  ? "danger"
                  : "warn"
            }
          />
          <ContextCell
            label="Last setup"
            value={
              evaluation.last_event_klass
                ? klassLabel(evaluation.last_event_klass)
                : "No analysis"
            }
            sub={evaluation.last_event_klass === "valid_clean" ? "Clean" : "Caution"}
            tone={
              evaluation.last_event_klass === "valid_clean"
                ? "ok"
                : evaluation.last_event_klass === "critical_invalid"
                  ? "danger"
                  : "warn"
            }
          />
        </div>

        {/* Triggers */}
        {evaluation.triggers.length > 0 && (
          <div className="mt-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Why this is showing
            </p>
            <ul className="mt-1.5 space-y-1">
              {evaluation.triggers.map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 text-[12px] text-foreground/85"
                >
                  <span
                    className={`mt-1 h-1.5 w-1.5 flex-none rounded-full ${SEVERITY_ACCENT[sev]} bg-current`}
                  />
                  <span>{TRIGGER_LABEL[t]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Consequence preview */}
        <div
          className={`mt-3 rounded-xl p-3.5 ring-1 ${TONE_RING[evaluation.preview.tone]}`}
        >
          <div className="flex items-start gap-2">
            {evaluation.preview.tone === "ok" ? (
              <Sparkles className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2.3} />
            ) : (
              <motion.span
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="mt-0.5 inline-flex"
              >
                <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={2.3} />
              </motion.span>
            )}
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold leading-snug">
                {evaluation.preview.headline}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed opacity-90">
                {evaluation.preview.body}
              </p>
              {evaluation.preview.state_risk && (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide">
                  → {evaluation.preview.state_risk}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Affirmation */}
        {evaluation.requires_affirm && (
          <div className="mt-3 space-y-2">
            <AffirmCheck
              checked={affirmed.entry}
              onToggle={() => setAffirmed((a) => ({ ...a, entry: !a.entry }))}
              label="I am following my entry rules."
            />
            <AffirmCheck
              checked={affirmed.force}
              onToggle={() => setAffirmed((a) => ({ ...a, force: !a.force }))}
              label="I am not forcing this trade."
            />
          </div>
        )}

        {/* Hold to confirm */}
        <div className="mt-5">
          <button
            type="button"
            disabled={!allAffirmed}
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
            onTouchCancel={endHold}
            className={`relative h-14 w-full overflow-hidden rounded-2xl text-[14px] font-semibold tracking-wide ring-1 transition-all select-none ${
              allAffirmed
                ? "bg-foreground text-background ring-foreground/20 active:scale-[0.99]"
                : "cursor-not-allowed bg-muted/60 text-muted-foreground ring-border"
            }`}
            aria-label={`Hold ${evaluation.hold_seconds} seconds to confirm`}
          >
            {/* Progress fill */}
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500/30"
              style={{ width: `${progress * 100}%`, transition: "width 50ms linear" }}
            />
            <div className="relative flex items-center justify-center gap-2">
              {progress >= 1 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.4} />
                  Confirming…
                </>
              ) : (
                <>
                  <Timer className="h-4 w-4" strokeWidth={2.4} />
                  HOLD to Confirm Trade
                  <span className="ml-1 text-[11px] font-mono opacity-75">
                    {evaluation.hold_seconds}s
                  </span>
                </>
              )}
            </div>
          </button>
          {!allAffirmed && evaluation.requires_affirm && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Tick both acknowledgements to enable the hold.
            </p>
          )}
          {evaluation.escalation_level >= 3 && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10.5px] font-semibold uppercase tracking-wide text-orange-700">
              <Lock className="h-3 w-3" /> Escalated hold — 3rd intercept this session
            </p>
          )}
        </div>

        {/* Soft exit */}
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-muted/40 px-4 py-2.5 text-[12.5px] font-semibold text-foreground/80 ring-1 ring-border transition-colors hover:bg-muted/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
          Cancel and Review Setup
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function ContextCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "ok" | "warn" | "danger";
}) {
  return (
    <div className="rounded-xl bg-muted/30 p-2.5 ring-1 ring-border">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p
        className={`mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
          tone === "ok"
            ? "text-emerald-700"
            : tone === "danger"
              ? "text-red-700"
              : "text-orange-700"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}

function AffirmCheck({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] ring-1 transition-colors ${
        checked
          ? "bg-emerald-500/[0.07] text-emerald-900 ring-emerald-500/30"
          : "bg-muted/30 text-foreground/85 ring-border hover:bg-muted/50"
      }`}
    >
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded-md ring-1 ${
          checked
            ? "bg-emerald-600 text-white ring-emerald-600"
            : "bg-card ring-border"
        }`}
      >
        {checked && <CheckCircle2 className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="flex-1 font-medium">{label}</span>
    </button>
  );
}

function klassLabel(k: string): string {
  switch (k) {
    case "valid_clean":
      return "VALID_CLEAN";
    case "valid_weak":
      return "VALID_WEAK";
    case "invalid":
      return "INVALID";
    case "critical_invalid":
      return "CRITICAL";
    default:
      return k.toUpperCase();
  }
}
