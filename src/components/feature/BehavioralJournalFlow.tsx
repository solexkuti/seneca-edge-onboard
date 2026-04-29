// BehavioralJournalFlow — clean 5-step trade logging.
//
// Steps:
//   1. Result   (asset + R)
//   2. Mistakes (multi-select fixed list)
//   3. Note     (optional) + screenshot
//   4. Submit → applies score delta, updates streaks
//   5. Feedback card (mandatory: shows reason, delta, before → after)
//
// Calm dark premium UI. No blocking, no enforcement.

import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  MISTAKES,
  classify,
  disciplineState,
  logTrade,
  type Classification,
  type MistakeId,
} from "@/lib/behavioralJournal";

const ease = [0.22, 1, 0.36, 1] as const;

const CLASS_TONE: Record<Classification, { label: string; tone: string; chip: string }> = {
  clean:  { label: "Clean trade",     tone: "text-emerald-300", chip: "bg-emerald-500/10 ring-emerald-500/20 text-emerald-300" },
  minor:  { label: "Minor mistake",   tone: "text-amber-300",   chip: "bg-amber-500/10 ring-amber-500/20 text-amber-300" },
  bad:    { label: "Bad trade",       tone: "text-orange-300",  chip: "bg-orange-500/10 ring-orange-500/20 text-orange-300" },
  severe: { label: "Severe violation",tone: "text-rose-300",    chip: "bg-rose-500/10 ring-rose-500/20 text-rose-300" },
};

type Step = 0 | 1 | 2 | 3;

type FeedbackPayload = {
  classification: Classification;
  reasonLabel: string;
  delta: number;
  scoreBefore: number;
  scoreAfter: number;
  cleanStreakAfter: number;
  breakStreakAfter: number;
};

export default function BehavioralJournalFlow({
  onLogged,
}: {
  onLogged?: () => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [asset, setAsset] = useState("");
  const [resultStr, setResultStr] = useState("");
  const [mistakes, setMistakes] = useState<MistakeId[]>([]);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resultR = useMemo(() => {
    const cleaned = resultStr.replace(/[+rR\s]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }, [resultStr]);

  const previewClass = useMemo(() => classify(mistakes), [mistakes]);

  const canNextFromStep0 = asset.trim().length > 0 && Number.isFinite(resultR);

  function pickFile(f: File | null) {
    if (!f) {
      setFile(null);
      setFilePreview(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Screenshot must be an image.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Screenshot must be under 8MB.");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview((e.target?.result as string) ?? null);
    reader.readAsDataURL(f);
  }

  function toggleMistake(id: MistakeId) {
    setMistakes((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (!canNextFromStep0 || submitting) return;
    setSubmitting(true);
    try {
      const r = await logTrade({
        asset,
        result_r: resultR,
        mistakes,
        note,
        screenshotFile: file,
      });
      setFeedback({
        classification: r.classification,
        reasonLabel: r.reasonLabel,
        delta: r.delta,
        scoreBefore: r.scoreBefore,
        scoreAfter: r.scoreAfter,
        cleanStreakAfter: r.cleanStreakAfter,
        breakStreakAfter: r.breakStreakAfter,
      });
      onLogged?.();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to log trade");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(0);
    setAsset("");
    setResultStr("");
    setMistakes([]);
    setNote("");
    setFile(null);
    setFilePreview(null);
    setFeedback(null);
  }

  // ── FEEDBACK CARD ────────────────────────────────────────
  if (feedback) {
    const ds = disciplineState(feedback.scoreAfter);
    const ct = CLASS_TONE[feedback.classification];
    return (
      <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-50" />
        <div className="relative z-10 mx-auto w-full max-w-[480px] px-5 pt-12 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="rounded-2xl bg-card ring-1 ring-border p-6"
          >
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ${ct.chip}`}
              >
                {ct.label}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                Logged
              </span>
            </div>

            <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
              Reason
            </p>
            <p className="mt-1 text-[15px] font-medium text-text-primary">
              {feedback.reasonLabel}
            </p>

            <div className="mt-6 flex items-end gap-3">
              <span
                className={`text-[44px] font-semibold leading-none tabular-nums ${ct.tone}`}
              >
                {feedback.delta > 0 ? "+" : ""}
                {feedback.delta}
              </span>
              <span className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.22em] text-text-secondary/55">
                Discipline change
              </span>
            </div>

            <div className="mt-6 rounded-xl bg-background/60 ring-1 ring-border px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.18em] text-text-secondary/70">
                  Score
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-text-secondary/60">
                  {ds.label}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-[22px] font-semibold tabular-nums text-text-secondary/70 line-through decoration-text-secondary/40">
                  {feedback.scoreBefore}
                </span>
                <ArrowRight className="h-4 w-4 text-text-secondary/60" />
                <span className={`text-[28px] font-semibold tabular-nums ${ct.tone}`}>
                  {feedback.scoreAfter}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Clean streak" value={`${feedback.cleanStreakAfter}`} />
              <Stat label="Break streak" value={`${feedback.breakStreakAfter}`} />
            </div>

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-full bg-card-elevated ring-1 ring-border px-4 py-3 text-[12.5px] font-semibold text-text-primary active:scale-[0.98] transition"
              >
                Log another
              </button>
              <Link
                to="/hub"
                className="flex-1 rounded-full bg-primary/15 ring-1 ring-primary/30 px-4 py-3 text-center text-[12.5px] font-semibold text-text-primary active:scale-[0.98] transition"
              >
                Back to dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── INPUT FLOW ───────────────────────────────────────────
  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-50" />

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-5 pt-8 pb-28">
        <header className="flex items-center justify-between">
          <Link
            to="/hub"
            className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary/70 hover:text-text-primary"
          >
            ← Cancel
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
            Log trade · {step + 1}/4
          </span>
        </header>

        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-colors ${i <= step ? "bg-primary/60" : "bg-text-primary/[0.06]"}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.section
              key="step-result"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3, ease }}
              className="mt-8"
            >
              <h1 className="text-[20px] font-semibold tracking-tight text-text-primary">
                What did you trade?
              </h1>
              <p className="mt-1.5 text-[12.5px] text-text-secondary">
                Asset and result in R-multiples.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Asset">
                  <input
                    autoFocus
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    placeholder="EURUSD, NAS100, BTC…"
                    className="w-full bg-transparent text-[16px] font-medium text-text-primary outline-none placeholder:text-text-secondary/40"
                  />
                </Field>
                <Field label="Result (R)">
                  <input
                    value={resultStr}
                    onChange={(e) => setResultStr(e.target.value)}
                    placeholder="e.g. 1.5  or  -1"
                    inputMode="decimal"
                    className="w-full bg-transparent text-[16px] font-medium text-text-primary outline-none placeholder:text-text-secondary/40"
                  />
                </Field>
              </div>
            </motion.section>
          )}

          {step === 1 && (
            <motion.section
              key="step-mistakes"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3, ease }}
              className="mt-8"
            >
              <h1 className="text-[20px] font-semibold tracking-tight text-text-primary">
                Any rules broken?
              </h1>
              <p className="mt-1.5 text-[12.5px] text-text-secondary">
                Tap every mistake. None = clean trade. Only the worst severity counts.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2">
                {MISTAKES.map((m) => {
                  const active = mistakes.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMistake(m.id)}
                      className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-left transition active:scale-[0.98] ring-1 ${
                        active
                          ? m.severe
                            ? "bg-rose-500/10 ring-rose-500/30 text-rose-200"
                            : "bg-amber-500/10 ring-amber-500/30 text-amber-200"
                          : "bg-card ring-border text-text-primary hover:bg-text-primary/[0.03]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md ring-1 ${
                          active
                            ? m.severe
                              ? "bg-rose-400/30 ring-rose-400/60"
                              : "bg-amber-400/30 ring-amber-400/60"
                            : "ring-border"
                        }`}
                      >
                        {active && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold leading-tight">
                          {m.label}
                        </p>
                        {m.severe && (
                          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-rose-300/75">
                            Severe
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl bg-card/60 ring-1 ring-border px-4 py-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.18em] text-text-secondary/70">
                  Preview
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${CLASS_TONE[previewClass.classification].chip}`}
                  >
                    {CLASS_TONE[previewClass.classification].label}
                  </span>
                  <span
                    className={`text-[16px] font-semibold tabular-nums ${CLASS_TONE[previewClass.classification].tone}`}
                  >
                    {previewClass.delta > 0 ? "+" : ""}
                    {previewClass.delta}
                  </span>
                </span>
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="step-note"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3, ease }}
              className="mt-8"
            >
              <h1 className="text-[20px] font-semibold tracking-tight text-text-primary">
                Anything to remember?
              </h1>
              <p className="mt-1.5 text-[12.5px] text-text-secondary">
                Optional note and screenshot.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Note">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="What went well, what slipped…"
                    className="w-full resize-none bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-secondary/40"
                  />
                </Field>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                    Screenshot
                  </p>
                  {filePreview ? (
                    <div className="mt-2 relative rounded-xl overflow-hidden ring-1 ring-border">
                      <img
                        src={filePreview}
                        alt="Trade screenshot"
                        className="block w-full h-44 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => pickFile(null)}
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 ring-1 ring-border text-text-primary"
                        aria-label="Remove screenshot"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 w-full rounded-xl bg-card ring-1 ring-border px-4 py-5 flex items-center justify-center gap-2 text-text-secondary text-[12.5px] font-medium hover:bg-text-primary/[0.03] transition"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Add screenshot
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="step-confirm"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3, ease }}
              className="mt-8"
            >
              <h1 className="text-[20px] font-semibold tracking-tight text-text-primary">
                Confirm
              </h1>
              <p className="mt-1.5 text-[12.5px] text-text-secondary">
                Review before saving.
              </p>

              <div className="mt-6 rounded-2xl bg-card ring-1 ring-border p-5 space-y-3">
                <Row k="Asset" v={asset.toUpperCase()} />
                <Row
                  k="Result"
                  v={`${resultR > 0 ? "+" : ""}${resultR.toFixed(2)}R`}
                  tone={resultR >= 0 ? "ok" : "risk"}
                />
                <Row
                  k="Mistakes"
                  v={mistakes.length === 0 ? "None" : `${mistakes.length}`}
                />
                <Row
                  k="Classification"
                  v={CLASS_TONE[previewClass.classification].label}
                />
                <Row
                  k="Score change"
                  v={`${previewClass.delta > 0 ? "+" : ""}${previewClass.delta}`}
                  tone={previewClass.delta >= 0 ? "ok" : "risk"}
                />
                {file && <Row k="Screenshot" v="Attached" />}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Nav */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => (Math.max(0, s - 1) as Step))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold text-text-secondary disabled:opacity-30 hover:text-text-primary transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (Math.min(3, s + 1) as Step))}
              disabled={step === 0 && !canNextFromStep0}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 ring-1 ring-primary/30 px-5 py-2.5 text-[12.5px] font-semibold text-text-primary disabled:opacity-30 active:scale-[0.98] transition"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !canNextFromStep0}
              className="inline-flex items-center gap-2 rounded-full bg-primary/20 ring-1 ring-primary/40 px-5 py-2.5 text-[12.5px] font-semibold text-text-primary disabled:opacity-30 active:scale-[0.98] transition"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? "Saving…" : "Save trade"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-xl bg-card ring-1 ring-border px-4 py-3.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/60 ring-1 ring-border px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums text-text-primary">
        {value}
      </p>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "ok" | "risk" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11.5px] uppercase tracking-[0.16em] text-text-secondary/70">
        {k}
      </span>
      <span
        className={`text-[13.5px] font-semibold tabular-nums ${
          tone === "ok"
            ? "text-emerald-300"
            : tone === "risk"
              ? "text-rose-300"
              : "text-text-primary"
        }`}
      >
        {v}
      </span>
    </div>
  );
}
