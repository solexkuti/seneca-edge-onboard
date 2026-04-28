// RecoveryFlow — deterministic 3-step gate from LOCKED → at_risk.
//
// Screen 1: Forced Reflection (last violation summary + 3 questions)
// Screen 2: Strategy Re-Commit (acknowledge each rule area)
// Screen 3: Cooldown Timer (DB-backed, default 15 min)
//
// While this flow is active, all other modules are blocked via TraderStateGate.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Lock,
  ShieldAlert,
  ShieldCheck,
  Brain,
  Hourglass,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useTraderState } from "@/hooks/useTraderState";
import {
  ensureActiveRecoverySession,
  submitReflection,
  submitRecommit,
  completeCooldown,
  getLastViolation,
  type RecoverySession,
  type LastViolation,
  type RecoveryStep,
} from "@/lib/recovery";

type Phase = "loading" | "reflection" | "recommit" | "cooldown" | "done";

const STEPS: { key: RecoveryStep; label: string }[] = [
  { key: "reflection", label: "Reflect" },
  { key: "recommit", label: "Recommit" },
  { key: "cooldown", label: "Cooldown" },
];

export default function RecoveryFlow() {
  const { state, refresh } = useTraderState();
  const navigate = useNavigate();

  const [session, setSession] = useState<RecoverySession | null>(null);
  const [violation, setViolation] = useState<LastViolation | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [bootError, setBootError] = useState<string | null>(null);

  // If the user lands here without being in a locked or in_recovery state,
  // bounce them to the hub. /hub/recovery is NOT optional — but it's also
  // not voluntary.
  useEffect(() => {
    if (state.loading) return;
    const needsRecovery =
      state.blocks.discipline_locked || state.blocks.in_recovery;
    if (!needsRecovery && phase === "loading") {
      void navigate({ to: "/hub", replace: true });
    }
  }, [state.loading, state.blocks, navigate, phase]);

  // Boot: ensure an active recovery session and load the last violation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, v] = await Promise.all([
          ensureActiveRecoverySession(),
          getLastViolation(),
        ]);
        if (cancelled) return;
        setSession(s);
        setViolation(v);
        if (s) {
          setPhase(
            s.cooldown_completed
              ? "done"
              : s.recommit_completed
                ? "cooldown"
                : s.reflection_completed
                  ? "recommit"
                  : "reflection",
          );
        }
      } catch (e) {
        setBootError(e instanceof Error ? e.message : "Failed to start recovery");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "loading") {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bootError) {
    return (
      <Shell>
        <div className="rounded-xl bg-red-600/5 p-4 ring-1 ring-red-600/20 text-sm text-red-900">
          {bootError}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header
        score={state.discipline.score}
        breaks={state.discipline.consecutive_breaks}
      />

      <Progress phase={phase} />

      {phase === "reflection" && session && (
        <ReflectionStep
          session={session}
          violation={violation}
          onDone={(s) => {
            setSession(s);
            setPhase("recommit");
            void refresh();
          }}
        />
      )}

      {phase === "recommit" && session && (
        <RecommitStep
          session={session}
          rules={state.strategy?.rules ?? null}
          onDone={(s) => {
            setSession(s);
            setPhase("cooldown");
            void refresh();
          }}
        />
      )}

      {phase === "cooldown" && session && (
        <CooldownStep
          session={session}
          onDone={(s) => {
            setSession(s);
            setPhase("done");
            void refresh();
          }}
        />
      )}

      {phase === "done" && (
        <DoneStep
          onContinue={() => {
            void refresh();
            void navigate({ to: "/hub", replace: true });
          }}
        />
      )}

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        Recovery is not punishment. It is forced awareness → recommitment →
        controlled re-entry. There is no AI override.
      </p>
    </Shell>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[640px] flex-col justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full rounded-2xl bg-card p-7 ring-1 ring-border shadow-card-premium"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

function Header({ score, breaks }: { score: number; breaks: number }) {
  return (
    <>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600/10 ring-1 ring-red-600/20">
        <Lock className="h-5 w-5 text-red-700" aria-hidden />
      </div>
      <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-700">
        Recovery Required
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Earn back control.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">
        Your discipline score is {score}/100 with {breaks} consecutive
        violation{breaks === 1 ? "" : "s"}. Trading is fully blocked. Complete
        the three steps below to return to a controlled state.
      </p>
    </>
  );
}

function Progress({ phase }: { phase: Phase }) {
  const idx =
    phase === "reflection"
      ? 0
      : phase === "recommit"
        ? 1
        : phase === "cooldown"
          ? 2
          : 3;
  return (
    <div className="mt-6 flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ${
                done
                  ? "bg-emerald-600/15 text-emerald-700 ring-emerald-600/30"
                  : active
                    ? "bg-primary/15 text-primary ring-primary/30"
                    : "bg-muted/40 text-muted-foreground ring-border"
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <div
              className={`text-[11px] font-medium ${
                active
                  ? "text-foreground"
                  : done
                    ? "text-emerald-700"
                    : "text-muted-foreground"
              }`}
            >
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-border" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Reflection ──────────────────────────────────────────────────

function ReflectionStep({
  session,
  violation,
  onDone,
}: {
  session: RecoverySession;
  violation: LastViolation | null;
  onDone: (s: RecoverySession) => void;
}) {
  const allowed = useMemo(
    () => violation?.rules_broken ?? ["entry", "exit", "risk", "behavior"],
    [violation],
  );
  const [match, setMatch] = useState("");
  const [why, setWhy] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const res = await submitReflection(
      session.id,
      { violation_match: match, why, next_action: next },
      allowed,
    );
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone(res.session);
  };

  return (
    <section className="mt-6">
      <SectionHeading icon={Brain} title="Step 1 — Forced Reflection" />

      <div className="mt-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Last violation detected
        </div>
        <div className="mt-1 text-sm font-medium text-foreground">
          {violation
            ? `Score impact ${violation.score_delta} • ${new Date(violation.created_at).toLocaleString()}`
            : "No specific violation found — answer against your last bad decision."}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allowed.map((r) => (
            <span
              key={r}
              className="rounded-full bg-red-600/10 px-2 py-0.5 text-[11px] font-medium text-red-800 ring-1 ring-red-600/20"
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      <Field label="1. What rule did you break? (must match a tag above)">
        <select
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Select…</option>
          {allowed.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      <Field label="2. Why did you break it?">
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          rows={3}
          placeholder="Be honest. Min 20 characters."
          className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"
        />
        <CharCount value={why} min={20} />
      </Field>

      <Field label="3. What will you do differently next trade?">
        <textarea
          value={next}
          onChange={(e) => setNext(e.target.value)}
          rows={3}
          placeholder="Concrete action. Min 20 characters."
          className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"
        />
        <CharCount value={next} min={20} />
      </Field>

      {error && (
        <div className="mt-3 rounded-lg bg-red-600/5 p-2 text-xs text-red-900 ring-1 ring-red-600/20">
          {error}
        </div>
      )}

      <PrimaryButton onClick={submit} disabled={submitting}>
        {submitting ? "Saving…" : "Continue to Recommit"}
        <ArrowRight className="h-4 w-4" />
      </PrimaryButton>
    </section>
  );
}

// ── Step 2: Recommit ────────────────────────────────────────────────────

function RecommitStep({
  session,
  rules,
  onDone,
}: {
  session: RecoverySession;
  rules: { entry: string[]; risk: string[]; behavior: string[]; confirmation: string[]; context: string[] } | null;
  onDone: (s: RecoverySession) => void;
}) {
  const [acks, setAcks] = useState({
    entry: false,
    exit: false,
    risk: false,
    behavior: false,
  });
  const [commitment, setCommitment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // "exit" maps to the user's confirmation rules in our schema.
  const ruleSets = {
    entry: rules?.entry ?? [],
    exit: rules?.confirmation ?? [],
    risk: rules?.risk ?? [],
    behavior: rules?.behavior ?? [],
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const res = await submitRecommit(session.id, { ...acks, commitment });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone(res.session);
  };

  return (
    <section className="mt-6">
      <SectionHeading icon={ShieldCheck} title="Step 2 — Strategy Recommit" />
      <p className="mt-2 text-xs text-muted-foreground">
        Re-confirm every rule area from your locked strategy. No skip allowed.
      </p>

      <div className="mt-3 space-y-2">
        {(["entry", "exit", "risk", "behavior"] as const).map((k) => (
          <RuleCard
            key={k}
            title={`${k.toUpperCase()} rules`}
            items={ruleSets[k]}
            checked={acks[k]}
            onChange={(v) => setAcks((a) => ({ ...a, [k]: v }))}
          />
        ))}
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-xl bg-primary/5 p-3 ring-1 ring-primary/20">
        <input
          type="checkbox"
          checked={commitment}
          onChange={(e) => setCommitment(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span className="text-sm font-medium text-foreground">
          I will follow this exactly.
        </span>
      </label>

      {error && (
        <div className="mt-3 rounded-lg bg-red-600/5 p-2 text-xs text-red-900 ring-1 ring-red-600/20">
          {error}
        </div>
      )}

      <PrimaryButton onClick={submit} disabled={submitting}>
        {submitting ? "Saving…" : "Start Cooldown"}
        <ArrowRight className="h-4 w-4" />
      </PrimaryButton>
    </section>
  );
}

function RuleCard({
  title,
  items,
  checked,
  onChange,
}: {
  title: string;
  items: string[];
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition ${
        checked
          ? "bg-emerald-600/5 ring-emerald-600/30"
          : "bg-muted/40 ring-border hover:bg-muted/60"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 flex-none"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {title}
        </div>
        {items.length === 0 ? (
          <div className="mt-1 text-xs italic text-muted-foreground">
            No specific rules captured — re-confirm by intent.
          </div>
        ) : (
          <ul className="mt-1 list-disc pl-4 text-xs text-foreground/85">
            {items.slice(0, 5).map((it, i) => (
              <li key={i}>{it}</li>
            ))}
            {items.length > 5 && (
              <li className="list-none text-muted-foreground">
                +{items.length - 5} more
              </li>
            )}
          </ul>
        )}
      </div>
    </label>
  );
}

// ── Step 3: Cooldown ────────────────────────────────────────────────────

function CooldownStep({
  session,
  onDone,
}: {
  session: RecoverySession;
  onDone: (s: RecoverySession) => void;
}) {
  const endsAt = useMemo(
    () => (session.cooldown_ends_at ? new Date(session.cooldown_ends_at) : null),
    [session.cooldown_ends_at],
  );
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const remainingMs = endsAt ? Math.max(0, endsAt.getTime() - now.getTime()) : 0;
  const totalMs = (session.cooldown_seconds ?? 900) * 1000;
  const elapsed = totalMs - remainingMs;
  const pct = Math.max(0, Math.min(100, (elapsed / totalMs) * 100));
  const ready = remainingMs <= 0;

  const finish = async () => {
    if (!ready) return;
    setFinishing(true);
    setError(null);
    const res = await completeCooldown(session.id);
    setFinishing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone(res.session);
  };

  const m = Math.floor(remainingMs / 60000);
  const s = Math.floor((remainingMs % 60000) / 1000);

  return (
    <section className="mt-6">
      <SectionHeading icon={Hourglass} title="Step 3 — Cooldown" />
      <p className="mt-2 text-xs text-muted-foreground italic">
        “Control is rebuilt through patience.”
      </p>

      <div className="mt-4 rounded-2xl bg-muted/40 p-5 ring-1 ring-border">
        <div className="text-center font-mono text-4xl font-semibold tabular-nums text-foreground">
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-primary transition-[width] duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 text-center text-[11px] text-muted-foreground">
          Analyzer, journal, and checklist remain blocked until the timer
          completes.
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-600/5 p-2 text-xs text-red-900 ring-1 ring-red-600/20">
          {error}
        </div>
      )}

      <PrimaryButton onClick={finish} disabled={!ready || finishing}>
        {finishing
          ? "Unlocking…"
          : ready
            ? "Complete Recovery"
            : "Wait for cooldown"}
        <ArrowRight className="h-4 w-4" />
      </PrimaryButton>
    </section>
  );
}

// ── Done ────────────────────────────────────────────────────────────────

function DoneStep({ onContinue }: { onContinue: () => void }) {
  return (
    <section className="mt-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/10 ring-1 ring-emerald-600/20">
        <ShieldAlert className="h-5 w-5 text-emerald-700" aria-hidden />
      </div>
      <h2 className="mt-3 text-xl font-semibold text-foreground">
        Recovery complete — probation active.
      </h2>
      <p className="mt-2 text-sm text-foreground/85">
        You are now in <span className="font-semibold">at_risk</span>, not
        in_control. Your next 2 trades must each score ≥ 75. Any failure
        re-locks the system instantly.
      </p>
      <PrimaryButton onClick={onContinue}>
        Continue to Hub <ArrowRight className="h-4 w-4" />
      </PrimaryButton>
    </section>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: typeof Lock;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
      </div>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-xs font-medium text-foreground">{label}</div>
      {children}
    </div>
  );
}

function CharCount({ value, min }: { value: string; min: number }) {
  const ok = value.trim().length >= min;
  return (
    <div
      className={`mt-1 text-[10px] ${ok ? "text-emerald-700" : "text-muted-foreground"}`}
    >
      {value.trim().length}/{min} min
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
