// StrategyBuilder — premium guided flow that turns raw input into an
// enforceable trading system. Designed to feel like a calm conversation,
// not an exam.
//
// Principles:
//   - One question per screen. No clutter.
//   - Auto-save on every change. No "Submit" buttons.
//   - Never block forward progress for vague input.
//   - All AI calls have a hard timeout fallback.
//   - PDF export runs in the browser; .txt fallback always available.
//
// Steps:
//   1) Account     — what kind of account
//   2) Risk        — per-trade %, daily loss, max DD
//   3) Strategy    — describe in own words
//   4) Tiers       — A+ / B+ / C definitions
//   5) AI parse    — structure rules
//   6) Refine      — single optional "anything unclear?" screen
//   7) Output      — checklist + plan
//   8) Export      — PDF + txt
//   9) Lock        — finalize

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  LockOpen,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ShieldAlert,
  FileText,
  FileDown,
  GitMerge,
  HelpCircle,
  X,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import {
  type StrategyBlueprint,
  type AccountType,
  type StructuredRules,
  type AmbiguityFlag,
  type RefinementQA,
  type ChecklistByTier,
  type TierRules,
  EMPTY_RULES,
  findOrCreateDraft,
  getBlueprint,
  updateBlueprint,
  lockBlueprint,
  unlockBlueprint,
} from "@/lib/dbStrategyBlueprints";
import { supabase } from "@/integrations/supabase/client";
import { downloadPdf, downloadTxt } from "@/lib/strategyExport";
import {
  interrogate,
  readRules,
  evaluateStrictness,
  validateStructuredOutput,
  type IntelligenceReport,
  type RuleCategoryV2,
  type StrictnessVerdict,
  type RuleAtomicityIssue,
} from "@/lib/strategyIntelligence";

const ACCOUNT_OPTIONS: { value: AccountType; label: string; hint: string }[] = [
  { value: "prop", label: "Prop firm", hint: "Strict drawdown rules" },
  { value: "personal", label: "Personal", hint: "Your own capital" },
  { value: "demo", label: "Demo", hint: "Practice account" },
];

type StepKey =
  | "account"
  | "risk"
  | "raw"
  | "tiers"
  | "parse"
  | "interrogate"
  | "refine"
  | "output"
  | "export"
  | "lock";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "risk", label: "Risk" },
  { key: "raw", label: "Strategy" },
  { key: "tiers", label: "Tiers" },
  { key: "parse", label: "Parse" },
  { key: "interrogate", label: "Interrogate" },
  { key: "refine", label: "Refine" },
  { key: "output", label: "Output" },
  { key: "export", label: "Export" },
  { key: "lock", label: "Lock" },
];

// Hard timeout helper so no async call can stall the UI.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export default function StrategyBuilder({
  blueprintId,
}: {
  blueprintId?: string;
}) {
  const navigate = useNavigate();
  const [bp, setBp] = useState<StrategyBlueprint | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [structuring, setStructuring] = useState(false);
  const step = STEPS[stepIdx];

  // Bootstrap: load existing or create draft. Hard 3s ceiling.
  useEffect(() => {
    setBp(null);
    setBootError(null);
    let cancelled = false;

    (async () => {
      try {
        if (blueprintId) {
          const existing = await withTimeout(
            getBlueprint(blueprintId),
            3000,
            "getBlueprint",
          );
          if (cancelled) return;
          if (!existing) {
            setBootError("This strategy doesn't exist or isn't yours.");
            return;
          }
          const idx = Math.max(
            0,
            STEPS.findIndex((s) => s.key === (existing.current_step ?? "account")),
          );
          setStepIdx(idx === -1 ? 0 : idx);
          setBp(existing);
        } else {
          const created = await withTimeout(findOrCreateDraft(), 3000, "findOrCreateDraft");
          if (cancelled) return;
          void navigate({
            to: "/hub/strategy/$id",
            params: { id: created.id },
            replace: true,
          });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[StrategyBuilder] bootstrap failed", err);
        setBootError("Took too long to load. Try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blueprintId, navigate]);

  const startFresh = async () => {
    try {
      setBootError(null);
      const created = await findOrCreateDraft();
      void navigate({
        to: "/hub/strategy/$id",
        params: { id: created.id },
        replace: true,
      });
    } catch {
      toast.error("Couldn't start a new strategy.");
    }
  };

  // Optimistic local update + persist. Never blocks UI.
  const patch = async (p: Partial<StrategyBlueprint>) => {
    if (!bp) return;
    setBp({ ...bp, ...p });
    try {
      await updateBlueprint(bp.id, p);
    } catch (err) {
      console.error("[StrategyBuilder] patch failed", err);
    }
  };

  const goToStep = async (nextIdx: number) => {
    if (!bp) return;
    const clamped = Math.max(0, Math.min(STEPS.length - 1, nextIdx));
    const nextKey = STEPS[clamped].key;
    setStepIdx(clamped);
    if (bp.current_step !== nextKey) {
      void updateBlueprint(bp.id, { current_step: nextKey }).catch(() => {});
      setBp({ ...bp, current_step: nextKey });
    }
  };

  // Soft re-validation: run deterministic interrogation whenever rules change.
  const reportEarly = useMemo<IntelligenceReport | null>(
    () => (bp ? interrogate(bp) : null),
    [bp],
  );
  const verdictEarly = useMemo<StrictnessVerdict | null>(
    () => (bp && reportEarly ? evaluateStrictness(reportEarly, { isLocked: bp.locked }) : null),
    [bp, reportEarly],
  );
  const atomicityIssues = useMemo<RuleAtomicityIssue[]>(
    () => (bp ? validateStructuredOutput(readRules(bp)) : []),
    [bp],
  );

  const canAdvance = useMemo(() => {
    if (!bp) return false;
    switch (step.key) {
      case "account":
        return (bp.account_types?.length ?? 0) > 0;
      case "risk":
        return (
          (bp.risk_per_trade_pct ?? 0) > 0 &&
          (bp.daily_loss_limit_pct ?? 0) > 0 &&
          (bp.max_drawdown_pct ?? 0) > 0
        );
      case "raw":
        return true;
      case "parse": {
        const hasRules = Object.values(bp.structured_rules ?? {}).some(
          (a) => Array.isArray(a) && a.length > 0,
        );
        // Active interrogation: if AI returned questions, require at least
        // one answered (or explicitly skipped) before advancing. Locked
        // blueprints are grandfathered.
        const qs = bp.refinement_history ?? [];
        const hasUnresolved = !bp.locked && qs.length > 0 && qs.every((q) => !q.answer?.trim() && !q.accepted);
        return hasRules && !hasUnresolved;
      }
      case "interrogate":
        // Block advance when contradictions, critical missing, or too many
        // vague rules. Locked blueprints downgrade to "warn" inside evaluateStrictness.
        return verdictEarly?.severity !== "block";
      case "output":
        return !!bp.trading_plan && (bp.checklist?.a_plus?.length ?? 0) > 0 && atomicityIssues.length === 0;
      // tiers / refine / export / lock — never block.
      default:
        return true;
    }
  }, [bp, step.key, verdictEarly, atomicityIssues]);

  if (bootError) {
    return (
      <Shell>
        <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <p className="max-w-sm text-sm text-foreground">{bootError}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startFresh}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95"
            >
              Start fresh
            </button>
            <Link
              to="/hub/strategy"
              className="rounded-xl bg-card px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border shadow-soft hover:opacity-95"
            >
              Back
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!bp) {
    return (
      <Shell>
        <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            One moment
          </p>
        </div>
      </Shell>
    );
  }

  // Reuse early-computed report (declared above for canAdvance).
  const report = reportEarly!;
  const verdict = verdictEarly!;

  return (
    <Shell>
      <div className="mx-auto w-full max-w-[640px] px-5 pt-5 pb-24">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/hub/strategy"
            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border shadow-soft transition-all hover:shadow-card-premium"
            aria-label="Back to strategies"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
            {stepIdx + 1} / {STEPS.length}
          </div>
          <div className="w-10" />
        </div>

        {/* Thin progress bar */}
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-border/60">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Title row */}
        <div className="mt-8 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>{bp.name || "Untitled strategy"}</span>
          {bp.locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}
        </div>

        {/* Soft re-validation banner — non-blocking. Hidden on the dedicated
           interrogate step (the step itself is the deep-dive). */}
        {step.key !== "interrogate" && !report.clean && (bp.structured_rules?.entry?.length ?? 0) > 0 && (
          <ReValidateBanner
            report={report}
            onJump={() => void goToStep(STEPS.findIndex((s) => s.key === "interrogate"))}
          />
        )}

        {/* Step body */}
        <div className="mt-3 min-h-[420px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {step.key === "account" && (
                <StepAccount
                  bp={bp}
                  onChange={(account_types) => patch({ account_types })}
                  onName={(name) => patch({ name })}
                />
              )}
              {step.key === "risk" && <StepRisk bp={bp} patch={patch} />}
              {step.key === "raw" && (
                <StepRaw bp={bp} onChange={(raw_input) => patch({ raw_input })} />
              )}
              {step.key === "tiers" && <StepTiers bp={bp} patch={patch} />}
              {step.key === "parse" && (
                <StepParse bp={bp} patch={patch} setBusy={setBusy} busy={busy} />
              )}
              {step.key === "interrogate" && (
                <StepInterrogate bp={bp} patch={patch} report={report} verdict={verdict} />
              )}
              {step.key === "refine" && (
                <StepRefine bp={bp} patch={patch} setBusy={setBusy} busy={busy} />
              )}
              {step.key === "output" && (
                <StepOutput bp={bp} patch={patch} setBusy={setBusy} busy={busy} atomicityIssues={atomicityIssues} />
              )}
              {step.key === "export" && <StepExport bp={bp} />}
              {step.key === "lock" && <StepLock bp={bp} setBp={setBp} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav */}
        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void goToStep(stepIdx - 1)}
            disabled={stepIdx === 0}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/70 transition hover:text-foreground disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {stepIdx < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                if (step.key === "raw") {
                  setStructuring(true);
                  window.setTimeout(() => {
                    setStructuring(false);
                    void goToStep(stepIdx + 1);
                  }, 1700);
                } else {
                  void goToStep(stepIdx + 1);
                }
              }}
              disabled={!canAdvance || busy || structuring}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-40"
            >
              {step.key === "raw" ? (
                <>Structure my strategy <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Next <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          ) : null}

        </div>
      </div>
      <StructuringOverlay show={structuring} />
    </Shell>
  );
}

function StructuringOverlay({ show }: { show: boolean }) {
  const phrases = ["Structuring your logic…", "Extracting rules…", "Building your system…"];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!show) {
      setIdx(0);
      return;
    }
    const t = window.setInterval(() => setIdx((i) => (i + 1) % phrases.length), 600);
    return () => window.clearInterval(t);
  }, [show]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
        >
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-primary/10 ring-1 ring-primary/30" />
              <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-primary" />
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-sm font-medium tracking-tight text-foreground"
              >
                {phrases[idx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* -------------------------- Step 1: Account ------------------------- */
function StepAccount({
  bp,
  onChange,
  onName,
}: {
  bp: StrategyBlueprint;
  onChange: (a: AccountType[]) => void;
  onName: (n: string) => void;
}) {
  const toggle = (v: AccountType) => {
    const set = new Set(bp.account_types ?? []);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    onChange(Array.from(set));
  };
  return (
    <div className="space-y-7">
      <Question title="Name your strategy" sub="Anything works — you can change it later." />
      <input
        value={bp.name === "Untitled Strategy" ? "" : bp.name}
        onChange={(e) => onName(e.target.value || "Untitled Strategy")}
        placeholder="e.g. London breakout"
        className="w-full rounded-xl bg-card px-4 py-3 text-base ring-1 ring-border shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="pt-2">
        <p className="text-sm text-muted-foreground">What account is this for?</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {ACCOUNT_OPTIONS.map((opt) => {
            const active = bp.account_types?.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-left ring-1 transition ${
                  active
                    ? "bg-primary/10 ring-primary text-foreground shadow-soft"
                    : "bg-card ring-border hover:ring-primary/40"
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.hint}</div>
                </div>
                <div
                  className={`h-4 w-4 rounded-full ring-1 transition ${
                    active ? "bg-primary ring-primary" : "ring-border"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Step 2: Risk ----------------------------- */
function StepRisk({
  bp,
  patch,
}: {
  bp: StrategyBlueprint;
  patch: (p: Partial<StrategyBlueprint>) => Promise<void>;
}) {
  const fields: Array<{
    key: keyof StrategyBlueprint;
    label: string;
    placeholder: string;
    hint: string;
  }> = [
    { key: "risk_per_trade_pct", label: "Risk per trade", placeholder: "0.5", hint: "%" },
    { key: "daily_loss_limit_pct", label: "Daily loss limit", placeholder: "3", hint: "%" },
    { key: "max_drawdown_pct", label: "Max drawdown", placeholder: "10", hint: "%" },
  ];
  const overCap = (bp.risk_per_trade_pct ?? 0) > 5;
  return (
    <div className="space-y-7">
      <Question
        title="Set your risk envelope"
        sub="These become hard stops — exceeding them flags the trade."
      />
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={String(f.key)} className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {f.label}
            </label>
            <div className="mt-1 flex items-baseline gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                max={100}
                value={(bp[f.key] as number | null) ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  void patch({ [f.key]: v } as Partial<StrategyBlueprint>);
                }}
                className="w-full bg-transparent text-2xl font-semibold tracking-tight focus:outline-none"
              />
              <span className="text-sm text-muted-foreground">{f.hint}</span>
            </div>
          </div>
        ))}
        {overCap && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/5 p-3 ring-1 ring-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Above 5% per trade is unusually high. You can still continue.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------- Step 3: Raw input ------------------------ */
const STRATEGY_EXAMPLES = [
  "I wait for liquidity sweep then enter on rejection",
  "Only trade London/NY, max 3 trades, 0.5% risk",
  "Fibonacci 50–61.8%, confirmation candle required",
];

type DetectedTag = { label: string; key: string };

function detectSignals(text: string): DetectedTag[] {
  const t = text.toLowerCase();
  const tags: DetectedTag[] = [];
  // Pair detection (common FX, indices, crypto, metals)
  if (/\b(eur|gbp|usd|jpy|aud|nzd|cad|chf|xau|xag|btc|eth|nas|spx|us30|us100|gold|silver)[a-z]{0,3}\b/.test(t)) {
    tags.push({ key: "pair", label: "Pair" });
  }
  // Risk
  if (/\b\d+(\.\d+)?\s?%/.test(t) || /\brisk\b/.test(t)) {
    tags.push({ key: "risk", label: "Risk" });
  }
  // Entry model
  if (/\b(fib|fibonacci|liquidity|sweep|breakout|retest|order block|ob|fvg|smc|ict|supply|demand|reversal|trend|ema|rsi|macd|pattern|engulf|pin|rejection)\b/.test(t)) {
    tags.push({ key: "entry", label: "Entry model" });
  }
  // Trade limit
  if (/\bmax\s?\d+\b|\b\d+\s?(trades?|setups?)\b/.test(t)) {
    tags.push({ key: "limit", label: "Trade limit" });
  }
  // Sessions
  if (/\b(london|new ?york|ny|asia|tokyo|sydney|session)\b/.test(t)) {
    tags.push({ key: "session", label: "Session" });
  }
  // Stop loss / RR
  if (/\b(stop|sl|tp|take profit|r:?r|risk[- ]?reward)\b/.test(t)) {
    tags.push({ key: "exit", label: "Exit logic" });
  }
  return tags;
}

function StepRaw({
  bp,
  onChange,
}: {
  bp: StrategyBlueprint;
  onChange: (s: string) => void;
}) {
  const value = bp.raw_input ?? "";
  const detected = useMemo(() => detectSignals(value), [value]);
  return (
    <div className="space-y-6">
      <Question
        title="Define your strategy. I'll structure it."
        sub="Don't overthink it. Write it exactly how you trade."
      />

      {/* Smart prompt block */}
      <div className="rounded-xl bg-card/60 p-4 ring-1 ring-border/70">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          Inspiration
        </div>
        <ul className="mt-2 space-y-1.5">
          {STRATEGY_EXAMPLES.map((ex) => (
            <li key={ex} className="text-sm leading-relaxed text-foreground/70">
              <span className="text-muted-foreground">•</span> {ex}
            </li>
          ))}
        </ul>
      </div>

      {/* Input */}
      <div className="group relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={9}
          placeholder="Type freely. The way you'd explain it to a friend who trades."
          className="w-full resize-none rounded-2xl bg-card px-5 py-4 text-[15px] leading-relaxed ring-1 ring-border/70 shadow-soft transition-all duration-200 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:shadow-card-premium"
        />
      </div>

      {/* Live detection */}
      <div className="min-h-[28px]">
        <AnimatePresence mode="popLayout">
          {detected.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Detected
              </span>
              {detected.map((d) => (
                <motion.span
                  key={d.key}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary ring-1 ring-primary/20"
                >
                  <CheckCircle2 className="h-3 w-3" /> {d.label}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


/* -------------------------- Step 4: Tiers ---------------------------- */
function StepTiers({
  bp,
  patch,
}: {
  bp: StrategyBlueprint;
  patch: (p: Partial<StrategyBlueprint>) => Promise<void>;
}) {
  const t = bp.tier_strictness ?? { a_plus: 100, b_plus: 80, c: 60 };
  const r: TierRules = bp.tier_rules ?? { a_plus: "", b_plus: "", c: "" };

  // Single strictness dial (0-100). Maps to per-tier thresholds without
  // blocking anything — purely an interpretive hint for downstream AI.
  const [strictness, setStrictness] = useState<number>(() => {
    // Derive from existing a_plus threshold; default mid-high.
    const v = typeof t.a_plus === "number" ? t.a_plus : 90;
    return Math.max(0, Math.min(100, v));
  });
  const [active, setActive] = useState<keyof TierRules>("a_plus");

  const writeRule = (k: keyof TierRules, v: string) => {
    const nextStrict = {
      a_plus: strictness,
      b_plus: Math.max(0, strictness - 20),
      c: Math.max(0, strictness - 40),
    };
    void patch({ tier_rules: { ...r, [k]: v }, tier_strictness: nextStrict });
  };

  const writeStrictness = (n: number) => {
    setStrictness(n);
    void patch({
      tier_strictness: {
        a_plus: n,
        b_plus: Math.max(0, n - 20),
        c: Math.max(0, n - 40),
      },
      tier_rules: r,
    });
  };

  const tiers: Array<{
    k: keyof TierRules;
    title: string;
    sub: string;
    placeholder: string;
  }> = [
    {
      k: "a_plus",
      title: "Perfect setup",
      sub: "When everything aligns",
      placeholder:
        "All confirmations present, clean structure, strong rejection, R:R 2.5+",
    },
    {
      k: "b_plus",
      title: "Good setup",
      sub: "You'll still take it",
      placeholder: "Missing one confirmation, but structure still clean",
    },
    {
      k: "c",
      title: "Minimum setup",
      sub: "Anything below this = no trade",
      placeholder: "HTF bias + key level + R:R 1.5",
    },
  ];

  const strictnessLabel =
    strictness >= 80 ? "High" : strictness >= 50 ? "Balanced" : "Low";

  return (
    <div className="space-y-8">
      <Question
        title="Define your edge"
        sub="What qualifies a trade for you? Keep it simple."
      />

      {/* Strictness slider */}
      <div className="rounded-2xl bg-card/60 px-5 py-4 ring-1 ring-border/60 shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground tracking-wide">
            How strict are you?
          </span>
          <span className="text-xs font-semibold text-foreground">
            {strictnessLabel}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={strictness}
          onChange={(e) => writeStrictness(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label="Strictness"
        />
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* Tier cards */}
      <div className="space-y-4">
        {tiers.map(({ k, title, sub, placeholder }) => {
          const isActive = active === k;
          const value = r[k] ?? "";
          const hasContent = value.trim().length > 0;
          return (
            <motion.div
              key={k}
              onClick={() => setActive(k)}
              animate={{
                opacity: isActive ? 1 : 0.55,
                scale: isActive ? 1 : 0.99,
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`rounded-2xl bg-card px-5 py-4 cursor-text transition-shadow ${
                isActive
                  ? "shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-primary/25"
                  : "shadow-soft ring-1 ring-border/50"
              }`}
            >
              <div className="mb-2">
                <div className="text-sm font-semibold tracking-tight text-foreground">
                  {title}
                </div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
              <textarea
                value={value}
                onFocus={() => setActive(k)}
                onChange={(e) => writeRule(k, e.target.value)}
                rows={isActive ? 3 : 2}
                placeholder={placeholder}
                autoFocus={isActive && !hasContent}
                className="w-full rounded-xl bg-background/70 px-4 py-3 text-sm placeholder:text-muted-foreground/60 border-0 ring-1 ring-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-all"
              />
              <AnimatePresence mode="wait">
                {isActive && hasContent ? (
                  <motion.div
                    key="good"
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[11px] text-muted-foreground mt-2 pl-1"
                  >
                    Good. This defines your standard.
                  </motion.div>
                ) : !hasContent && isActive ? (
                  <motion.div
                    key="hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[11px] text-muted-foreground/80 mt-2 pl-1 italic"
                  >
                    Seneca will fill this based on your strategy…
                  </motion.div>
                ) : !hasContent && !isActive ? (
                  <motion.div
                    key="skipped"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[11px] text-foreground/70 mt-2 pl-1"
                  >
                    Refined by Seneca ✓
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground/70 text-center">
        Leave it blank — Seneca will refine the rest.
      </p>
    </div>
  );
}

/* -------------------------- Step 5: Parse ---------------------------- */
function StepParse({
  bp,
  patch,
  setBusy,
  busy,
}: {
  bp: StrategyBlueprint;
  patch: (p: Partial<StrategyBlueprint>) => Promise<void>;
  setBusy: (b: boolean) => void;
  busy: boolean;
}) {
  const autoRanRef = useRef(false);
  const rules = (bp.structured_rules ?? {}) as Partial<StructuredRules>;
  const hasRules = Object.values(rules).some((a) => Array.isArray(a) && a.length > 0);

  const run = async () => {
    if (!bp.raw_input || bp.raw_input.trim().length < 20) return;
    setBusy(true);
    try {
      const call = supabase.functions.invoke("parse-strategy", {
        body: {
          rawInput: bp.raw_input,
          accountTypes: bp.account_types,
          riskProfile: {
            risk_per_trade_pct: bp.risk_per_trade_pct,
            daily_loss_limit_pct: bp.daily_loss_limit_pct,
            max_drawdown_pct: bp.max_drawdown_pct,
          },
          refinementHistory: bp.refinement_history ?? [],
          tierRules: bp.tier_rules,
        },
      });
      const { data, error } = (await withTimeout(call, 25000, "parse")) as Awaited<typeof call>;
      if (error) throw error;
      const questions = (data.refinement_questions as string[]) ?? [];
      const prev = bp.refinement_history ?? [];
      const nextHistory: RefinementQA[] = questions.map((q) => {
        const found = prev.find((p) => p.question === q);
        return found ?? { question: q, answer: "", accepted: false };
      });
      await patch({
        structured_rules: data.structured_rules as StructuredRules,
        ambiguity_flags: (data.ambiguity_flags as AmbiguityFlag[]) ?? [],
        refinement_history: nextHistory,
        status: "parsed",
      });
    } catch (err) {
      console.error("[parse] failed", err);
      toast.error("Couldn't parse — try again.");
    } finally {
      setBusy(false);
    }
  };

  // Auto-run once on mount if we have raw input but no rules yet.
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    if (!hasRules && (bp.raw_input?.trim().length ?? 0) >= 20) {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Question
        title="Structuring your edge"
        sub="Seneca restates your words as binary rules. Nothing invented."
      />

      {busy && !hasRules ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Seneca is reading your strategy
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-border shadow-soft hover:bg-background disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {hasRules ? "Refine again" : "Refine with Seneca"}
          </button>

          {hasRules && (
            <div className="space-y-3">
              {(Object.keys(EMPTY_RULES) as Array<keyof StructuredRules>).map((k) => {
                const items = rules[k] ?? [];
                if (!items.length) return null;
                return (
                  <div key={k} className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {k}
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {items.map((it, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------- Step 6: Refine --------------------------- */
// Single optional screen. If AI returned no questions, we show a calm
// "looking sharp" state and the user moves on. Never blocking.
function StepRefine({
  bp,
  patch,
  setBusy,
  busy,
}: {
  bp: StrategyBlueprint;
  patch: (p: Partial<StrategyBlueprint>) => Promise<void>;
  setBusy: (b: boolean) => void;
  busy: boolean;
}) {
  const history = bp.refinement_history ?? [];
  const [drafts, setDrafts] = useState<string[]>(() => history.map((h) => h.answer ?? ""));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced bulk save.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const next: RefinementQA[] = history.map((h, i) => ({
        question: h.question,
        answer: drafts[i] ?? "",
        accepted: (drafts[i] ?? "").trim().length > 0,
      }));
      // Only persist if anything actually differs.
      const changed = next.some(
        (n, i) =>
          n.answer !== (history[i]?.answer ?? "") ||
          n.accepted !== (history[i]?.accepted ?? false),
      );
      if (changed) void patch({ refinement_history: next });
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  const reparse = async () => {
    setBusy(true);
    try {
      const call = supabase.functions.invoke("parse-strategy", {
        body: {
          rawInput: bp.raw_input,
          accountTypes: bp.account_types,
          riskProfile: {
            risk_per_trade_pct: bp.risk_per_trade_pct,
            daily_loss_limit_pct: bp.daily_loss_limit_pct,
            max_drawdown_pct: bp.max_drawdown_pct,
          },
          refinementHistory: history.map((h, i) => ({
            question: h.question,
            answer: drafts[i] ?? "",
          })),
          tierRules: bp.tier_rules,
        },
      });
      const { data, error } = (await withTimeout(call, 25000, "parse")) as Awaited<typeof call>;
      if (error) throw error;
      await patch({
        structured_rules: data.structured_rules,
        ambiguity_flags: data.ambiguity_flags,
        status: "refined",
      });
      toast.success("Refined.");
    } catch (err) {
      console.error(err);
      toast.error("Re-parse failed.");
    } finally {
      setBusy(false);
    }
  };

  if (history.length === 0) {
    return (
      <div className="space-y-6">
        <Question title="Looking sharp" sub="Nothing to clarify — your rules are clear enough." />
        <div className="flex items-center gap-2 rounded-xl bg-card p-4 ring-1 ring-border shadow-soft text-sm text-foreground/80">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          No clarifications needed.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Question
        title="Anything to tighten?"
        sub="All optional. Skip what doesn't matter."
      />
      <div className="space-y-3">
        {history.map((qa, i) => (
          <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
            <div className="text-sm font-medium text-foreground">{qa.question}</div>
            <input
              value={drafts[i] ?? ""}
              onChange={(e) => {
                const next = drafts.slice();
                next[i] = e.target.value;
                setDrafts(next);
              }}
              placeholder="Type freely — optional"
              className="mt-2 w-full rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={reparse}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-border shadow-soft hover:bg-background disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Apply answers
      </button>
    </div>
  );
}

/* -------------------------- Step 7: Output --------------------------- */
function StepOutput({
  bp,
  patch,
  setBusy,
  busy,
  atomicityIssues,
}: {
  bp: StrategyBlueprint;
  patch: (p: Partial<StrategyBlueprint>) => Promise<void>;
  setBusy: (b: boolean) => void;
  busy: boolean;
  atomicityIssues: RuleAtomicityIssue[];
}) {
  const cl = (bp.checklist ?? {}) as Partial<ChecklistByTier>;
  const has = !!bp.trading_plan && (cl?.a_plus?.length ?? 0) > 0;
  const blocked = atomicityIssues.length > 0;

  const generate = async () => {
    setBusy(true);
    try {
      const call = supabase.functions.invoke("generate-strategy-output", {
        body: {
          name: bp.name,
          accountTypes: bp.account_types,
          riskProfile: {
            risk_per_trade_pct: bp.risk_per_trade_pct,
            daily_loss_limit_pct: bp.daily_loss_limit_pct,
            max_drawdown_pct: bp.max_drawdown_pct,
          },
          structuredRules: bp.structured_rules,
          tierStrictness: bp.tier_strictness,
        },
      });
      const { data, error } = (await withTimeout(call, 25000, "generate")) as Awaited<typeof call>;
      if (error) throw error;
      await patch({
        checklist: data.checklist as ChecklistByTier,
        trading_plan: data.trading_plan as string,
        status: "finalized",
      });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't generate — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Question
        title={has ? "Your system" : "Generate your system"}
        sub={has ? "Short. Binary. Built from your rules." : "We'll turn your rules into a checklist + plan."}
      />

      {!has && (
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate
        </button>
      )}

      {has && (
        <div className="space-y-3">
          {(
            [
              ["a_plus", "A+   Perfect"],
              ["b_plus", "B+   Acceptable"],
              ["c", "C    Minimum"],
            ] as const
          ).map(([k, label]) => {
            const items = cl?.[k] ?? [];
            if (!items.length) return null;
            return (
              <div key={k} className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {label}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Trading plan
            </div>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
              {bp.trading_plan}
            </pre>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-card px-4 py-2 text-xs font-medium text-foreground/80 ring-1 ring-border hover:bg-background disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------- Step 8: Export --------------------------- */
function StepExport({ bp }: { bp: StrategyBlueprint }) {
  const [pending, setPending] = useState<string | null>(null);
  const ready = !!bp.trading_plan && (bp.checklist?.a_plus?.length ?? 0) > 0;

  const doPdf = async (kind: "checklist" | "plan") => {
    setPending(`pdf-${kind}`);
    // Yield a frame so the "Preparing…" label paints before jsPDF blocks.
    await new Promise((r) => setTimeout(r, 50));
    const ok = downloadPdf(bp, kind);
    if (!ok) {
      // Silent fallback — user never sees a failure.
      downloadTxt(bp, kind);
    }
    setPending(null);
  };

  const doTxt = (kind: "checklist" | "plan") => {
    setPending(`txt-${kind}`);
    setTimeout(() => {
      downloadTxt(bp, kind);
      setPending(null);
    }, 30);
  };

  if (!ready) {
    return (
      <div className="space-y-6">
        <Question title="Export" sub="Generate your system first, then export it." />
      </div>
    );
  }

  const Row = ({ kind, label }: { kind: "checklist" | "plan"; label: string }) => {
    const isPreparing = pending === `pdf-${kind}`;
    return (
      <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className="text-xs text-muted-foreground">PDF or plain text</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void doPdf(kind)}
              disabled={pending !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-70"
            >
              {isPreparing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Preparing your file…
                </>
              ) : (
                <>
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => doTxt(kind)}
              disabled={pending !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border hover:bg-card disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Text
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Question title="Export" sub="Take it offline. Pin it next to your screen." />
      <div className="space-y-3">
        <Row kind="checklist" label="Checklist" />
        <Row kind="plan" label="Trading plan" />
      </div>
    </div>
  );
}

/* -------------------------- Step 9: Lock ----------------------------- */
function StepLock({
  bp,
  setBp,
}: {
  bp: StrategyBlueprint;
  setBp: (b: StrategyBlueprint) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const requiredWord = bp.locked ? "UNLOCK" : "LOCK";
  // Strict, case-sensitive match — must be exactly LOCK (or UNLOCK).
  const canConfirm = confirmText === requiredWord;

  const apply = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      const next = bp.locked
        ? await unlockBlueprint(bp.id)
        : await lockBlueprint(bp.id);
      setBp(next);
      toast.success(next.locked ? "Locked." : "Unlocked.");
      setConfirmText("");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't change lock state.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Question
        title={bp.locked ? "Strategy is locked" : "Lock it in"}
        sub={
          bp.locked
            ? "Live across Chart, Trade Check, Journal, and Mentor."
            : "Locked strategies feed every other tool. You can unlock anytime."
        }
      />
      <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-primary" />
          <div className="text-sm text-foreground/80">
            Type{" "}
            <span className="font-mono font-semibold text-foreground">
              {requiredWord}
            </span>{" "}
            to confirm.
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canConfirm) {
              e.preventDefault();
              void apply();
            }
          }}
          placeholder={requiredWord}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={busy}
          className="w-full rounded-lg bg-background px-3 py-2 text-sm font-mono ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={apply}
          disabled={!canConfirm || busy}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40 ${
            bp.locked
              ? "bg-card text-foreground ring-1 ring-border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : bp.locked ? (
            <LockOpen className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {bp.locked ? "Unlock" : "Lock strategy"}
        </button>
      </div>
    </div>
  );
}

/* -------------------------- Shared ----------------------------------- */
function Question({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* -------------------- Soft re-validation banner --------------------- */
function ReValidateBanner({
  report,
  onJump,
}: {
  report: IntelligenceReport;
  onJump: () => void;
}) {
  const issueCount =
    report.contradictions.length +
    report.vague.length +
    report.missing.length +
    report.overlaps.length;
  if (issueCount === 0) return null;
  const tone =
    report.contradictions.length > 0
      ? "border-amber-500/40 bg-amber-500/5"
      : "border-primary/30 bg-primary/5";
  return (
    <button
      type="button"
      onClick={onJump}
      className={`mt-4 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition hover:bg-card ${tone}`}
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <div className="font-medium text-foreground">
            {issueCount} thing{issueCount === 1 ? "" : "s"} to tighten
          </div>
          <div className="text-[11px] text-muted-foreground">
            Score {report.score.total} · Tier {report.score.tier} · Tap to review
          </div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

/* ----------------------- Step: Interrogate -------------------------- */
function StepInterrogate({
  bp,
  patch,
  report,
  verdict,
}: {
  bp: StrategyBlueprint;
  patch: (p: Partial<StrategyBlueprint>) => Promise<void>;
  report: IntelligenceReport;
  verdict: StrictnessVerdict;
}) {
  const rules = readRules(bp);

  const removeRule = async (cat: RuleCategoryV2, rule: string) => {
    const list = (rules[cat] ?? []).filter((r) => r !== rule);
    await patch({
      structured_rules: { ...rules, [cat]: list } as StructuredRules,
    });
  };

  const addRule = async (cat: RuleCategoryV2, rule: string) => {
    const list = [...(rules[cat] ?? []), rule];
    await patch({
      structured_rules: { ...rules, [cat]: list } as StructuredRules,
    });
  };

  const replaceRules = async (cat: RuleCategoryV2, oldRules: string[], merged: string) => {
    const remaining = (rules[cat] ?? []).filter((r) => !oldRules.includes(r));
    await patch({
      structured_rules: { ...rules, [cat]: [...remaining, merged] } as StructuredRules,
    });
  };

  if (report.clean) {
    return (
      <div className="space-y-6">
        <Question
          title="Your strategy holds up"
          sub="No contradictions. No vague rules. Nothing missing. Move on."
        />
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Clean. Tier <span className="font-semibold">{report.score.tier}</span> · Score {report.score.total}.
          </div>
          <ScoreBars report={report} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Question
        title="Pressure-test your strategy"
        sub="I scanned your rules. Here's what doesn't hold up."
      />

      {/* Strictness gate — block finalize when severity = "block" */}
      {verdict.severity === "block" && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" /> Refinement required
          </div>
          <p className="mt-1.5 text-sm text-foreground">
            Your strategy can't be finalized until the issues below are resolved.
          </p>
          <ul className="mt-2 space-y-1 text-[12.5px] text-foreground/80">
            {verdict.reasons.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
      {verdict.severity === "warn" && !report.clean && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-[12.5px] text-foreground/80">
          You can proceed, but tightening these rules will sharpen your edge.
        </div>
      )}

      {/* Live score */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Completeness
          </div>
          <div className="text-sm font-semibold text-foreground">
            {report.score.total} · {report.score.tier}
          </div>
        </div>
        <ScoreBars report={report} />
      </div>

      {/* Contradictions */}
      {report.contradictions.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Contradiction · {c.category}
          </div>
          <p className="mt-1.5 text-sm text-foreground">{c.message}</p>
          <ul className="mt-2 space-y-1.5">
            {c.conflicting.map((r, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-2 rounded-lg bg-card/60 px-3 py-2 text-[13px] text-foreground/90 ring-1 ring-border/60"
              >
                <span className="flex-1">{r}</span>
                <button
                  type="button"
                  onClick={() => {
                    for (const cat of ["entry", "context", "behavior", "confirmation", "risk"] as const) {
                      if ((rules[cat] ?? []).includes(r)) {
                        void removeRule(cat, r);
                        return;
                      }
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Drop
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Missing */}
      {report.missing.map((m) => (
        <MissingPrompt
          key={m.category}
          area={m}
          onSubmit={(text) => addRule(m.category, text)}
        />
      ))}

      {/* Vague rules */}
      {report.vague.length > 0 && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" /> Vague rules
          </div>
          <ul className="mt-2 space-y-2.5">
            {report.vague.map((v, i) => (
              <VagueRuleRow
                key={i}
                v={v}
                onReplace={(newText) => {
                  const list = (rules[v.category] ?? []).map((r) => (r === v.rule ? newText : r));
                  void patch({
                    structured_rules: { ...rules, [v.category]: list } as StructuredRules,
                  });
                }}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Overlaps */}
      {report.overlaps.map((o, i) => (
        <div
          key={i}
          className="rounded-xl border border-primary/30 bg-primary/5 p-4"
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            <GitMerge className="h-3.5 w-3.5" /> Overlap · {o.category}
          </div>
          <p className="mt-1.5 text-sm text-foreground">
            These look like the same idea. Merge them?
          </p>
          <ul className="mt-2 space-y-1">
            {o.rules.map((r, j) => (
              <li key={j} className="text-[12.5px] text-foreground/80">
                · {r}
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 ring-1 ring-border">
            <span className="text-[13px] text-foreground">→ {o.merged}</span>
            <button
              type="button"
              onClick={() => void replaceRules(o.category, o.rules, o.merged)}
              className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
            >
              Merge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreBars({ report }: { report: IntelligenceReport }) {
  const cats: RuleCategoryV2[] = ["entry", "confirmation", "context", "risk", "behavior"];
  return (
    <div className="mt-3 space-y-1.5">
      {cats.map((c) => {
        const p = report.score.perCategory[c];
        const pct = Math.round(p.pct * 100);
        return (
          <div key={c} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-20 capitalize">{c}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full bg-primary"
                style={{ width: p.total > 0 ? `${pct}%` : "0%" }}
              />
            </div>
            <span className="w-10 text-right tabular-nums">{p.total > 0 ? `${pct}%` : "—"}</span>
          </div>
        );
      })}
      {!report.score.hasInvalidation && (
        <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          No invalidation rules — capping tier at B+.
        </div>
      )}
    </div>
  );
}

function MissingPrompt({
  area,
  onSubmit,
}: {
  area: { category: RuleCategoryV2; prompt: string };
  onSubmit: (text: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5" /> Missing · {area.category}
      </div>
      <p className="mt-1.5 text-sm text-foreground">{area.prompt}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type the rule…"
          className="flex-1 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => {
            void onSubmit(draft.trim());
            setDraft("");
          }}
          className="rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function VagueRuleRow({
  v,
  onReplace,
}: {
  v: { category: RuleCategoryV2; rule: string; trigger: string; suggestion: string };
  onReplace: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.rule);
  return (
    <li className="rounded-lg bg-background/60 px-3 py-2.5 ring-1 ring-border/60">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {v.category} · "{v.trigger}"
        </span>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="text-[11px] text-primary hover:underline"
        >
          {editing ? "Cancel" : "Tighten"}
        </button>
      </div>
      <p className="mt-1 text-[13px] text-foreground">{v.rule}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{v.suggestion}</p>
      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 rounded-lg bg-card px-3 py-1.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => {
              if (draft.trim() && draft !== v.rule) {
                onReplace(draft.trim());
              }
              setEditing(false);
            }}
            className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground"
          >
            Save
          </button>
        </div>
      )}
    </li>
  );
}

export function NewStrategyButton() {
  return (
    <Link
      to="/hub/strategy/new"
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95"
    >
      <Plus className="h-4 w-4" /> New strategy
    </Link>
  );
}
