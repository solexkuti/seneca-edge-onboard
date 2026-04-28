// AnalyzerLockScreen — strict lock UI for the Chart Analyzer.
//
// Renders ONLY when:
//   discipline.state === "locked"     OR
//   session.checklist_confirmed === false
//
// No analyzer UI behind it. No upload. No drag/drop. No API call.
// Real-time recheck: subscribes to TRADER_STATE — when the user fixes their
// state, this component automatically unmounts (no refresh required).

import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Lock,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { useTraderState } from "@/hooks/useTraderState";
import { logLockAttempt, type LockAttemptReason } from "@/lib/lockAttempts";

type Props = { children: React.ReactNode };

export default function AnalyzerLockScreen({ children }: Props) {
  const { state } = useTraderState();
  const navigate = useNavigate();
  const lastLoggedKeyRef = useRef<string | null>(null);

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

      {/* Ambient tech particles — pure decoration, non-interactive. */}
      <TechParticles />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[640px] items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full rounded-2xl bg-card p-7 ring-1 ring-border shadow-card-premium"
        >
          {/* Icon + eyebrow */}
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-red-600/10 ring-1 ring-red-600/20">
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl bg-red-600/25"
              animate={{ opacity: [0.15, 0.45, 0.15], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
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

          {/* State indicators */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Indicator
              label="Discipline state"
              value={prettyState(state.discipline.state)}
              tone={isDiscipline ? "red" : "muted"}
              icon={ShieldAlert}
              meta={`${state.discipline.score}/100`}
            />
            <Indicator
              label="Checklist"
              value={state.session.checklist_confirmed ? "Confirmed" : "Not confirmed"}
              tone={state.session.checklist_confirmed ? "ok" : "red"}
              icon={state.session.checklist_confirmed ? ShieldCheck : Lock}
            />
          </div>

          {/* Structured lock reasons — one bullet per gate, showing
             expected vs actual so the user knows exactly what changed. */}
          <div className="mt-4 rounded-xl bg-red-600/5 p-3 ring-1 ring-red-600/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-none text-red-700" aria-hidden />
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700">
                Why you're locked
              </div>
            </div>
            <ul className="mt-2 space-y-1.5">
              <ReasonBullet
                failed={state.discipline.score < 40 || state.discipline.state === "locked"}
                label="Discipline score"
                expected="≥ 40 required"
                actual={`${state.discipline.score}/100 · ${prettyState(state.discipline.state)}`}
              />
              <ReasonBullet
                failed={!state.session.checklist_confirmed}
                label="Daily checklist"
                expected="Must be confirmed"
                actual={state.session.checklist_confirmed ? "Confirmed" : "Not confirmed today"}
              />
            </ul>
          </div>

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
        </motion.div>
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
}: {
  label: string;
  value: string;
  tone: Tone;
  icon: typeof Lock;
  meta?: string;
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
            {tone !== "muted" && (
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
