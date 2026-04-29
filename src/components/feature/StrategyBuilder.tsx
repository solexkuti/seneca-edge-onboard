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
      case "parse":
        return Object.values(bp.structured_rules ?? {}).some(
          (a) => Array.isArray(a) && a.length > 0,
        );
      case "output":
        return !!bp.trading_plan && (bp.checklist?.a_plus?.length ?? 0) > 0;
      // tiers / refine / export / lock — never block.
      default:
        return true;
    }
  }, [bp, step.key]);

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
              {step.key === "refine" && (
                <StepRefine bp={bp} patch={patch} setBusy={setBusy} busy={busy} />
              )}
              {step.key === "output" && (
                <StepOutput bp={bp} patch={patch} setBusy={setBusy} busy={busy} />
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
              onClick={() => void goToStep(stepIdx + 1)}
              disabled={!canAdvance || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-40"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/hub/strategy"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95"
            >
              Done
            </Link>
          )}
        </div>
      </div>
    </Shell>
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
function StepRaw({
  bp,
  onChange,
}: {
  bp: StrategyBlueprint;
  onChange: (s: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Question
        title="Describe your strategy"
        sub="Type it how you think. We'll refine it."
      />
      <textarea
        value={bp.raw_input ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder="I trade NY breakouts on EURUSD. Wait for a clean break of London high or low, then a retest. Risk 0.5%, max 3 trades a day, no trading after 2 losses..."
        className="w-full rounded-xl bg-card px-4 py-3 text-sm leading-relaxed ring-1 ring-border shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
      />
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
  const updateRule = (k: keyof TierRules, v: string) =>
    void patch({ tier_rules: { ...r, [k]: v }, tier_strictness: t });

  const tiers: Array<{
    k: keyof TierRules;
    title: string;
    sub: string;
    placeholder: string;
  }> = [
    {
      k: "a_plus",
      title: "A+   Perfect",
      sub: "Every condition met.",
      placeholder: "All confirmations. Clean structure. R:R ≥ 2.5",
    },
    {
      k: "b_plus",
      title: "B+   Acceptable",
      sub: "One non-critical item missing.",
      placeholder: "Solid setup, missing one confirmation",
    },
    {
      k: "c",
      title: "C    Minimum",
      sub: "Bare baseline. Below this you stand down.",
      placeholder: "HTF bias + key level + R:R ≥ 1.5",
    },
  ];

  return (
    <div className="space-y-6">
      <Question
        title="Define your standards"
        sub="Optional — leave blank to let AI infer them."
      />
      {tiers.map(({ k, title, sub, placeholder }) => (
        <div key={k} className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft space-y-2">
          <div>
            <div className="text-sm font-semibold tracking-tight text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </div>
          <textarea
            value={r[k] ?? ""}
            onChange={(e) => updateRule(k, e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>
      ))}
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
        sub="The AI restates your words as binary rules. Nothing invented."
      />

      {busy && !hasRules ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Reading your strategy
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
            {hasRules ? "Re-parse" : "Parse with AI"}
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
}: {
  bp: StrategyBlueprint;
  patch: (p: Partial<StrategyBlueprint>) => Promise<void>;
  setBusy: (b: boolean) => void;
  busy: boolean;
}) {
  const cl = (bp.checklist ?? {}) as Partial<ChecklistByTier>;
  const has = !!bp.trading_plan && (cl?.a_plus?.length ?? 0) > 0;

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
    // jsPDF runs synchronously but we yield a frame so the spinner shows.
    await new Promise((r) => setTimeout(r, 50));
    const ok = downloadPdf(bp, kind);
    if (!ok) {
      toast.error("PDF failed — downloading text instead.");
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

  const Row = ({ kind, label }: { kind: "checklist" | "plan"; label: string }) => (
    <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground">PDF or plain text</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void doPdf(kind)}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-50"
          >
            {pending === `pdf-${kind}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            PDF
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
  const [confirming, setConfirming] = useState<"lock" | "unlock" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const requiredWord = bp.locked ? "UNLOCK" : "LOCK";
  const canConfirm = confirmText.trim().toUpperCase() === requiredWord;

  const apply = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      const next = bp.locked ? await unlockBlueprint(bp.id) : await lockBlueprint(bp.id);
      setBp(next);
      toast.success(next.locked ? "Locked." : "Unlocked.");
      setConfirming(null);
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
            Type <span className="font-mono font-semibold text-foreground">{requiredWord}</span> to confirm.
          </div>
        </div>
      </div>

      {confirming === null ? (
        <button
          type="button"
          onClick={() => {
            setConfirming(bp.locked ? "unlock" : "lock");
            setConfirmText("");
          }}
          disabled={busy}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-soft hover:opacity-95 disabled:opacity-50 ${
            bp.locked
              ? "bg-card text-foreground ring-1 ring-border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {bp.locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {bp.locked ? "Unlock" : "Lock strategy"}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={requiredWord}
            className="w-full rounded-lg bg-background px-3 py-2 text-sm font-mono ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(null);
                setConfirmText("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!canConfirm || busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm
            </button>
          </div>
        </div>
      )}
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
