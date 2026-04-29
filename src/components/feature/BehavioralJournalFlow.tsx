// BehavioralJournalFlow — clean 4-step trade logging.
//
// Steps (kept structure intact, extended fields):
//   1. Trade   (asset/pair + market + direction + entry/exit/SL/TP + risk% + R)
//   2. Mistakes (multi-select fixed list)
//   3. Note     (optional) + confidence (1–5) + screenshot
//   4. Confirm  → applies score delta, updates streaks, ALSO writes to trade_logs
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
  TrendingDown,
  TrendingUp,
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
import {
  insertTradeLog,
  deriveRR,
  realizedR,
  derivePnlPercent,
  sessionTagFor,
  type Direction,
  type Market,
  type Outcome,
} from "@/lib/tradeLogs";
import { supabase } from "@/integrations/supabase/client";

const ease = [0.22, 1, 0.36, 1] as const;

type ScreenshotTag = "none" | "entry" | "exit" | "htf";
const SCREENSHOT_TAGS: { id: ScreenshotTag; label: string }[] = [
  { id: "none", label: "Untagged" },
  { id: "entry", label: "Entry" },
  { id: "exit", label: "Exit" },
  { id: "htf", label: "HTF" },
];
const MAX_SCREENSHOTS = 5;

const CLASS_TONE: Record<Classification, { label: string; tone: string; chip: string }> = {
  clean:  { label: "Clean execution", tone: "text-emerald-300", chip: "bg-emerald-500/10 ring-emerald-500/20 text-emerald-300" },
  minor:  { label: "Minor slip",      tone: "text-amber-300",   chip: "bg-amber-500/10 ring-amber-500/20 text-amber-300" },
  bad:    { label: "Mistake",         tone: "text-orange-300",  chip: "bg-orange-500/10 ring-orange-500/20 text-orange-300" },
  severe: { label: "Major slip",      tone: "text-rose-300",    chip: "bg-rose-500/10 ring-rose-500/20 text-rose-300" },
};

const MARKET_OPTIONS: { id: Market; label: string }[] = [
  { id: "forex", label: "Forex" },
  { id: "crypto", label: "Crypto" },
  { id: "indices", label: "Indices" },
  { id: "stocks", label: "Stocks" },
  { id: "metals", label: "Metals" },
  { id: "other", label: "Other" },
];

type Step = 0 | 1 | 2 | 3;

type FeedbackPayload = {
  classification: Classification;
  reasonLabel: string;
  /** Per-trade score (0..100) for this trade. */
  perTradeScore: number;
  /** Overall AVERAGE score before this trade — null when this was the first trade. */
  scoreBefore: number | null;
  /** Overall AVERAGE score after this trade. */
  scoreAfter: number;
  cleanStreakAfter: number;
  breakStreakAfter: number;
  /** Per-mistake breakdown shown in the feedback card. */
  breakdown: { id: string; label: string; penalty: number }[];
};

function parseNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function BehavioralJournalFlow({
  onLogged,
}: {
  onLogged?: () => void;
}) {
  const [step, setStep] = useState<Step>(0);

  // Trade core
  const [asset, setAsset] = useState("");
  const [market, setMarket] = useState<Market>("forex");
  const [direction, setDirection] = useState<Direction>("buy");
  const [entryStr, setEntryStr] = useState("");
  const [exitStr, setExitStr] = useState("");
  const [slStr, setSlStr] = useState("");
  const [tpStr, setTpStr] = useState("");
  const [riskStr, setRiskStr] = useState("");
  const [resultStr, setResultStr] = useState("");

  // Behavior + journal
  const [mistakes, setMistakes] = useState<MistakeId[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<{ file: File; preview: string; tag: ScreenshotTag }[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived numerics
  const entry = useMemo(() => parseNum(entryStr), [entryStr]);
  const exit = useMemo(() => parseNum(exitStr), [exitStr]);
  const sl = useMemo(() => parseNum(slStr), [slStr]);
  const tp = useMemo(() => parseNum(tpStr), [tpStr]);
  const risk = useMemo(() => parseNum(riskStr), [riskStr]);

  // Auto: planned RR (from entry/SL/TP)
  const plannedRR = useMemo(
    () => deriveRR({ direction, entry, stop: sl, target: tp }),
    [direction, entry, sl, tp],
  );

  // Auto: realized R from exit (used when user leaves R blank)
  const autoRealizedR = useMemo(
    () => realizedR({ direction, entry, exit, stop: sl }),
    [direction, entry, exit, sl],
  );

  const resultR = useMemo(() => {
    const cleaned = resultStr.replace(/[+rR\s]/g, "");
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) return n;
    return autoRealizedR ?? NaN;
  }, [resultStr, autoRealizedR]);

  const previewClass = useMemo(() => classify(mistakes), [mistakes]);

  const canNextFromStep0 =
    asset.trim().length > 0 && Number.isFinite(resultR);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    const room = MAX_SCREENSHOTS - files.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }
    const next: { file: File; preview: string; tag: ScreenshotTag }[] = [];
    for (const f of incoming.slice(0, room)) {
      if (!f.type.startsWith("image/")) {
        toast.error("Each screenshot must be an image.");
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        toast.error("Each screenshot must be under 8MB.");
        continue;
      }
      const preview = URL.createObjectURL(f);
      next.push({ file: f, preview, tag: "none" });
    }
    if (next.length > 0) setFiles((prev) => [...prev, ...next]);
  }

  function removeFileAt(idx: number) {
    setFiles((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function setFileTag(idx: number, tag: ScreenshotTag) {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, tag } : f)));
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
      const allFiles = files.map((f) => f.file);
      const [primary, ...extras] = allFiles;

      // 1) Behavioral journal — drives discipline_score (now an average).
      const r = await logTrade({
        asset,
        result_r: resultR,
        mistakes,
        note,
        screenshotFile: primary ?? null,
        extraScreenshotFiles: extras,
      });

      // 2) Trade Performance log — drives metrics
      const outcome: Outcome =
        resultR > 0 ? "win" : resultR < 0 ? "loss" : "breakeven";
      const now = new Date();
      const opened_at = now.toISOString();
      const closed_at = now.toISOString();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      const session_tag = sessionTagFor(now);

      const finalR = Number.isFinite(autoRealizedR ?? NaN)
        ? (autoRealizedR as number)
        : resultR;

      const pnl_percent = derivePnlPercent(finalR, risk);

      // Reuse the primary screenshot path saved by behavioralJournal as the
      // public URL for trade_logs.
      let screenshot_url: string | null = null;
      if (r.entry.screenshot_path) {
        const { data } = await supabase.storage
          .from("trade-screenshots")
          .createSignedUrl(r.entry.screenshot_path, 60 * 60 * 24 * 365);
        screenshot_url = data?.signedUrl ?? r.entry.screenshot_path;
      }

      try {
        await insertTradeLog({
          market,
          pair: asset.trim().toUpperCase(),
          direction,
          entry_price: entry,
          exit_price: exit,
          stop_loss: sl,
          take_profit: tp,
          risk_percent: risk,
          rr: Number.isFinite(finalR) ? finalR : null,
          pnl: null,
          pnl_percent,
          outcome,
          opened_at,
          closed_at,
          timezone: tz,
          session_tag,
          rules_followed: mistakes.length === 0,
          mistakes,
          confidence_rating: confidence,
          emotional_state: null,
          note: note?.trim() || null,
          screenshot_url,
        });
      } catch (perfErr) {
        console.warn("[trade_logs] insert failed:", perfErr);
      }

      setFeedback({
        classification: r.classification,
        reasonLabel: r.reasonLabel,
        perTradeScore: r.perTradeScore,
        scoreBefore: r.scoreBefore,
        scoreAfter: r.scoreAfter,
        cleanStreakAfter: r.cleanStreakAfter,
        breakStreakAfter: r.breakStreakAfter,
        breakdown: previewClass.breakdown,
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
    setMarket("forex");
    setDirection("buy");
    setEntryStr("");
    setExitStr("");
    setSlStr("");
    setTpStr("");
    setRiskStr("");
    setResultStr("");
    setMistakes([]);
    setConfidence(null);
    setNote("");
    setFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.preview));
      return [];
    });
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

            {/* Per-trade score (the strict number, never inflated) */}
            <div className="mt-6 flex items-end gap-3">
              <span
                className={`text-[44px] font-semibold leading-none tabular-nums ${ct.tone}`}
              >
                {feedback.perTradeScore}
              </span>
              <span className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.22em] text-text-secondary/55">
                / 100 · trade score
              </span>
            </div>

            {/* Per-mistake breakdown — every mistake shown equally, no severity hint */}
            {feedback.breakdown.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {feedback.breakdown.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-[12px] ring-1 ring-border/60"
                  >
                    <span className="text-text-primary/85">{b.label}</span>
                    <span className="font-semibold tabular-nums text-rose-300">
                      −{b.penalty}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Overall (avg) score block */}
            <div className="mt-6 rounded-xl bg-background/60 ring-1 ring-border px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.18em] text-text-secondary/70">
                  Overall score
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-text-secondary/60">
                  {ds.label}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                {feedback.scoreBefore != null && (
                  <>
                    <span className="text-[22px] font-semibold tabular-nums text-text-secondary/70">
                      {feedback.scoreBefore}
                    </span>
                    <ArrowRight className="h-4 w-4 text-text-secondary/60" />
                  </>
                )}
                <span className={`text-[28px] font-semibold tabular-nums ${ct.tone}`}>
                  {feedback.scoreAfter}
                </span>
                <span className="text-[11px] text-text-secondary/55">
                  avg of all trades
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
              key="step-trade"
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
                Asset, market, direction. Prices auto-calculate RR.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Asset / Pair">
                  <input
                    autoFocus
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    placeholder="EURUSD, NAS100, BTC…"
                    className="w-full bg-transparent text-[16px] font-medium text-text-primary outline-none placeholder:text-text-secondary/40"
                  />
                </Field>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                    Market
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {MARKET_OPTIONS.map((m) => {
                      const active = market === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMarket(m.id)}
                          className={`rounded-xl px-2.5 py-2.5 text-[12px] font-semibold ring-1 transition active:scale-[0.98] ${
                            active
                              ? "bg-primary/15 ring-primary/40 text-text-primary"
                              : "bg-card ring-border text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                    Direction
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection("buy")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-[13px] font-semibold ring-1 transition active:scale-[0.98] ${
                        direction === "buy"
                          ? "bg-emerald-500/15 ring-emerald-500/35 text-emerald-200"
                          : "bg-card ring-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <TrendingUp className="h-3.5 w-3.5" /> Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("sell")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-[13px] font-semibold ring-1 transition active:scale-[0.98] ${
                        direction === "sell"
                          ? "bg-rose-500/15 ring-rose-500/35 text-rose-200"
                          : "bg-card ring-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <TrendingDown className="h-3.5 w-3.5" /> Sell
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Entry">
                    <input
                      value={entryStr}
                      onChange={(e) => setEntryStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="—"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                  <Field label="Actual Exit">
                    <input
                      value={exitStr}
                      onChange={(e) => setExitStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="Where you closed"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                  <Field label="Stop loss">
                    <input
                      value={slStr}
                      onChange={(e) => setSlStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="Planned risk"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                  <Field label="Take profit">
                    <input
                      value={tpStr}
                      onChange={(e) => setTpStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="Planned target"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Risk %">
                    <input
                      value={riskStr}
                      onChange={(e) => setRiskStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="e.g. 1"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                  <Field label="Result (R)">
                    <input
                      value={resultStr}
                      onChange={(e) => setResultStr(e.target.value)}
                      placeholder={
                        autoRealizedR != null
                          ? `auto ${autoRealizedR > 0 ? "+" : ""}${autoRealizedR.toFixed(2)}`
                          : "e.g. 1.5  or  -1"
                      }
                      inputMode="decimal"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                </div>

                {plannedRR != null && (
                  <p className="text-[11px] text-text-secondary/70">
                    Planned RR auto-calculated:{" "}
                    <span className="text-text-primary font-semibold tabular-nums">
                      {plannedRR.toFixed(2)}R
                    </span>
                  </p>
                )}
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
                What slipped in this trade?
              </h1>
              <p className="mt-1.5 text-[12.5px] text-text-secondary">
                Select any mistakes that occurred during this trade.
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
                          ? "bg-primary/15 ring-primary/35 text-text-primary"
                          : "bg-card ring-border text-text-primary hover:bg-text-primary/[0.03]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md ring-1 ${
                          active
                            ? "bg-primary/30 ring-primary/55"
                            : "ring-border"
                        }`}
                      >
                        {active && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold leading-tight">
                          {m.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {mistakes.length === 0 && (
                <p className="mt-5 text-center text-[11.5px] text-text-secondary/70">
                  No mistakes selected — clean execution.
                </p>
              )}
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
                Confidence, note, screenshot — all optional.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                    Confidence (1–5)
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = confidence === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setConfidence(active ? null : n)}
                          className={`rounded-xl px-2 py-2.5 text-[13px] font-semibold tabular-nums ring-1 transition active:scale-[0.98] ${
                            active
                              ? "bg-primary/20 ring-primary/45 text-text-primary"
                              : "bg-card ring-border text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                    Screenshots (optional)
                  </p>
                  <p className="mt-1 text-[10.5px] text-text-secondary/55">
                    Up to {MAX_SCREENSHOTS} images. Tap to tag.
                  </p>

                  {files.length > 0 && (
                    <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto pb-1 px-1 no-scrollbar">
                      {files.map((f, i) => (
                        <div
                          key={i}
                          className="relative shrink-0 w-32 rounded-xl overflow-hidden ring-1 ring-border bg-card"
                        >
                          <img
                            src={f.preview}
                            alt={`Screenshot ${i + 1}`}
                            className="block h-24 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeFileAt(i)}
                            className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/85 ring-1 ring-border text-text-primary"
                            aria-label={`Remove screenshot ${i + 1}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="flex flex-wrap gap-1 p-1.5">
                            {SCREENSHOT_TAGS.map((t) => {
                              const active = f.tag === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setFileTag(i, t.id)}
                                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 transition ${
                                    active
                                      ? "bg-primary/20 ring-primary/40 text-text-primary"
                                      : "bg-background/40 ring-border text-text-secondary"
                                  }`}
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {files.length < MAX_SCREENSHOTS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 w-full rounded-xl bg-card ring-1 ring-border px-4 py-4 flex items-center justify-center gap-2 text-text-secondary text-[12.5px] font-medium hover:bg-text-primary/[0.03] transition"
                    >
                      <ImagePlus className="h-4 w-4" />
                      {files.length === 0 ? "Add screenshots" : `Add more (${files.length}/${MAX_SCREENSHOTS})`}
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      if (e.target) e.target.value = "";
                    }}
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
                <Row k="Market" v={market} />
                <Row k="Direction" v={direction.toUpperCase()} />
                <Row
                  k="Result"
                  v={`${resultR > 0 ? "+" : ""}${resultR.toFixed(2)}R`}
                  tone={resultR >= 0 ? "ok" : "risk"}
                />
                {plannedRR != null && (
                  <Row k="Planned RR" v={`${plannedRR.toFixed(2)}R`} />
                )}
                {risk != null && <Row k="Risk %" v={`${risk}%`} />}
                {confidence != null && (
                  <Row k="Confidence" v={`${confidence}/5`} />
                )}
                <Row
                  k="Mistakes"
                  v={
                    mistakes.length === 0
                      ? "None"
                      : mistakes
                          .map((m) => MISTAKES.find((x) => x.id === m)?.label ?? m)
                          .join(", ")
                  }
                />
                {files.length > 0 && (
                  <Row
                    k="Screenshots"
                    v={`${files.length} attached`}
                  />
                )}
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
