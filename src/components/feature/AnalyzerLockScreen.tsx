// AnalyzerLockScreen — strict lock UI for the Chart Analyzer.
//
// Renders ONLY when:
//   discipline.state === "locked"     OR
//   session.checklist_confirmed === false
//
// No analyzer UI behind it. No upload. No drag/drop. No API call.
// Real-time recheck: subscribes to TRADER_STATE — when the user fixes their
// state, this component automatically unmounts (no refresh required).

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Lock,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Brain,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Sparkles,
  MinusCircle,
} from "lucide-react";

const REDUCE_MOTION_KEY = "seneca.lock.reduceMotion";

function readInitialReduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(REDUCE_MOTION_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* ignore */
  }
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
import { useTraderState } from "@/hooks/useTraderState";
import { logLockAttempt, type LockAttemptReason } from "@/lib/lockAttempts";

type Props = { children: React.ReactNode };

// Single structured reason row: shows expected vs actual and whether
// this gate is the one that failed.
function ReasonBullet({
  failed,
  label,
  expected,
  actual,
}: {
  failed: boolean;
  label: string;
  expected: string;
  actual: string;
}) {
  const Icon = failed ? XCircle : CheckCircle2;
  const tone = failed ? "text-red-700" : "text-emerald-700";
  const valueTone = failed ? "text-red-900" : "text-foreground/80";
  return (
    <li className="flex items-start gap-2">
      <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${tone}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {expected}
          </span>
        </div>
        <div className={`text-[11px] leading-relaxed ${valueTone}`}>
          {actual}
        </div>
      </div>
    </li>
  );
}

export default function AnalyzerLockScreen({ children }: Props) {
  const { state } = useTraderState();
  const navigate = useNavigate();
  const lastLoggedKeyRef = useRef<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState<boolean>(readInitialReduceMotion);

  useEffect(() => {
    try {
      window.localStorage.setItem(REDUCE_MOTION_KEY, reduceMotion ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [reduceMotion]);

  const lock = useMemo(() => {
    if (state.loading) return { kind: "loading" as const };
    // Discipline lock takes priority — it's the harder failure mode.
    if (state.blocks.discipline_locked) {
      return {
        kind: "discipline" as const,
        reason: "discipline_locked" as LockAttemptReason,
      };
    }
    if (state.blocks.not_confirmed) {
      return {
        kind: "checklist" as const,
        reason: "checklist_not_confirmed" as LockAttemptReason,
      };
    }
    return { kind: "ok" as const };
  }, [state]);

  // Log a lock-attempt event when the user lands here while locked. We
  // de-dupe by reason so we don't spam the table on every re-render.
  useEffect(() => {
    if (lock.kind === "ok" || lock.kind === "loading") return;
    const key = `${lock.reason}:${state.discipline.state}:${state.session.checklist_confirmed}`;
    if (lastLoggedKeyRef.current === key) return;
    lastLoggedKeyRef.current = key;
    void logLockAttempt({
      surface: "analyzer",
      discipline_state: state.discipline.state,
      discipline_score: state.discipline.score,
      checklist_confirmed: state.session.checklist_confirmed,
      reason: lock.reason,
    });
  }, [lock, state.discipline, state.session.checklist_confirmed]);

  if (lock.kind === "loading") return null;
  if (lock.kind === "ok") return <>{children}</>;

  // ── Reason copy ────────────────────────────────────────────────────────
  const isDiscipline = lock.kind === "discipline";
  const title = "Trading Locked";
  const subtitle =
    "You are not in a controlled state to analyze or execute trades.";
  // (Reason copy is now rendered as structured bullets below.)

  const fixTarget = isDiscipline ? "/hub/recovery" : "/hub/daily";
  const fixLabel = isDiscipline
    ? "Start Recovery"
    : "Fix My State (Confirm Checklist)";

  const onFixState = () => {
    void navigate({ to: fixTarget, replace: false });
  };
  const onReviewLastMistake = () => {
    void navigate({ to: "/hub/journal/history", replace: false });
  };

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Blocked content sits behind a fully opaque overlay. No drag/drop
         events can reach it because nothing renders. */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />

      {/* Ambient tech particles — pure decoration, non-interactive.
         Suppressed when the user has reduced motion enabled. */}
      {!reduceMotion && <TechParticles />}

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[640px] items-center justify-center px-5 py-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
          className="w-full rounded-2xl bg-card p-7 ring-1 ring-border shadow-card-premium"
        >
          {/* Icon + eyebrow */}
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-red-600/10 ring-1 ring-red-600/20">
            {!reduceMotion && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl bg-red-600/25"
                animate={{ opacity: [0.15, 0.45, 0.15], scale: [1, 1.08, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <Lock className="relative h-5 w-5 text-red-700" aria-hidden />
          </div>
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-700">
            Analyzer Locked
          </div>

          {/* Title + subtitle */}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            {subtitle}
          </p>

          {/* Unlock-reason micro-animation — deterministic. Walks through
             the three gates (Checklist → Discipline state → Score) and
             dwells on the one currently failing so the user can see, at
             a glance, what is keeping the lock active. CTA copy unchanged. */}
          <UnlockReasonTicker
            checklistConfirmed={state.session.checklist_confirmed}
            disciplineState={state.discipline.state}
            score={state.discipline.score}
            reduceMotion={reduceMotion}
          />

          {/* State indicators */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Indicator
              label="Discipline state"
              value={prettyState(state.discipline.state)}
              tone={isDiscipline ? "red" : "muted"}
              icon={ShieldAlert}
              meta={`${state.discipline.score}/100`}
              reduceMotion={reduceMotion}
            />
            <Indicator
              label="Checklist"
              value={state.session.checklist_confirmed ? "Confirmed" : "Not confirmed"}
              tone={state.session.checklist_confirmed ? "ok" : "red"}
              icon={state.session.checklist_confirmed ? ShieldCheck : Lock}
              reduceMotion={reduceMotion}
            />
          </div>

          {/* Deterministic lock-reason trace — every measured gate, in
             evaluation order, with expected vs actual and a pass/fail
             verdict. Mirrors enforceTradingAccess() exactly. */}
          {(() => {
            const score = state.discipline.score;
            const dState = state.discipline.state;
            const confirmed = state.session.checklist_confirmed;

            // Score threshold band the user fell below (deterministic).
            // Mirrors stateForScore() boundaries.
            const THRESHOLDS = [
              { min: 80, label: "In Control" },
              { min: 60, label: "Slipping" },
              { min: 40, label: "At Risk" },
              { min: 0, label: "Locked (Out of Control)" },
            ];
            const belowBand = THRESHOLDS.find((t) => score < t.min);
            const currentBand = THRESHOLDS.find((t) => score >= t.min) ?? THRESHOLDS[3];
            const scoreFailed = score < 40 || dState === "locked";
            const checklistFailed = !confirmed;
            // Primary blocker is what enforceTradingAccess would report.
            const primary: "checklist" | "discipline" =
              isDiscipline ? "discipline" : "checklist";

            return (
              <div className="mt-4 rounded-xl bg-red-600/5 p-3 ring-1 ring-red-600/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-none text-red-700" aria-hidden />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700">
                    Lock reason trace
                  </div>
                  <div className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    Primary: {primary === "discipline" ? "Discipline" : "Checklist"}
                  </div>
                </div>

                <ul className="mt-2 space-y-1.5">
                  {/* Gate 1 — checklist confirmed today */}
                  <ReasonBullet
                    failed={checklistFailed}
                    label={`1. Daily checklist${primary === "checklist" ? " · BLOCKING" : ""}`}
                    expected="Confirmed today"
                    actual={confirmed ? "Confirmed" : "Not confirmed today"}
                  />

                  {/* Gate 2 — discipline state must not be 'locked' */}
                  <ReasonBullet
                    failed={dState === "locked"}
                    label={`2. Discipline state${dState === "locked" && primary === "discipline" ? " · BLOCKING" : ""}`}
                    expected="≠ locked"
                    actual={prettyState(dState)}
                  />

                  {/* Gate 3 — score threshold */}
                  <ReasonBullet
                    failed={scoreFailed}
                    label="3. Discipline score"
                    expected="≥ 40 / 100"
                    actual={
                      scoreFailed
                        ? `${score}/100 — below 40 threshold (band: ${belowBand?.label ?? currentBand.label})`
                        : `${score}/100 — band: ${currentBand.label}`
                    }
                  />
                </ul>

                {/* Threshold ladder — shows exactly which band the user
                   fell into so the trace is auditable. */}
                <div className="mt-3 grid grid-cols-4 gap-1">
                  {THRESHOLDS.slice().reverse().map((t) => {
                    const inBand = currentBand.min === t.min;
                    const isLocked = t.min === 0;
                    return (
                      <div
                        key={t.min}
                        className={[
                          "rounded-md px-1.5 py-1 text-center ring-1 transition",
                          inBand && isLocked
                            ? "bg-red-600/15 ring-red-600/40 text-red-800"
                            : inBand
                              ? "bg-amber-500/15 ring-amber-500/40 text-amber-900"
                              : "bg-muted/40 ring-border text-foreground/55",
                        ].join(" ")}
                      >
                        <div className="text-[9px] font-semibold uppercase tracking-wide">
                          {t.min}+
                        </div>
                        <div className="text-[9px] leading-tight opacity-80">
                          {t.label.split(" ")[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 text-[10px] leading-relaxed text-foreground/70">
                  Trace is deterministic: same inputs → same verdict. No AI
                  judgment is applied here.
                </div>
              </div>
            );
          })()}

          {/* How to unlock — deterministic, ordered remediation steps for
             every gate that is currently failing. Mirrors the same gate
             evaluation as the lock-reason trace above. */}
          <UnlockSteps
            checklistConfirmed={state.session.checklist_confirmed}
            disciplineState={state.discipline.state}
            score={state.discipline.score}
          />

          {/* CTAs */}
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={onFixState}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-95"
            >
              {isDiscipline ? (
                <Brain className="h-4 w-4" aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              )}
              {fixLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onReviewLastMistake}
              className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs font-medium text-foreground/80 ring-1 ring-border transition hover:bg-muted/40"
            >
              Review My Last Mistake
            </button>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            No discipline = no access. SenecaEdge is a controlled gate, not a
            feature. The lock will lift automatically the moment your state
            recovers — no refresh needed.
          </p>

          {/* Reduce-motion toggle — purely presentational. Does not change
             copy, CTA targets, or unlock logic. */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 ring-1 ring-border">
            <div className="flex items-center gap-2 text-[11px] text-foreground/75">
              {reduceMotion ? (
                <MinusCircle className="h-3.5 w-3.5 text-foreground/55" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-foreground/55" aria-hidden />
              )}
              <span>Reduce motion</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reduceMotion}
              aria-label="Reduce motion on this screen"
              onClick={() => setReduceMotion((v) => !v)}
              className={[
                "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors",
                reduceMotion ? "bg-primary" : "bg-foreground/20",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
                  reduceMotion ? "translate-x-4" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── UnlockReasonTicker ──────────────────────────────────────────────────
// Deterministic micro-animation that surfaces *why* the lock is still
// active. Computes the failing gates from props (no AI, no randomness),
// then either cycles focus across the 3 gates (motion on) or renders a
// single static row pinned to the primary blocker (motion off).
type GateKey = "checklist" | "state" | "score";

function UnlockReasonTicker({
  checklistConfirmed,
  disciplineState,
  score,
  reduceMotion,
}: {
  checklistConfirmed: boolean;
  disciplineState: string;
  score: number;
  reduceMotion: boolean;
}) {
  const gates = useMemo(
    () => {
      const checklistFail = !checklistConfirmed;
      const stateFail = disciplineState === "locked";
      const scoreFail = score < 40;
      return [
        {
          key: "checklist" as GateKey,
          failed: checklistFail,
          label: "Daily checklist not confirmed",
          hint: "Confirm today’s checklist to release this gate.",
        },
        {
          key: "state" as GateKey,
          failed: stateFail,
          label: "Discipline state is Out of Control",
          hint: "Run a recovery cycle to leave the locked band.",
        },
        {
          key: "score" as GateKey,
          failed: scoreFail,
          label: `Discipline score below 40 (currently ${score})`,
          hint: "Score must climb back above 40 to unlock.",
        },
      ];
    },
    [checklistConfirmed, disciplineState, score],
  );

  const failing = gates.filter((g) => g.failed);
  const primary = failing[0] ?? gates[0];
  const [idx, setIdx] = useState(0);

  // Deterministic cycle: 2.4s per gate, only across failing gates.
  useEffect(() => {
    if (reduceMotion || failing.length <= 1) {
      setIdx(0);
      return;
    }
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % failing.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, [reduceMotion, failing.length]);

  const active = failing.length > 0 ? failing[idx % failing.length] : primary;

  return (
    <div
      className="mt-3 flex items-start gap-2 rounded-xl bg-red-600/5 px-3 py-2 ring-1 ring-red-600/15"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="relative mt-1 inline-flex h-2 w-2 flex-none">
        {!reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute inline-flex h-full w-full rounded-full bg-red-500/70"
            animate={{ scale: [1, 2, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700">
          Why it’s still locked
        </div>
        <motion.div
          key={`${active.key}-${reduceMotion ? "static" : "anim"}`}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
          className="mt-0.5"
        >
          <div className="text-sm font-medium text-foreground">
            {active.label}
          </div>
          <div className="text-[11px] leading-snug text-foreground/65">
            {active.hint}
          </div>
        </motion.div>

        {/* Step dots — only render when there's more than one failing gate.
           Highlights the currently focused step. */}
        {failing.length > 1 && (
          <div className="mt-1.5 flex items-center gap-1">
            {failing.map((g, i) => (
              <span
                key={g.key}
                className={[
                  "h-1 rounded-full transition-all",
                  i === idx % failing.length
                    ? "w-4 bg-red-600/80"
                    : "w-1.5 bg-red-600/25",
                ].join(" ")}
                aria-hidden
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

function prettyState(s: string): string {
  if (s === "locked") return "Out of Control";
  if (s === "at_risk") return "At Risk";
  if (s === "slipping") return "Slipping";
  if (s === "in_control") return "In Control";
  return s;
}

type Tone = "red" | "ok" | "muted";

function Indicator({
  label,
  value,
  tone,
  icon: Icon,
  meta,
  reduceMotion = false,
}: {
  label: string;
  value: string;
  tone: Tone;
  icon: typeof Lock;
  meta?: string;
  reduceMotion?: boolean;
}) {
  const ring =
    tone === "red"
      ? "ring-red-600/25 bg-red-600/5 text-red-800"
      : tone === "ok"
        ? "ring-emerald-600/25 bg-emerald-600/5 text-emerald-800"
        : "ring-border bg-muted/40 text-foreground/80";
  const dotTone =
    tone === "red"
      ? "bg-red-500"
      : tone === "ok"
        ? "bg-emerald-500"
        : "bg-foreground/30";
  return (
    <div className={`relative flex items-start gap-2 rounded-xl p-3 ring-1 ${ring}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="relative inline-flex h-1.5 w-1.5">
            {tone !== "muted" && !reduceMotion && (
              <motion.span
                aria-hidden
                className={`absolute inline-flex h-full w-full rounded-full ${dotTone} opacity-60`}
                animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotTone}`} />
          </span>
          <div className="text-[10px] uppercase tracking-wide opacity-70">
            {label}
          </div>
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
        {meta && (
          <div className="text-[10px] opacity-70">{meta}</div>
        )}
      </div>
    </div>
  );
}

// Decorative floating particle field. Deterministic positions so SSR/CSR
// match and the layout doesn't shift.
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const seed = (i + 1) * 9301;
  const x = (seed % 97) / 97; // 0..1
  const y = ((seed * 7) % 89) / 89;
  const size = 2 + ((seed >> 2) % 4); // 2..5px
  const delay = (i % 7) * 0.4;
  const duration = 6 + ((seed >> 3) % 5); // 6..10s
  const drift = 12 + ((seed >> 1) % 18); // 12..29px
  return { x, y, size, delay, duration, drift };
});

function TechParticles() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-red-500/40"
          style={{
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            width: p.size,
            height: p.size,
            boxShadow: "0 0 8px 1px rgba(220,38,38,0.35)",
          }}
          animate={{
            y: [0, -p.drift, 0],
            opacity: [0.15, 0.6, 0.15],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

