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

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { validateTradePrices } from "@/lib/priceValidation";
import {
  analyzeForCorrection,
  fieldLabel,
  type CorrectionAnalysis,
  type FieldId,
  type PriceCandidate,
} from "@/lib/priceCorrection";
import { PriceCorrectionModal } from "@/components/feature/PriceCorrectionModal";
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
import { useBehavioralJournal } from "@/hooks/useBehavioralJournal";
import { detectRelapseAndLoops } from "@/lib/relapseAndLoopDetection";
import { userKey } from "@/lib/userScopedStorage";

const ACCOUNT_SIZE_STORAGE_SUFFIX = "journal:account_size";
/** Per-user repeat-mistake counters for the price-correction engine. */
const CORRECTION_REPEAT_STORAGE_SUFFIX = "journal:correction_repeats";
const REPEAT_HINT_THRESHOLD = 3;

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
  /** Explicit outcome — used to render outcome × discipline feedback. */
  outcome: Outcome;
  /** True if any mistakes were logged for this trade. */
  hadMistakes: boolean;
};

/** Outcome × discipline → a single qualitative feedback card.
 *  Pure UI label — does NOT touch scoring. */
function outcomeFeedback(outcome: Outcome, hadMistakes: boolean): {
  title: string;
  body: string;
  tone: "gold" | "calm" | "warn" | "risk";
} {
  if (outcome === "win" && !hadMistakes) {
    return {
      title: "Clean execution",
      body: "Disciplined win. This is repeatable.",
      tone: "gold",
    };
  }
  if (outcome === "loss" && !hadMistakes) {
    return {
      title: "Controlled loss",
      body: "This is a correct loss. Your edge is intact.",
      tone: "calm",
    };
  }
  if (outcome === "win" && hadMistakes) {
    return {
      title: "Unstable win",
      body: "You profited, but behavior broke rules.",
      tone: "warn",
    };
  }
  if (outcome === "loss" && hadMistakes) {
    return {
      title: "Behavior breakdown",
      body: "This loss came from execution errors.",
      tone: "risk",
    };
  }
  // Breakeven
  return hadMistakes
    ? { title: "Breakeven — behavior slipped", body: "No damage on the book, but rules broke.", tone: "warn" }
    : { title: "Breakeven — held the line", body: "No edge expressed, no rules broken.", tone: "calm" };
}

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
  const [pnlDollarStr, setPnlDollarStr] = useState("");
  // True once the user has manually edited the $ field — auto-suggest stops filling it.
  const [pnlDollarManuallySet, setPnlDollarManuallySet] = useState(false);
  // Account size ($), persisted per-user. Optional; enables $ auto-calc.
  const [accountSizeStr, setAccountSizeStr] = useState("");
  // Explicit user-selected outcome. Auto-suggested from R but user-overridable.
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // True once the user has manually picked — auto-suggest stops overriding.
  const [outcomeManuallySet, setOutcomeManuallySet] = useState(false);

  // Behavior + journal
  const [mistakes, setMistakes] = useState<MistakeId[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<{ file: File; preview: string; tag: ScreenshotTag }[]>([]);
  // Index of the screenshot currently shown full-size in the lightbox, or null.
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Identity reinforcement (clean execution only). These do NOT touch the
  // scoring engine — they are persisted as structured tags appended to the
  // note so the pattern engine can read them later.
  const [selfConfirmedClean, setSelfConfirmedClean] = useState(false);
  type CleanReason = "discipline" | "patience" | "clear_setup" | "rules_followed" | "other";
  const [cleanReason, setCleanReason] = useState<CleanReason | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-trade awareness — quiet, deterministic line surfaced before the
  // user logs the next trade when a relapse or behavioral loop is active.
  const { entries: priorEntries } = useBehavioralJournal(50);
  const preTradeAwareness = useMemo(() => {
    if (!priorEntries || priorEntries.length < 3) return null;
    return detectRelapseAndLoops(priorEntries).preTradeAwareness;
  }, [priorEntries]);

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

  // Manually-typed R (if any). null when user hasn't entered an explicit value.
  const manualR = useMemo(() => {
    const cleaned = resultStr.replace(/[+rR\s]/g, "");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }, [resultStr]);

  const resultR = useMemo(() => {
    if (manualR != null) return manualR;
    return autoRealizedR ?? NaN;
  }, [manualR, autoRealizedR]);

  // Parsed dollar PnL (optional). Empty → null. Non-numeric → null but flagged.
  const pnlDollar = useMemo(() => {
    const t = pnlDollarStr.trim().replace(/[$,\s]/g, "");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }, [pnlDollarStr]);
  const pnlDollarInvalid = pnlDollarStr.trim().length > 0 && pnlDollar === null;

  // Account size — parsed and persisted per-user.
  const accountSize = useMemo(() => {
    const t = accountSizeStr.trim().replace(/[$,\s]/g, "");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [accountSizeStr]);
  const accountSizeInvalid = accountSizeStr.trim().length > 0 && accountSize === null;

  // Hydrate persisted account size on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(userKey(ACCOUNT_SIZE_STORAGE_SUFFIX));
      if (saved && saved.trim()) setAccountSizeStr(saved);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist a valid account size whenever it changes.
  useEffect(() => {
    try {
      if (accountSize != null) {
        localStorage.setItem(userKey(ACCOUNT_SIZE_STORAGE_SUFFIX), String(accountSize));
      } else if (accountSizeStr.trim() === "") {
        localStorage.removeItem(userKey(ACCOUNT_SIZE_STORAGE_SUFFIX));
      }
    } catch {
      // ignore storage errors
    }
  }, [accountSize, accountSizeStr]);

  // Auto-calc $ from R × risk% × account size.
  // $ = result_R × (risk_percent / 100) × account_size
  const autoPnlDollar = useMemo(() => {
    if (
      !Number.isFinite(resultR) ||
      risk == null ||
      !Number.isFinite(risk) ||
      risk <= 0 ||
      accountSize == null
    ) {
      return null;
    }
    return resultR * (risk / 100) * accountSize;
  }, [resultR, risk, accountSize]);

  // When the user hasn't typed in the $ field manually, auto-fill it from
  // the calculated value. As soon as they type, we stop overriding.
  useEffect(() => {
    if (pnlDollarManuallySet) return;
    if (autoPnlDollar == null) {
      // Clear any previously auto-filled value so the field doesn't lie.
      if (pnlDollarStr !== "") setPnlDollarStr("");
      return;
    }
    const formatted = autoPnlDollar.toFixed(2);
    if (pnlDollarStr !== formatted) setPnlDollarStr(formatted);
  }, [autoPnlDollar, pnlDollarManuallySet, pnlDollarStr]);

  // Auto-suggest outcome from R (soft logic — does not lock).
  const suggestedOutcome: Outcome | null = useMemo(() => {
    if (!Number.isFinite(resultR)) return null;
    if (resultR > 0) return "win";
    if (resultR < 0) return "loss";
    return "breakeven";
  }, [resultR]);

  useEffect(() => {
    if (outcomeManuallySet) return;
    if (suggestedOutcome && outcome !== suggestedOutcome) {
      setOutcome(suggestedOutcome);
    }
  }, [suggestedOutcome, outcomeManuallySet, outcome]);

  // Mismatch warning — non-blocking. R sign disagrees with manual outcome.
  const outcomeMismatch = useMemo(() => {
    if (!outcome || !Number.isFinite(resultR)) return false;
    if (resultR > 0 && outcome === "loss") return true;
    if (resultR < 0 && outcome === "win") return true;
    return false;
  }, [outcome, resultR]);

  const previewClass = useMemo(() => classify(mistakes), [mistakes]);

  // Contextual reinforcement line for clean executions. Looks at prior
  // clean trades to deliver a calm, stoic acknowledgement — never hype.
  // Read-only: derived from existing journal data, no scoring impact.
  const cleanContextLine = useMemo(() => {
    const priorCleanCount = (priorEntries ?? []).filter(
      (e) => e.classification === "clean",
    ).length;
    const projectedStreak = priorCleanCount + 1; // including this trade
    if (priorCleanCount === 0) return "Good. This is your baseline.";
    if (projectedStreak <= 3) return "You're starting to build control.";
    return "This is consistency forming.";
  }, [priorEntries]);

  // Price + RR validation. Surfaces hard blocks (impossible structure) and
  // warnings (suspicious but possible). Warnings require explicit confirm.
  const validation = useMemo(
    () =>
      validateTradePrices({
        direction,
        entry,
        exit,
        stop: sl,
        manualR,
      }),
    [direction, entry, exit, sl, manualR],
  );

  // Confirmation flag for the Trade Preview card. Resets automatically
  // whenever any input that affects validation changes.
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  useEffect(() => {
    setPreviewConfirmed(false);
  }, [direction, entryStr, exitStr, slStr, resultStr]);

  // ── Intelligent Price Correction wiring ──────────────────────────────
  // The modal opens when analyzeForCorrection() flags suspicious inputs
  // AND the user has not already acknowledged the current values. We track
  // a fingerprint of the four price-relevant inputs so we don't re-pop the
  // modal after the user explicitly chose "Keep original".
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionAnalysis, setCorrectionAnalysis] =
    useState<CorrectionAnalysis | null>(null);
  /** What action to perform after the user resolves the modal. */
  const [pendingAction, setPendingAction] = useState<"continue" | "submit" | null>(null);
  /** Inputs fingerprint the user already acknowledged via "Keep original". */
  const [acknowledgedFingerprint, setAcknowledgedFingerprint] = useState<string | null>(null);
  /** Marks the trade as low data-quality on submission. */
  const [lowDataQuality, setLowDataQuality] = useState(false);

  const inputsFingerprint = `${direction}|${entryStr}|${exitStr}|${slStr}`;

  // When the user changes inputs, drop the acknowledgement so the engine
  // can re-evaluate cleanly. Also clear low-quality flag.
  useEffect(() => {
    setAcknowledgedFingerprint(null);
    setLowDataQuality(false);
  }, [inputsFingerprint]);

  // Per-user, per-field repeat counters → power the subtle "you often…" hint.
  const [repeatCounts, setRepeatCounts] = useState<Record<FieldId, number>>({
    entry: 0,
    exit: 0,
    stop: 0,
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(userKey(CORRECTION_REPEAT_STORAGE_SUFFIX));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setRepeatCounts({
            entry: Number(parsed.entry) || 0,
            exit: Number(parsed.exit) || 0,
            stop: Number(parsed.stop) || 0,
          });
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);
  function bumpRepeatCount(field: FieldId) {
    setRepeatCounts((prev) => {
      const next = { ...prev, [field]: (prev[field] ?? 0) + 1 };
      try {
        localStorage.setItem(userKey(CORRECTION_REPEAT_STORAGE_SUFFIX), JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }
  /** Hint string when one field has been corrected ≥ threshold times. */
  const repeatHint = useMemo(() => {
    const offender = (Object.entries(repeatCounts) as [FieldId, number][])
      .filter(([, count]) => count >= REPEAT_HINT_THRESHOLD)
      .sort((a, b) => b[1] - a[1])[0];
    if (!offender) return null;
    return `You often enter extra digits in ${fieldLabel(offender[0]).toLowerCase()}. Be careful with scaling.`;
  }, [repeatCounts]);

  // Required: asset, direction (always set), entry, stop loss,
  // (exit OR manual R), and outcome. Hard validation blocks must be
  // cleared. Warnings require explicit preview confirmation.
  const hasExitOrR = exit !== null || Number.isFinite(manualR as number);
  const canNextFromStep0 =
    asset.trim().length > 0 &&
    entry !== null &&
    sl !== null &&
    hasExitOrR &&
    Number.isFinite(resultR) &&
    outcome !== null &&
    !accountSizeInvalid &&
    !pnlDollarInvalid &&
    !validation.hasBlock &&
    (!validation.hasWarn || previewConfirmed);

  /**
   * Run the correction engine before performing `action`. If suspicious
   * inputs are detected and not yet acknowledged, open the modal and stash
   * the action for later. Otherwise run the action immediately.
   */
  function runCorrectionGuard(action: "continue" | "submit") {
    const a = analyzeForCorrection({ direction, entry, exit, stop: sl });
    if (a.triggered && acknowledgedFingerprint !== inputsFingerprint) {
      setCorrectionAnalysis(a);
      setPendingAction(action);
      setCorrectionOpen(true);
      return;
    }
    performAction(action);
  }

  function performAction(action: "continue" | "submit") {
    if (action === "continue") {
      setStep((s) => (Math.min(3, s + 1) as Step));
    } else {
      void submit();
    }
  }

  function applyCandidate(field: FieldId, candidate: PriceCandidate) {
    const v = candidate.suggested;
    const formatted = String(v);
    if (field === "entry") setEntryStr(formatted);
    else if (field === "exit") setExitStr(formatted);
    else if (field === "stop") setSlStr(formatted);
    bumpRepeatCount(field);
    setLowDataQuality(false);
    // Close the modal but DO NOT auto-advance — let the user re-validate
    // the new values. They click Continue/Save again, which will re-run
    // the guard against the corrected inputs.
    setCorrectionOpen(false);
    setCorrectionAnalysis(null);
    setPendingAction(null);
    toast.success(`${fieldLabel(field)} updated to ${formatted}`);
  }

  function keepOriginalCorrection() {
    setLowDataQuality(true);
    setAcknowledgedFingerprint(inputsFingerprint);
    setCorrectionOpen(false);
    const action = pendingAction;
    setCorrectionAnalysis(null);
    setPendingAction(null);
    if (action) performAction(action);
  }

  function editManuallyCorrection() {
    setCorrectionOpen(false);
    setCorrectionAnalysis(null);
    setPendingAction(null);
    // Focus the first price field so the user can immediately edit.
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
      el?.focus();
    });
  }

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
    // Close the lightbox if we just removed the item it was showing.
    setLightboxIdx((cur) => {
      if (cur === null) return cur;
      if (cur === idx) return null;
      return cur > idx ? cur - 1 : cur;
    });
  }

  function setFileTag(idx: number, tag: ScreenshotTag) {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, tag } : f)));
  }

  function clearAllFiles() {
    setFiles((prev) => {
      for (const f of prev) URL.revokeObjectURL(f.preview);
      return [];
    });
    setLightboxIdx(null);
  }

  // Move the chosen screenshot to position 0 — that's the one persisted as
  // the trade's primary `screenshot_url`; everything else uploads as extras.
  function makePrimary(idx: number) {
    setFiles((prev) => {
      if (idx <= 0 || idx >= prev.length) return prev;
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      next.unshift(picked);
      return next;
    });
    setLightboxIdx((cur) => (cur === idx ? 0 : cur));
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function toggleMistake(id: MistakeId) {
    setMistakes((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
      // Clean-execution reinforcement only applies when zero mistakes are
      // selected — clear it the moment the user marks a mistake.
      if (next.length > 0) {
        setSelfConfirmedClean(false);
        setCleanReason(null);
      }
      return next;
    });
  }

  async function submit() {
    if (!canNextFromStep0 || submitting) return;
    setSubmitting(true);
    try {
      const allFiles = files.map((f) => f.file);
      const [primary, ...extras] = allFiles;

      // Pattern-engine tags. Only attached on clean executions and never
      // affect scoring — they're appended to the note string so they're
      // persisted alongside the trade for later behavioral analysis.
      const cleanTags: string[] = [];
      if (mistakes.length === 0) {
        cleanTags.push("clean_execution");
        if (selfConfirmedClean) cleanTags.push("self_confirmed_clean_execution");
        if (cleanReason) cleanTags.push(`clean_reason:${cleanReason}`);
      }
      const noteWithTags = cleanTags.length > 0
        ? `${note ? `${note}\n\n` : ""}[tags] ${cleanTags.join(" ")}`.trim()
        : note;

      // 1) Behavioral journal — drives discipline_score (now an average).
      const r = await logTrade({
        asset,
        result_r: resultR,
        mistakes,
        note: noteWithTags,
        screenshotFile: primary ?? null,
        extraScreenshotFiles: extras,
      });

      // 2) Trade Performance log — drives metrics
      // Use explicit user-selected outcome (falls back to R-derived if somehow null,
      // but validation prevents that).
      const finalOutcome: Outcome =
        outcome ?? (resultR > 0 ? "win" : resultR < 0 ? "loss" : "breakeven");
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
          pnl: pnlDollar,
          pnl_percent,
          outcome: finalOutcome,
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
          data_quality: lowDataQuality ? "low" : "normal",
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
        outcome: finalOutcome,
        hadMistakes: mistakes.length > 0,
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
    setPnlDollarStr("");
    setPnlDollarManuallySet(false);
    // Note: accountSizeStr is intentionally NOT reset — it persists per user.
    setOutcome(null);
    setOutcomeManuallySet(false);
    setMistakes([]);
    setSelfConfirmedClean(false);
    setCleanReason(null);
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
    const ofb = outcomeFeedback(feedback.outcome, feedback.hadMistakes);
    const ofbCls =
      ofb.tone === "gold"
        ? "from-primary/[0.14] to-primary/[0.04] ring-primary/35 text-primary"
        : ofb.tone === "calm"
          ? "from-emerald-500/[0.10] to-emerald-500/[0.02] ring-emerald-500/25 text-emerald-300"
          : ofb.tone === "warn"
            ? "from-amber-500/[0.12] to-amber-500/[0.02] ring-amber-500/30 text-amber-300"
            : "from-rose-500/[0.12] to-rose-500/[0.02] ring-rose-500/30 text-rose-300";
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

            {/* Outcome × Discipline qualitative feedback */}
            <div className={`mt-5 rounded-xl bg-gradient-to-b ${ofbCls} ring-1 px-4 py-3.5`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${ofb.tone === "gold" ? "text-primary" : ofb.tone === "calm" ? "text-emerald-300" : ofb.tone === "warn" ? "text-amber-300" : "text-rose-300"}`}>
                {ofb.title}
              </p>
              <p className="mt-1 text-[13.5px] leading-snug text-text-primary">
                {ofb.body}
              </p>
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

        {preTradeAwareness && step === 0 && (
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
              Pre-trade awareness
            </div>
            <p className="mt-1 text-[13px] leading-snug text-text-primary">
              {preTradeAwareness}
            </p>
          </div>
        )}

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

              <div className="mt-7 space-y-5">
                <Field label="Asset">
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
                      placeholder="0.00"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                  <Field label="Exit">
                    <input
                      value={exitStr}
                      onChange={(e) => setExitStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                  <Field label="Stop loss">
                    <input
                      value={slStr}
                      onChange={(e) => setSlStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                  <Field label="Take profit">
                    <input
                      value={tpStr}
                      onChange={(e) => setTpStr(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
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
                      placeholder="—"
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
                          : "+1.5 / -1"
                      }
                      inputMode="decimal"
                      className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                    />
                  </Field>
                </div>

                {/* Account size ($) — optional, persisted across trades.
                    When set together with Risk %, the $ field auto-fills. */}
                <Field label="Account size ($) — optional">
                  <input
                    value={accountSizeStr}
                    onChange={(e) => setAccountSizeStr(e.target.value)}
                    placeholder="e.g. 10000"
                    inputMode="decimal"
                    className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                  />
                </Field>
                {accountSizeInvalid && (
                  <p className="text-[11px] text-rose-300">
                    Enter a positive number (e.g. 10000) or leave it blank.
                  </p>
                )}

                {/* Profit / Loss ($) — optional. Auto-fills from R × Risk % × Account size
                    when those are set, but the user can always override manually. */}
                <Field label="Profit / Loss ($) — optional">
                  <input
                    value={pnlDollarStr}
                    onChange={(e) => {
                      setPnlDollarStr(e.target.value);
                      setPnlDollarManuallySet(true);
                    }}
                    placeholder={
                      autoPnlDollar != null && !pnlDollarManuallySet
                        ? `auto ${autoPnlDollar > 0 ? "+" : ""}${autoPnlDollar.toFixed(2)}`
                        : "e.g. +150  or  -75"
                    }
                    inputMode="decimal"
                    className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-secondary/40"
                  />
                </Field>
                {autoPnlDollar != null && pnlDollarManuallySet && (
                  <button
                    type="button"
                    onClick={() => {
                      setPnlDollarManuallySet(false);
                      setPnlDollarStr(autoPnlDollar.toFixed(2));
                    }}
                    className="text-[11px] text-primary/85 hover:text-primary underline-offset-2 hover:underline"
                  >
                    Use auto-calculated {autoPnlDollar > 0 ? "+" : ""}${autoPnlDollar.toFixed(2)}
                  </button>
                )}
                {autoPnlDollar != null && !pnlDollarManuallySet && (
                  <p className="text-[11px] text-text-secondary/70">
                    Auto-calculated from R × Risk % × Account size. Type to override.
                  </p>
                )}
                {pnlDollarInvalid && (
                  <p className="text-[11px] text-rose-300">
                    Enter a valid number (e.g. 150, -75) or leave it blank.
                  </p>
                )}

                {/* Trade Outcome — explicit selection, required */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                    Trade Outcome
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      {
                        id: "win",
                        label: "Win",
                        activeCls: "bg-emerald-500/15 ring-emerald-500/40 text-emerald-200",
                        glowStrong: "0 0 22px rgba(198,161,91,0.45), 0 0 6px rgba(231,201,138,0.35) inset",
                        glowSoft: "0 0 12px rgba(198,161,91,0.22), 0 0 4px rgba(231,201,138,0.18) inset",
                      },
                      {
                        id: "loss",
                        label: "Loss",
                        activeCls: "bg-rose-500/15 ring-rose-500/40 text-rose-200",
                        glowStrong: "0 0 22px rgba(220,90,90,0.35), 0 0 6px rgba(220,90,90,0.25) inset",
                        glowSoft: "0 0 12px rgba(220,90,90,0.18), 0 0 4px rgba(220,90,90,0.12) inset",
                      },
                      {
                        id: "breakeven",
                        label: "Break-even",
                        activeCls: "bg-primary/15 ring-primary/45 text-text-primary",
                        glowStrong: "0 0 20px rgba(198,161,91,0.30), 0 0 6px rgba(198,161,91,0.20) inset",
                        glowSoft: "0 0 10px rgba(198,161,91,0.16), 0 0 4px rgba(198,161,91,0.10) inset",
                      },
                    ] as const).map((opt) => {
                      const active = outcome === opt.id;
                      return (
                        <motion.button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setOutcome(opt.id);
                            setOutcomeManuallySet(true);
                          }}
                          initial={false}
                          animate={
                            active
                              ? {
                                  // One-shot bounce on selection, then a soft
                                  // continuous pulse via the boxShadow keyframes.
                                  scale: [1, 1.08, 0.97, 1.02, 1],
                                  boxShadow: [
                                    opt.glowStrong,
                                    opt.glowSoft,
                                    opt.glowStrong,
                                  ],
                                }
                              : {
                                  scale: 1,
                                  boxShadow: "0 0 0 rgba(0,0,0,0)",
                                }
                          }
                          transition={
                            active
                              ? {
                                  scale: {
                                    duration: 0.55,
                                    times: [0, 0.3, 0.55, 0.8, 1],
                                    ease: "easeOut",
                                  },
                                  boxShadow: {
                                    duration: 2.4,
                                    ease: "easeInOut",
                                    repeat: Infinity,
                                  },
                                }
                              : { duration: 0.25, ease: "easeOut" }
                          }
                          whileHover={{ scale: active ? 1.02 : 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          className={`rounded-xl px-2.5 py-2.5 text-[12.5px] font-semibold ring-1 ${
                            active
                              ? opt.activeCls
                              : "bg-card ring-border text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {opt.label}
                        </motion.button>
                      );
                    })}
                  </div>
                  {outcome === null && Number.isFinite(resultR) && (
                    <p className="mt-2 text-[11px] text-text-secondary/70">
                      Select an outcome to continue.
                    </p>
                  )}
                  {outcomeMismatch && (
                    <p className="mt-2 text-[11px] text-amber-300">
                      Your result suggests a different outcome. Confirm if intentional.
                    </p>
                  )}
                </div>

                {plannedRR != null && (
                  <p className="text-[11px] text-text-secondary/70">
                    Planned RR auto-calculated:{" "}
                    <span className="text-text-primary font-semibold tabular-nums">
                      {plannedRR.toFixed(2)}R
                    </span>
                  </p>
                )}

                {/* ── Price / RR validation surface ──────────────────────
                    Hard blocks (red) — Continue is gated until cleared.
                    Warnings (amber) — non-blocking, but require Trade
                    Preview confirmation before proceeding. */}
                {validation.issues.length > 0 && (
                  <div className="space-y-2">
                    {validation.issues
                      .filter((i) => i.code !== "manual_mismatch")
                      .map((issue) => (
                        <div
                          key={issue.code}
                          className={`flex items-start gap-2 rounded-lg px-3 py-2.5 ring-1 text-[12px] leading-relaxed ${
                            issue.level === "block"
                              ? "bg-rose-500/10 ring-rose-500/30 text-rose-200"
                              : "bg-amber-500/10 ring-amber-500/25 text-amber-200"
                          }`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mt-[2px] shrink-0" />
                          <span>{issue.message}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Manual vs calculated R mismatch — explicit choice. */}
                {validation.issues.some((i) => i.code === "manual_mismatch") &&
                  validation.calculatedR != null && manualR != null && (
                    <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25 px-3 py-3 text-[12px] text-amber-100">
                      <p className="leading-relaxed">
                        Your manual result ({manualR > 0 ? "+" : ""}
                        {manualR.toFixed(2)}R) differs from the calculated value
                        ({validation.calculatedR > 0 ? "+" : ""}
                        {validation.calculatedR.toFixed(2)}R). Use calculated or
                        keep yours?
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const v = validation.calculatedR!;
                            setResultStr(v.toFixed(2));
                          }}
                          className="rounded-full bg-primary/20 ring-1 ring-primary/40 px-3 py-1.5 text-[11.5px] font-semibold text-text-primary hover:bg-primary/25 transition"
                        >
                          Use calculated
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewConfirmed(true)}
                          className="rounded-full ring-1 ring-amber-500/40 px-3 py-1.5 text-[11.5px] font-semibold text-amber-100 hover:bg-amber-500/10 transition"
                        >
                          Keep mine
                        </button>
                      </div>
                    </div>
                  )}

                {/* ── Trade Preview card ─────────────────────────────────
                    Surfaces the engine-derived view of the trade right
                    before the user advances. When warnings exist, an
                    explicit Confirm step is required. */}
                {validation.structurallyValid &&
                  validation.calculatedR != null &&
                  outcome !== null && (
                    <div className="rounded-xl bg-card ring-1 ring-border px-4 py-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                        Trade Preview
                      </p>
                      <div className="mt-2 space-y-1 text-[12.5px] text-text-secondary">
                        <div className="flex items-center justify-between">
                          <span>Direction</span>
                          <span className="text-text-primary font-semibold">
                            {direction.toUpperCase()}
                          </span>
                        </div>
                        {risk != null && (
                          <div className="flex items-center justify-between">
                            <span>Risk</span>
                            <span className="text-text-primary font-semibold tabular-nums">
                              {risk}% · 1R
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span>Calculated result</span>
                          <span
                            className={`font-semibold tabular-nums ${
                              validation.calculatedR >= 0
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }`}
                          >
                            {validation.calculatedR > 0 ? "+" : ""}
                            {validation.calculatedR.toFixed(2)}R
                          </span>
                        </div>
                      </div>

                      {validation.hasWarn && (
                        <>
                          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25 px-3 py-2 text-[11.5px] text-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5 mt-[2px] shrink-0" />
                            <span>Check your inputs. This result looks unusual.</span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewConfirmed(true)}
                              disabled={previewConfirmed}
                              className="rounded-full bg-primary/20 ring-1 ring-primary/40 px-3.5 py-1.5 text-[11.5px] font-semibold text-text-primary disabled:opacity-50 hover:bg-primary/25 transition"
                            >
                              {previewConfirmed ? "Confirmed" : "Confirm & continue"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewConfirmed(false);
                                // Soft scroll cue — focus first price field.
                                const el = document.querySelector<HTMLInputElement>(
                                  'input[inputmode="decimal"]',
                                );
                                el?.focus();
                              }}
                              className="rounded-full ring-1 ring-border px-3.5 py-1.5 text-[11.5px] font-semibold text-text-secondary hover:text-text-primary transition"
                            >
                              Edit values
                            </button>
                          </div>
                        </>
                      )}
                    </div>
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
                <motion.div
                  key="clean-execution"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease }}
                  className="mt-6 rounded-2xl bg-gradient-to-b from-primary/[0.12] to-primary/[0.04] ring-1 ring-primary/35 px-5 py-5 text-center shadow-glow-gold"
                >
                  <div
                    className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/25 ring-1 ring-primary/50"
                    style={{ boxShadow: "0 0 22px rgba(198,161,91,0.45)" }}
                  >
                    <Check className="h-4 w-4 text-primary" strokeWidth={2.6} />
                  </div>
                  <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-primary">
                    Clean execution
                  </p>
                  <p className="mt-2 text-[14px] font-semibold leading-snug text-text-primary">
                    You followed your rules completely.
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-text-secondary/85">
                    This is the behavior that builds consistency.
                  </p>

                  {/* Stoic, contextual reinforcement based on prior clean trades */}
                  <p className="mt-4 text-[11.5px] italic text-text-secondary/75">
                    {cleanContextLine}
                  </p>

                  {/* Optional identity affirmation */}
                  <button
                    type="button"
                    onClick={() => setSelfConfirmedClean((v) => !v)}
                    aria-pressed={selfConfirmedClean}
                    className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold transition active:scale-[0.97] ring-1 ${
                      selfConfirmedClean
                        ? "bg-primary/25 ring-primary/55 text-text-primary"
                        : "bg-card ring-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <span
                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm ring-1 ${
                        selfConfirmedClean ? "bg-primary/40 ring-primary/65" : "ring-border"
                      }`}
                    >
                      {selfConfirmedClean && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                    </span>
                    I followed my plan fully
                  </button>

                  {/* Optional micro-reflection — feeds the pattern engine */}
                  <div className="mt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/55">
                      What made this trade clean?
                    </p>
                    <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                      {([
                        { id: "discipline", label: "Discipline" },
                        { id: "patience", label: "Patience" },
                        { id: "clear_setup", label: "Clear setup" },
                        { id: "rules_followed", label: "Rules followed" },
                        { id: "other", label: "Other" },
                      ] as const).map((opt) => {
                        const active = cleanReason === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setCleanReason(active ? null : opt.id)}
                            aria-pressed={active}
                            className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition active:scale-[0.97] ring-1 ${
                              active
                                ? "bg-primary/20 ring-primary/45 text-text-primary"
                                : "bg-card ring-border text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
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
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/60">
                      Screenshots (optional)
                    </p>
                    {files.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllFiles}
                        className="inline-flex items-center gap-1 text-[10.5px] font-medium text-text-secondary/70 hover:text-text-primary"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear all
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[10.5px] text-text-secondary/55">
                    {files.length === 0
                      ? `Up to ${MAX_SCREENSHOTS} images. First one becomes the primary.`
                      : `${files.length}/${MAX_SCREENSHOTS} attached · tap to preview, ★ to set primary`}
                  </p>

                  {files.length > 0 && (
                    <ul className="mt-3 grid grid-cols-3 gap-2">
                      {files.map((f, i) => {
                        const isPrimary = i === 0;
                        return (
                          <li
                            key={`${f.file.name}-${i}`}
                            className={`group relative rounded-xl overflow-hidden ring-1 bg-card ${
                              isPrimary ? "ring-primary/45" : "ring-border"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setLightboxIdx(i)}
                              className="block w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                              aria-label={`Preview screenshot ${i + 1}`}
                            >
                              <img
                                src={f.preview}
                                alt={`Screenshot ${i + 1}`}
                                className="block aspect-square w-full object-cover"
                              />
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/55 opacity-0 transition group-hover:opacity-100"
                              >
                                <Eye className="h-4 w-4 text-text-primary" />
                              </span>
                            </button>

                            {isPrimary && (
                              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary/25 ring-1 ring-primary/45 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-text-primary">
                                <Star className="h-2.5 w-2.5 fill-current" />
                                Primary
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => removeFileAt(i)}
                              className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/85 ring-1 ring-border text-text-primary hover:text-rose-300"
                              aria-label={`Remove screenshot ${i + 1}`}
                            >
                              <X className="h-3 w-3" />
                            </button>

                            <div className="px-1.5 pb-1.5 pt-1">
                              <p
                                className="truncate text-[9.5px] text-text-secondary/80"
                                title={f.file.name}
                              >
                                {f.file.name}
                              </p>
                              <p className="text-[9px] tabular-nums text-text-secondary/55">
                                {formatBytes(f.file.size)}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-0.5">
                                {SCREENSHOT_TAGS.map((t) => {
                                  const active = f.tag === t.id;
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => setFileTag(i, t.id)}
                                      className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold ring-1 transition ${
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
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {files.length < MAX_SCREENSHOTS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 w-full rounded-xl bg-card ring-1 ring-border px-4 py-4 flex items-center justify-center gap-2 text-text-secondary text-[12.5px] font-medium hover:bg-text-primary/[0.03] transition"
                    >
                      <ImagePlus className="h-4 w-4" />
                      {files.length === 0
                        ? "Add screenshots"
                        : `Add more (${files.length}/${MAX_SCREENSHOTS})`}
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

                  {/* Lightbox preview */}
                  <AnimatePresence>
                    {lightboxIdx !== null && files[lightboxIdx] && (
                      <motion.div
                        key="screenshot-lightbox"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
                        onClick={() => setLightboxIdx(null)}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Screenshot preview"
                      >
                        <motion.div
                          initial={{ scale: 0.96, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.96, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="relative w-full max-w-[480px] rounded-2xl bg-card ring-1 ring-border overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <img
                            src={files[lightboxIdx].preview}
                            alt={`Screenshot ${lightboxIdx + 1} full preview`}
                            className="block w-full max-h-[70vh] object-contain bg-background"
                          />
                          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
                            <div className="min-w-0">
                              <p
                                className="truncate text-[12px] text-text-primary"
                                title={files[lightboxIdx].file.name}
                              >
                                {files[lightboxIdx].file.name}
                              </p>
                              <p className="text-[10.5px] tabular-nums text-text-secondary/65">
                                {formatBytes(files[lightboxIdx].file.size)} ·
                                {" "}#{lightboxIdx + 1} of {files.length}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {lightboxIdx !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => makePrimary(lightboxIdx)}
                                  className="inline-flex items-center gap-1 rounded-full bg-primary/15 ring-1 ring-primary/35 px-2.5 py-1 text-[10.5px] font-semibold text-text-primary"
                                >
                                  <Star className="h-3 w-3" />
                                  Set primary
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeFileAt(lightboxIdx)}
                                className="inline-flex items-center gap-1 rounded-full bg-card ring-1 ring-border px-2.5 py-1 text-[10.5px] font-semibold text-rose-300 hover:text-rose-200"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remove
                              </button>
                              <button
                                type="button"
                                onClick={() => setLightboxIdx(null)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-card ring-1 ring-border text-text-primary"
                                aria-label="Close preview"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                {outcome && (
                  <Row
                    k="Outcome"
                    v={outcome === "breakeven" ? "Break-even" : outcome === "win" ? "Win" : "Loss"}
                    tone={outcome === "win" ? "ok" : outcome === "loss" ? "risk" : undefined}
                  />
                )}
                {pnlDollar != null && (
                  <Row
                    k="P/L ($)"
                    v={`${pnlDollar > 0 ? "+" : ""}$${pnlDollar.toFixed(2)}`}
                    tone={pnlDollar > 0 ? "ok" : pnlDollar < 0 ? "risk" : undefined}
                  />
                )}
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
              onClick={() => {
                if (step === 0) runCorrectionGuard("continue");
                else setStep((s) => (Math.min(3, s + 1) as Step));
              }}
              disabled={step === 0 && !canNextFromStep0}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 ring-1 ring-primary/30 px-5 py-2.5 text-[12.5px] font-semibold text-text-primary disabled:opacity-30 active:scale-[0.98] transition"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runCorrectionGuard("submit")}
              disabled={submitting || !canNextFromStep0}
              className="inline-flex items-center gap-2 rounded-full bg-primary/20 ring-1 ring-primary/40 px-5 py-2.5 text-[12.5px] font-semibold text-text-primary disabled:opacity-30 active:scale-[0.98] transition"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? "Saving…" : "Save trade"}
            </button>
          )}
        </div>

        {/* Low data-quality banner — visible after the user kept their
            originally-flagged values. Honest, non-blocking. */}
        {lowDataQuality && (
          <p className="mt-3 text-[11px] text-amber-300/90">
            This trade will be saved with{" "}
            <span className="font-semibold">low data quality</span> — it may be
            excluded from analytics.
          </p>
        )}

        {/* Intelligent price-correction modal. */}
        <PriceCorrectionModal
          open={correctionOpen}
          analysis={correctionAnalysis}
          repeatHint={repeatHint}
          onApplyCandidate={applyCandidate}
          onKeepOriginal={keepOriginalCorrection}
          onEditManually={editManuallyCorrection}
          onClose={editManuallyCorrection}
        />
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
