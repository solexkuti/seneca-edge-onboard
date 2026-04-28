// MentorRecoveryChecklist — a compact, in-chat recovery checklist that
// progressively unlocks the Analyzer.
//
// Each step inserts a small synthetic positive analyzer_event (verdict=valid,
// score_delta=+2, reason="mentor_recovery_step:<n>"). The existing
// disciplineScore engine recency-weights this and the AnalyzerLockScreen
// auto-unmounts the moment score >= 40 AND the checklist is confirmed.
//
// We deliberately do NOT mark the user "in_control" — only real trades earn
// that. This is just a guided lift out of LOCKED into AT_RISK.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  Lock,
  ShieldCheck,
  Wind,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTraderState } from "@/hooks/useTraderState";
import { broadcastAnalyzerEvent } from "@/lib/analyzerEvents";
import { getLastViolation, type LastViolation } from "@/lib/recovery";
import { toast } from "sonner";

type StepKey = "acknowledge" | "confirm" | "recommit" | "breathe";

type Step = {
  key: StepKey;
  label: string;
  hint: string;
  icon: typeof CheckCircle2;
};

const STEPS: Step[] = [
  {
    key: "acknowledge",
    label: "Acknowledge what broke",
    hint: "Name the rule you violated.",
    icon: ShieldCheck,
  },
  {
    key: "confirm",
    label: "Confirm today's checklist",
    hint: "Required gate before any trade.",
    icon: CheckCircle2,
  },
  {
    key: "recommit",
    label: "Recommit to one rule area",
    hint: "Pick one and stand behind it.",
    icon: ShieldCheck,
  },
  {
    key: "breathe",
    label: "60-second cooldown breath",
    hint: "Reset your nervous system.",
    icon: Wind,
  },
];

const RULE_AREAS = ["entry", "exit", "risk", "behavior"] as const;
type RuleArea = (typeof RULE_AREAS)[number];

const STORAGE_KEY = "seneca:mentor-recovery-progress";

function loadProgress(): Record<StepKey, boolean> {
  if (typeof window === "undefined") return blankProgress();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return blankProgress();
    const parsed = JSON.parse(raw) as Partial<Record<StepKey, boolean>>;
    return {
      acknowledge: !!parsed.acknowledge,
      confirm: !!parsed.confirm,
      recommit: !!parsed.recommit,
      breathe: !!parsed.breathe,
    };
  } catch {
    return blankProgress();
  }
}
function saveProgress(p: Record<StepKey, boolean>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
function blankProgress(): Record<StepKey, boolean> {
  return { acknowledge: false, confirm: false, recommit: false, breathe: false };
}

/**
 * Insert a synthetic positive analyzer_event so the discipline engine lifts
 * the score deterministically. Score scale: +2 per step (matches the
 * recovery boost convention in src/lib/recovery.ts).
 */
async function logRecoveryStep(stepKey: StepKey): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return false;
  const { error } = await supabase.from("analyzer_events").insert({
    user_id: uid,
    analysis_id: null,
    blueprint_id: null,
    verdict: "valid",
    violations: [],
    score_delta: 2,
    reason: `mentor_recovery_step:${stepKey}`,
  } as never);
  if (error) {
    console.error("[mentor-recovery] insert failed", error);
    return false;
  }
  broadcastAnalyzerEvent();
  return true;
}

export default function MentorRecoveryChecklist() {
  const { state, refresh } = useTraderState();
  const navigate = useNavigate();

  const [progress, setProgress] = useState<Record<StepKey, boolean>>(() =>
    loadProgress(),
  );
  const [chosenRule, setChosenRule] = useState<RuleArea | null>(null);
  const [breatheLeft, setBreatheLeft] = useState<number | null>(null);
  const [violation, setViolation] = useState<LastViolation | null>(null);
  const persistedRef = useRef<Record<StepKey, boolean>>(progress);

  // Keep "confirm" step in sync with real session.checklist_confirmed.
  useEffect(() => {
    if (state.session.checklist_confirmed && !progress.confirm) {
      const next = { ...progress, confirm: true };
      setProgress(next);
      saveProgress(next);
    }
  }, [state.session.checklist_confirmed, progress]);

  // Load last violation once for the acknowledge step.
  useEffect(() => {
    let cancelled = false;
    void getLastViolation().then((v) => {
      if (!cancelled) setViolation(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cooldown timer for the breathe step.
  useEffect(() => {
    if (breatheLeft === null) return;
    if (breatheLeft <= 0) {
      void completeStep("breathe");
      setBreatheLeft(null);
      return;
    }
    const t = setTimeout(() => setBreatheLeft((v) => (v ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breatheLeft]);

  const completeStep = async (key: StepKey) => {
    if (persistedRef.current[key]) return;
    const ok = await logRecoveryStep(key);
    if (!ok) {
      toast.error("Couldn't save that step. Try again.");
      return;
    }
    const next = { ...progress, [key]: true };
    persistedRef.current = next;
    setProgress(next);
    saveProgress(next);
    void refresh();
    toast.success("+2 discipline · step recorded");
  };

  const completed = useMemo(
    () => STEPS.filter((s) => progress[s.key]).length,
    [progress],
  );
  const allDone = completed === STEPS.length;

  const stepsRemaining = STEPS.length - completed;
  const lockState = state.discipline.state;
  const accessLabel =
    lockState === "locked"
      ? "Locked"
      : !state.session.checklist_confirmed
        ? "Locked (checklist)"
        : lockState === "at_risk"
          ? "Probation"
          : "Open";
  const accessTone =
    accessLabel === "Open"
      ? "text-emerald-700 bg-emerald-500/10 ring-emerald-500/25"
      : accessLabel === "Probation"
        ? "text-amber-700 bg-amber-500/10 ring-amber-500/25"
        : "text-rose-700 bg-rose-500/10 ring-rose-500/25";

  const violationOptions = violation?.rules_broken?.length
    ? violation.rules_broken
    : ["entry", "exit", "risk", "behavior"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-border/60 bg-text-primary/[0.02] px-4 py-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 ring-1 ring-brand/20">
            <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-text-primary">
              Recovery checklist
            </p>
            <p className="text-[10.5px] text-text-secondary">
              {allDone
                ? "All steps complete — discipline lifted."
                : `${stepsRemaining} step${stepsRemaining === 1 ? "" : "s"} to lift the lock`}
            </p>
          </div>
        </div>
        <div
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ${accessTone}`}
          title={`Discipline ${state.discipline.score}/100 · ${lockState}`}
        >
          {accessLabel === "Open" ? (
            <ShieldCheck className="h-3 w-3" strokeWidth={2.6} />
          ) : (
            <Lock className="h-3 w-3" strokeWidth={2.6} />
          )}
          <span>Analyzer · {accessLabel}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-text-primary/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-primary"
          initial={false}
          animate={{ width: `${(completed / STEPS.length) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Steps */}
      <ol className="mt-3 space-y-1.5">
        {STEPS.map((s, i) => {
          const done = progress[s.key];
          const Icon = done ? CheckCircle2 : Circle;
          return (
            <li key={s.key}>
              <div
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                  done
                    ? "bg-emerald-500/[0.06]"
                    : "bg-card/60 ring-1 ring-border"
                }`}
              >
                <Icon
                  className={`mt-0.5 h-3.5 w-3.5 flex-none ${
                    done ? "text-emerald-700" : "text-text-secondary"
                  }`}
                  strokeWidth={2.4}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[12px] font-medium ${
                      done
                        ? "text-text-secondary line-through decoration-emerald-700/40"
                        : "text-text-primary"
                    }`}
                  >
                    {i + 1}. {s.label}
                  </p>

                  {!done && (
                    <AnimatePresence initial={false}>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <p className="mt-0.5 text-[10.5px] leading-snug text-text-secondary">
                          {s.hint}
                        </p>
                        <div className="mt-1.5">
                          {s.key === "acknowledge" && (
                            <div className="flex flex-wrap gap-1">
                              {violationOptions.map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => void completeStep("acknowledge")}
                                  className="rounded-full bg-card px-2.5 py-1 text-[11px] font-medium text-text-primary ring-1 ring-border transition hover:bg-text-primary/[0.04] hover:ring-brand/30"
                                >
                                  I broke {r}
                                </button>
                              ))}
                            </div>
                          )}
                          {s.key === "confirm" && (
                            <button
                              type="button"
                              onClick={() =>
                                void navigate({ to: "/hub/daily", replace: false })
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1 text-[11px] font-medium text-text-primary ring-1 ring-border transition hover:bg-text-primary/[0.04] hover:ring-brand/30"
                            >
                              Open daily checklist
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                          {s.key === "recommit" && (
                            <div className="flex flex-wrap items-center gap-1">
                              {RULE_AREAS.map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setChosenRule(r)}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition ${
                                    chosenRule === r
                                      ? "bg-brand/10 text-brand ring-brand/30"
                                      : "bg-card text-text-primary ring-border hover:bg-text-primary/[0.04]"
                                  }`}
                                >
                                  {r}
                                </button>
                              ))}
                              <button
                                type="button"
                                disabled={!chosenRule}
                                onClick={() => void completeStep("recommit")}
                                className="ml-1 inline-flex items-center gap-1 rounded-lg bg-gradient-primary px-2.5 py-1 text-[11px] font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Recommit
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          {s.key === "breathe" && (
                            <button
                              type="button"
                              onClick={() => {
                                if (breatheLeft !== null) return;
                                setBreatheLeft(60);
                              }}
                              disabled={breatheLeft !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1 text-[11px] font-medium text-text-primary ring-1 ring-border transition hover:bg-text-primary/[0.04] hover:ring-brand/30 disabled:opacity-60"
                            >
                              <Wind className="h-3 w-3" strokeWidth={2.4} />
                              {breatheLeft !== null
                                ? `Breathing… ${breatheLeft}s`
                                : "Start 60s breath"}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {allDone && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-emerald-500/[0.08] px-2.5 py-1.5 ring-1 ring-emerald-500/25"
        >
          <p className="text-[11px] text-emerald-900/85">
            Steps complete. Analyzer access reflects your real discipline state in real time — no refresh needed.
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/hub/chart", replace: false })}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-soft transition hover:opacity-95"
          >
            Try analyzer
            <ArrowRight className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
