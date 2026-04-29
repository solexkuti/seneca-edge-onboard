// Trading Journal Flow — 4-step capture system that writes a trade and a
// linked discipline log atomically to Supabase.
//
// Steps:
//   1. Trade Details
//   2. Discipline Check (4 rules)
//   3. Emotional State
//   4. Optional Reflection
//
// Calm, premium tone. Minimal typing. Full submission stays under ~20s.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import PreTradeIntercept from "./PreTradeIntercept";
import {
  SenecaScreen,
  SenecaHeader,
  MentorLine,
  PrimaryAction,
  SecondaryAction,
  FadeIn,
} from "@/components/seneca";
import { SenecaVoice } from "@/lib/senecaVoice";
import { useSenecaContext } from "@/hooks/useSenecaContext";
import { playFeedback } from "@/lib/feedback";
import { supabase } from "@/integrations/supabase/client";
import { useTraderState } from "@/hooks/useTraderState";
import {
  bumpPressureEscalation,
  evaluatePressure,
  logPressureEvent,
  type PressureEvaluation,
} from "@/lib/pressure";
import type {
  EmotionalState,
  MistakeTagValue,
  NewJournalSubmission,
  TradeDirection,
  TradeResult,
} from "@/lib/dbJournal";

// ───────── shared visuals ─────────

const ease = [0.22, 1, 0.36, 1] as const;

const STEP_LABELS = [
  "Trade",
  "Discipline",
  "State",
  "Reflection",
] as const;

// ───────── form state ─────────

type DraftDiscipline = {
  followed_entry: boolean | null;
  followed_exit: boolean | null;
  followed_risk: boolean | null;
  followed_behavior: boolean | null;
};

type Draft = {
  market: string;
  direction: TradeDirection | null;
  entry_price: string;
  stop_loss: string;
  take_profit: string;
  result: TradeResult | null;
  rr: string;
  discipline: DraftDiscipline;
  emotional_state: EmotionalState | null;
  notes: string;
  mistake_tag: MistakeTagValue | null;
};

const EMPTY_DRAFT: Draft = {
  market: "",
  direction: null,
  entry_price: "",
  stop_loss: "",
  take_profit: "",
  result: null,
  rr: "",
  discipline: {
    followed_entry: null,
    followed_exit: null,
    followed_risk: null,
    followed_behavior: null,
  },
  emotional_state: null,
  notes: "",
  mistake_tag: null,
};

// Background sync + local-first persistence live in `journalPendingQueue`.
import {
  enqueuePending,
  syncWithRetry,
} from "@/lib/journalPendingQueue";

// ───────── component ─────────

export default function TradingJournalFlow() {
  const navigate = useNavigate();
  const { trader: traderState } = useSenecaContext();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [doneScore, setDoneScore] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Pressure layer — evaluated when the user attempts to save the trade.
  const [pressure, setPressure] = useState<PressureEvaluation | null>(null);

  const canContinue = useMemo(() => {
    if (step === 0) return !!draft.market.trim() && !!draft.direction && !!draft.result;
    if (step === 1) {
      const d = draft.discipline;
      return (
        d.followed_entry !== null &&
        d.followed_exit !== null &&
        d.followed_risk !== null &&
        d.followed_behavior !== null
      );
    }
    if (step === 2) return !!draft.emotional_state;
    return true;
  }, [step, draft]);

  const handleNext = async () => {
    if (step < 3) {
      playFeedback("step");
      setStep((s) => (s + 1) as 0 | 1 | 2 | 3);
      return;
    }
    playFeedback("press");

    // ── Pressure intercept ──────────────────────────────────────────
    // Evaluate against the live TRADER_STATE. If active, render the
    // intercept and DO NOT submit until hold-to-confirm completes.
    const evalResult = evaluatePressure(traderState);
    if (evalResult.active) {
      bumpPressureEscalation();
      setPressure(evalResult);
      return;
    }
    await handleSubmit();
  };

  const handleInterceptConfirm = async () => {
    if (!pressure) return;
    await logPressureEvent({ evaluation: pressure, proceeded: true });
    setPressure(null);
    await handleSubmit();
  };

  const handleInterceptCancel = async () => {
    if (!pressure) return;
    await logPressureEvent({ evaluation: pressure, proceeded: false });
    setPressure(null);
    // Soft exit → route to mentor for explanation.
    navigate({ to: "/hub/mind" });
  };

  // Last analyzer event delta — used in post-action feedback.
  const lastDecisionDelta = useMemo(() => {
    const a = traderState.discipline.recent.find((d) => d.source === "analyzer");
    return a ? a.score_delta : null;
  }, [traderState.discipline.recent]);


  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSyncError(null);

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      const message = error?.message ?? "Sign in before saving journal entries.";
      console.error(error ?? message);
      showTemporaryError(message, setSyncError);
      setSubmitting(false);
      return;
    }

    const d = draft.discipline;
    const optimisticScore =
      ((d.followed_entry ? 1 : 0) +
        (d.followed_exit ? 1 : 0) +
        (d.followed_risk ? 1 : 0) +
        (d.followed_behavior ? 1 : 0)) *
      25;

    const payload: NewJournalSubmission = {
      user_id: data.session.user.id,
      executed_at: new Date().toISOString(),
      trade: {
        market: draft.market.trim().toUpperCase(),
        direction: draft.direction!,
        entry_price: parseNumOrNull(draft.entry_price),
        stop_loss: parseNumOrNull(draft.stop_loss),
        take_profit: parseNumOrNull(draft.take_profit),
        result: draft.result,
        rr: parseNumOrNull(draft.rr),
      },
      discipline: {
        followed_entry: !!d.followed_entry,
        followed_exit: !!d.followed_exit,
        followed_risk: !!d.followed_risk,
        followed_behavior: !!d.followed_behavior,
      },
      emotional_state: draft.emotional_state!,
      notes: draft.notes,
      mistake_tag: draft.mistake_tag,
    };

    // 1. Persist locally FIRST — never advance UI before backup is written.
    const pendingId = enqueuePending(payload);

    // 2. Now safe to move the user forward (optimistic UI).
    setDoneScore(optimisticScore);

    // 3. Sync in the background with silent retries.
    void syncWithRetry(pendingId, payload, { showToast: true });
    setSubmitting(false);
  };

  // ───────── confirmation screen ─────────
  if (doneScore !== null) {
    return (
      <FeatureShell
        eyebrow="Trading Journal"
        title="Logged."
        subtitle="Every entry sharpens the system."
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="rounded-2xl bg-card p-6 ring-1 ring-border shadow-soft"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-mix shadow-glow-primary">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
                Discipline score
              </p>
              <p className="text-[28px] font-bold leading-none text-text-primary">
                {doneScore}
                <span className="text-[16px] text-text-secondary">/100</span>
              </p>
            </div>
          </div>

          {/* Post-action: Discipline Impact (deterministic, < 300ms) */}
          <DisciplineImpactBanner
            executionDelta={doneScore}
            decisionDelta={lastDecisionDelta}
          />

          <p className="mt-5 text-[13.5px] leading-snug text-text-secondary">
            Saved locally. Sync status updates above.
          </p>

          <div className="mt-6 flex gap-2.5">
            <button
              onClick={() => {
                playFeedback("tap");
                setDraft(EMPTY_DRAFT);
                setStep(0);
                setDoneScore(null);
              }}
              className="flex-1 rounded-xl bg-text-primary/[0.04] px-4 py-3 text-[13.5px] font-semibold text-text-primary ring-1 ring-border transition-all hover:bg-text-primary/[0.07] active:scale-[0.99]"
            >
              Log another
            </button>
            <button
              onClick={() => {
                playFeedback("press");
                navigate({ to: "/hub" });
              }}
              className="flex-1 rounded-xl bg-gradient-primary px-4 py-3 text-[13.5px] font-semibold text-white shadow-glow-primary transition-transform active:scale-[0.99]"
            >
              Back to hub
            </button>
          </div>
        </motion.div>
      </FeatureShell>
    );
  }

  return (
    <>
      {pressure && (
        <PreTradeIntercept
          evaluation={pressure}
          onConfirm={handleInterceptConfirm}
          onCancel={handleInterceptCancel}
        />
      )}
    <FeatureShell
      eyebrow="Trading Journal"
      title="Log a trade."
      subtitle="Behavior first. Outcome second."
    >
      {/* Progress */}
      <div className="mb-5 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-gradient-primary" : "bg-border"
              }`}
            />
          </div>
        ))}
      </div>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
        Step {step + 1} of 4 · {STEP_LABELS[step]}
      </p>
      {syncError ? (
        <div className="mb-4 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-[12.5px] font-medium text-destructive ring-1 ring-destructive/20">
          {syncError}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease }}
        >
          {step === 0 ? (
            <StepTrade draft={draft} setDraft={setDraft} />
          ) : step === 1 ? (
            <StepDiscipline draft={draft} setDraft={setDraft} />
          ) : step === 2 ? (
            <StepEmotion draft={draft} setDraft={setDraft} />
          ) : (
            <StepReflection draft={draft} setDraft={setDraft} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer nav */}
      <div className="mt-6 flex items-center gap-2.5">
        {step > 0 ? (
          <button
            onClick={() => {
              playFeedback("back");
              setStep((s) => Math.max(0, s - 1) as 0 | 1 | 2 | 3);
            }}
            disabled={submitting}
            className="flex h-12 items-center gap-2 rounded-xl bg-text-primary/[0.04] px-4 text-[13.5px] font-semibold text-text-primary ring-1 ring-border transition-all hover:bg-text-primary/[0.08] active:scale-[0.99] disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
            Back
          </button>
        ) : null}

        <button
          onClick={handleNext}
          disabled={!canContinue || submitting}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 text-[14px] font-semibold text-white shadow-glow-primary transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting && step === 3 ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2.4} /> Saved ✓
            </>
          ) : step === 3 ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2.4} /> Save trade
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </>
          )}
        </button>
      </div>
    </FeatureShell>
    </>
  );
}

// ───────── Discipline Impact (post-action feedback, < 300ms) ─────────

function DisciplineImpactBanner({
  executionDelta,
  decisionDelta,
}: {
  executionDelta: number;
  decisionDelta: number | null;
}) {
  // Translate execution discipline_score (0–100) into a familiar +2 / 0 / -5 / -10
  // bucket so the user always sees a deterministic delta.
  const exec =
    executionDelta >= 100
      ? "+2"
      : executionDelta >= 75
        ? "0"
        : executionDelta >= 50
          ? "-5"
          : "-10";
  const tone: "ok" | "warn" | "danger" =
    executionDelta >= 75 ? "ok" : executionDelta >= 50 ? "warn" : "danger";
  const reason =
    executionDelta >= 100
      ? "All four rules followed — clean execution."
      : executionDelta >= 75
        ? "Mostly followed plan — minor slip."
        : executionDelta >= 50
          ? "Two rules broken — discipline impacted."
          : "Three or more rules broken — significant impact.";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className={`mt-4 rounded-xl px-3.5 py-3 ring-1 ${
        tone === "ok"
          ? "bg-emerald-500/[0.06] ring-emerald-500/25 text-emerald-900"
          : tone === "warn"
            ? "bg-amber-500/[0.07] ring-amber-500/30 text-amber-900"
            : "bg-red-600/[0.06] ring-red-600/30 text-red-900"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-80">
        Discipline impact
      </p>
      <p className="mt-1 text-[18px] font-bold tabular-nums leading-none">
        Execution {exec}
        {decisionDelta != null && (
          <span className="ml-2 text-[12px] font-semibold opacity-70">
            · last decision {decisionDelta >= 0 ? "+" : ""}{decisionDelta}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[12px] leading-snug opacity-90">{reason}</p>
    </motion.div>
  );
}

// ───────── Step 1: Trade ─────────

function StepTrade({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <div className="space-y-5">
      <Field label="Market">
        <input
          value={draft.market}
          onChange={(e) => setDraft({ ...draft, market: e.target.value })}
          placeholder="e.g. EURUSD"
          className="h-12 w-full rounded-xl bg-text-primary/[0.04] px-3.5 text-[14px] uppercase tracking-wide text-text-primary placeholder:text-text-secondary/60 ring-1 ring-border focus:outline-none focus:ring-brand/40"
        />
      </Field>

      <Field label="Direction">
        <div className="grid grid-cols-2 gap-2.5">
          <DirectionButton
            active={draft.direction === "long"}
            onClick={() => setDraft({ ...draft, direction: "long" })}
            icon={<TrendingUp className="h-4 w-4" strokeWidth={2.4} />}
            label="Long"
          />
          <DirectionButton
            active={draft.direction === "short"}
            onClick={() => setDraft({ ...draft, direction: "short" })}
            icon={<TrendingDown className="h-4 w-4" strokeWidth={2.4} />}
            label="Short"
          />
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Entry">
          <NumInput
            value={draft.entry_price}
            onChange={(v) => setDraft({ ...draft, entry_price: v })}
          />
        </Field>
        <Field label="Stop loss">
          <NumInput
            value={draft.stop_loss}
            onChange={(v) => setDraft({ ...draft, stop_loss: v })}
          />
        </Field>
        <Field label="Take profit">
          <NumInput
            value={draft.take_profit}
            onChange={(v) => setDraft({ ...draft, take_profit: v })}
          />
        </Field>
      </div>

      <Field label="Result">
        <div className="grid grid-cols-3 gap-2.5">
          {(["win", "loss", "breakeven"] as TradeResult[]).map((r) => (
            <ResultButton
              key={r}
              active={draft.result === r}
              onClick={() => setDraft({ ...draft, result: r })}
              label={r === "breakeven" ? "BE" : r.charAt(0).toUpperCase() + r.slice(1)}
              tone={r}
            />
          ))}
        </div>
      </Field>

      <Field label="R-multiple (optional)">
        <NumInput
          value={draft.rr}
          onChange={(v) => setDraft({ ...draft, rr: v })}
          placeholder="e.g. 1.5"
        />
      </Field>
    </div>
  );
}

// ───────── Step 2: Discipline ─────────

const RULES: Array<{ key: keyof DraftDiscipline; title: string; sub: string }> = [
  { key: "followed_entry", title: "Followed entry rule", sub: "Entered only on a valid setup." },
  { key: "followed_exit", title: "Followed exit rule", sub: "Closed where you said you would." },
  { key: "followed_risk", title: "Followed risk rule", sub: "Sized correctly. Stop respected." },
  { key: "followed_behavior", title: "Followed behavior rule", sub: "No revenge, no FOMO, no impulse." },
];

function StepDiscipline({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const set = (k: keyof DraftDiscipline, v: boolean) =>
    setDraft({ ...draft, discipline: { ...draft.discipline, [k]: v } });

  return (
    <div className="space-y-2.5">
      {RULES.map((r) => {
        const v = draft.discipline[r.key];
        return (
          <div
            key={r.key}
            className="rounded-xl bg-card px-4 py-3.5 ring-1 ring-border"
          >
            <p className="text-[14px] font-semibold tracking-tight text-text-primary">
              {r.title}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">
              {r.sub}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <YesNoButton
                active={v === true}
                tone="yes"
                onClick={() => set(r.key, true)}
                label="Yes"
                icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.3} />}
              />
              <YesNoButton
                active={v === false}
                tone="no"
                onClick={() => set(r.key, false)}
                label="No"
                icon={<XCircle className="h-4 w-4" strokeWidth={2.3} />}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────── Step 3: Emotion ─────────

const EMOTIONS: Array<{ key: EmotionalState; label: string; sub: string }> = [
  { key: "calm", label: "Calm", sub: "Grounded. In control." },
  { key: "fearful", label: "Fearful", sub: "Hesitant or anxious." },
  { key: "frustrated", label: "Frustrated", sub: "Impatient. Reactive." },
  { key: "overconfident", label: "Overconfident", sub: "Riding momentum too hard." },
  { key: "confused", label: "Confused", sub: "Unclear on the read." },
];

function StepEmotion({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <div className="space-y-2">
      <p className="mb-2 text-[13.5px] text-text-secondary">
        How did you feel during the trade?
      </p>
      {EMOTIONS.map((e) => {
        const active = draft.emotional_state === e.key;
        return (
          <button
            key={e.key}
            onClick={() => {
              playFeedback("tap");
              setDraft({ ...draft, emotional_state: e.key });
            }}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left ring-1 transition-all active:scale-[0.99] ${
              active
                ? "bg-gradient-mix text-white ring-transparent shadow-glow-primary"
                : "bg-card text-text-primary ring-border hover:bg-text-primary/[0.04]"
            }`}
          >
            <div>
              <p className="text-[14px] font-semibold tracking-tight">
                {e.label}
              </p>
              <p
                className={`mt-0.5 text-[12px] ${
                  active ? "text-white/85" : "text-text-secondary"
                }`}
              >
                {e.sub}
              </p>
            </div>
            {active ? (
              <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ───────── Step 4: Reflection ─────────

const MISTAKE_TAGS: Array<{ key: MistakeTagValue; label: string }> = [
  { key: "fomo", label: "FOMO" },
  { key: "revenge", label: "Revenge trade" },
  { key: "overleveraged", label: "Overleveraged" },
  { key: "early_exit", label: "Early exit" },
  { key: "late_entry", label: "Late entry" },
  { key: "no_setup", label: "No clear setup" },
  { key: "emotional", label: "Emotional decision" },
];

function StepReflection({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[14px] font-semibold tracking-tight text-text-primary">
          Tag a behavioral mistake (optional)
        </p>
        <p className="mb-3 text-[12px] leading-snug text-text-secondary">
          Captures the psychological trigger behind the trade. Skip if none applies.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MISTAKE_TAGS.map((t) => {
            const active = draft.mistake_tag === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  playFeedback("tap");
                  setDraft({
                    ...draft,
                    mistake_tag: active ? null : t.key,
                  });
                }}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition-all active:scale-[0.98] ${
                  active
                    ? "bg-gradient-mix text-white ring-transparent shadow-glow-primary"
                    : "bg-text-primary/[0.04] text-text-primary ring-border hover:bg-text-primary/[0.08]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[14px] font-semibold tracking-tight text-text-primary">
          What happened here?
        </p>
        <p className="mb-3 text-[12.5px] leading-snug text-text-secondary">
          Optional. One or two lines is enough — write the truth.
        </p>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="e.g. Took it too early before the retest. Felt the pressure to be in."
          rows={5}
          className="w-full resize-none rounded-xl bg-text-primary/[0.04] px-3.5 py-3 text-[13.5px] leading-snug text-text-primary placeholder:text-text-secondary/60 ring-1 ring-border focus:outline-none focus:ring-brand/40"
        />
      </div>
    </div>
  );
}

// ───────── shared atoms ─────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
        {label}
      </p>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ""))}
      placeholder={placeholder ?? "—"}
      className="h-12 w-full rounded-xl bg-text-primary/[0.04] px-3 text-[13.5px] text-text-primary placeholder:text-text-secondary/60 ring-1 ring-border focus:outline-none focus:ring-brand/40"
    />
  );
}

function DirectionButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={() => {
        playFeedback("tap");
        onClick();
      }}
      className={`flex h-12 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold tracking-tight ring-1 transition-all active:scale-[0.98] ${
        active
          ? "bg-gradient-primary text-white ring-transparent shadow-glow-primary"
          : "bg-card text-text-primary ring-border hover:bg-text-primary/[0.04]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ResultButton({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: TradeResult;
}) {
  const activeStyles =
    tone === "win"
      ? "bg-emerald-500/90 text-white ring-transparent shadow-soft"
      : tone === "loss"
        ? "bg-rose-500/90 text-white ring-transparent shadow-soft"
        : "bg-amber-500/90 text-white ring-transparent shadow-soft";
  return (
    <button
      onClick={() => {
        playFeedback("tap");
        onClick();
      }}
      className={`h-11 rounded-xl text-[13.5px] font-semibold tracking-tight ring-1 transition-all active:scale-[0.98] ${
        active
          ? activeStyles
          : "bg-card text-text-primary ring-border hover:bg-text-primary/[0.04]"
      }`}
    >
      {label}
    </button>
  );
}

function YesNoButton({
  active,
  tone,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  tone: "yes" | "no";
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  const on =
    tone === "yes"
      ? "bg-emerald-500/90 text-white ring-transparent shadow-soft"
      : "bg-rose-500/90 text-white ring-transparent shadow-soft";
  return (
    <button
      onClick={() => {
        playFeedback("tap");
        onClick();
      }}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold ring-1 transition-all active:scale-[0.98] ${
        active
          ? on
          : "bg-text-primary/[0.04] text-text-primary ring-border hover:bg-text-primary/[0.08]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function parseNumOrNull(v: string): number | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function showTemporaryError(
  message: string,
  setSyncError: React.Dispatch<React.SetStateAction<string | null>>,
) {
  setSyncError(message);
  toast.error("Journal sync failed", { description: message });
  window.setTimeout(() => setSyncError(null), 8000);
}
