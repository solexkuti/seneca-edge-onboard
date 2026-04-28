// StrategyBuilder — 9-step guided flow that turns raw input into a locked,
// enforceable trading system.
//
// Steps:
// 1) Account type (multi-select)         -> adjusts strictness defaults
// 2) Risk profile                        -> per-trade %, daily loss %, max DD %
// 3) Raw strategy input                  -> free text
// 4) Tier strictness                     -> A+ / B+ / C sliders
// 5) AI interpretation                   -> structured rules + ambiguity flags
// 6) Refinement loop                     -> 3-5 precise questions
// 7) Output generation                   -> tier checklist + trading plan
// 8) Export                              -> PDF (checklist / plan)
// 9) Lock                                -> prevents casual edits
//
// Safety: AI never predicts direction; only restructures the user's own words.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  LockOpen,
  Loader2,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ShieldAlert,
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
  createBlueprint,
  getBlueprint,
  updateBlueprint,
  lockBlueprint,
  unlockBlueprint,
} from "@/lib/dbStrategyBlueprints";
import { supabase } from "@/integrations/supabase/client";

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
  { key: "parse", label: "AI parse" },
  { key: "refine", label: "Refine" },
  { key: "output", label: "Output" },
  { key: "export", label: "Export" },
  { key: "lock", label: "Lock" },
];

export default function StrategyBuilder({
  blueprintId,
}: {
  blueprintId?: string;
}) {
  const navigate = useNavigate();
  const [bp, setBp] = useState<StrategyBlueprint | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const step = STEPS[stepIdx];

  // Bootstrap: load existing or create new.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (blueprintId) {
          const existing = await getBlueprint(blueprintId);
          if (existing && !cancelled) setBp(existing);
        } else {
          const created = await createBlueprint();
          if (!cancelled) {
            setBp(created);
            void navigate({
              to: "/hub/strategy/$id",
              params: { id: created.id },
              replace: true,
            });
          }
        }
      } catch (err) {
        console.error("bootstrap blueprint failed", err);
        toast.error("Could not load strategy. Are you signed in?");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blueprintId, navigate]);

  const patch = async (p: Partial<StrategyBlueprint>) => {
    if (!bp) return;
    setBp({ ...bp, ...p });
    try {
      const updated = await updateBlueprint(bp.id, p);
      setBp(updated);
    } catch (err) {
      console.error("update failed", err);
      toast.error("Could not save changes.");
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
        return (bp.raw_input?.trim().length ?? 0) >= 30;
      case "tiers":
        return true;
      case "parse":
        return Object.values(bp.structured_rules ?? {}).some(
          (a) => Array.isArray(a) && a.length > 0,
        );
      case "refine":
        // require all ambiguity flags addressed OR at least 3 accepted answers
        return (
          (bp.refinement_history?.filter((r) => r.accepted).length ?? 0) >= 3 ||
          (bp.ambiguity_flags?.length ?? 0) === 0
        );
      case "output":
        return !!bp.trading_plan && (bp.checklist?.a_plus?.length ?? 0) > 0;
      case "export":
        return true;
      case "lock":
        return true;
    }
  }, [bp, step.key]);

  if (!bp) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div className="relative z-10 mx-auto w-full max-w-[640px] px-5 pt-6 pb-24">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/hub/strategy"
            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border shadow-soft transition-all hover:shadow-card-premium"
            aria-label="Back to strategies"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="text-xs font-medium text-muted-foreground">
            Step {stepIdx + 1} of {STEPS.length}
          </div>
          <div className="w-10" />
        </div>

        {/* Header */}
        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Strategy Builder
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {bp.name}
            {bp.locked && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary align-middle">
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
          </h1>
        </div>

        {/* Progress */}
        <div className="mt-4 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStepIdx(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIdx ? "bg-primary" : "bg-border"
              }`}
              aria-label={`Go to step ${i + 1}: ${s.label}`}
            />
          ))}
        </div>

        {/* Step body */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="rounded-2xl bg-card ring-1 ring-border shadow-soft p-5"
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
                <StepRaw
                  bp={bp}
                  onChange={(raw_input) => patch({ raw_input })}
                />
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
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-card disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {stepIdx < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
              disabled={!canAdvance || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-40"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/hub/strategy"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95"
            >
              Done
            </Link>
          )}
        </div>
      </div>
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
    <div className="space-y-4">
      <Header
        eyebrow="Step 1"
        title="What account is this for?"
        sub="We adjust strictness and risk defaults to match."
      />
      <input
        value={bp.name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Strategy name"
        className="w-full rounded-xl bg-background px-3 py-2.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="grid grid-cols-1 gap-2">
        {ACCOUNT_OPTIONS.map((opt) => {
          const active = bp.account_types?.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`flex items-center justify-between rounded-xl px-4 py-3 text-left ring-1 transition ${
                active
                  ? "bg-primary/10 ring-primary text-foreground"
                  : "bg-background ring-border hover:ring-primary/40"
              }`}
            >
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.hint}</div>
              </div>
              <div
                className={`h-4 w-4 rounded-full ring-1 ${
                  active ? "bg-primary ring-primary" : "ring-border"
                }`}
              />
            </button>
          );
        })}
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
    {
      key: "risk_per_trade_pct",
      label: "Risk per trade (%)",
      placeholder: "0.50",
      hint: "Typical: 0.25 – 1.0",
    },
    {
      key: "daily_loss_limit_pct",
      label: "Daily loss limit (%)",
      placeholder: "3.00",
      hint: "Hard stop for the day",
    },
    {
      key: "max_drawdown_pct",
      label: "Max drawdown (%)",
      placeholder: "10.00",
      hint: "Account-wide cap",
    },
  ];
  const overCap = (bp.risk_per_trade_pct ?? 0) > 5;
  return (
    <div className="space-y-4">
      <Header
        eyebrow="Step 2"
        title="Set your risk envelope"
        sub="These numbers become hard stops in your checklist."
      />
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={String(f.key)}>
            <label className="block text-xs font-medium text-muted-foreground">
              {f.label}
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={100}
              value={(bp[f.key] as number | null) ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                void patch({ [f.key]: v } as Partial<StrategyBlueprint>);
              }}
              className="mt-1 w-full rounded-xl bg-background px-3 py-2.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-1 text-xs text-muted-foreground">{f.hint}</div>
          </div>
        ))}
        {overCap && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/5 p-3 ring-1 ring-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Risking more than 5% per trade is outside any sane discipline
              envelope. Consider lowering this before locking.
            </span>
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
    <div className="space-y-4">
      <Header
        eyebrow="Step 3"
        title="Describe your strategy in your own words"
        sub="Don't worry about structure — write it like you'd explain it to a friend."
      />
      <textarea
        value={bp.raw_input ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder="Example: I trade NY session breakouts on EURUSD. I wait for a clean break of London high or low, then a retest with rejection wick. I risk 0.5% per trade, max 3 trades a day, no trading after 2 losses. Stop above the wick, target 2R minimum."
        className="w-full rounded-xl bg-background px-3 py-2.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
      />
      <div className="text-xs text-muted-foreground">
        Minimum 30 characters. The more detail you give, the fewer questions
        we'll ask later.
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
  const updateStrict = (k: keyof typeof t, v: number) =>
    void patch({ tier_strictness: { ...t, [k]: v } });
  const updateRule = (k: keyof TierRules, v: string) =>
    void patch({ tier_rules: { ...r, [k]: v } });

  const tiers: Array<{
    k: keyof TierRules;
    title: string;
    sub: string;
    placeholder: string;
  }> = [
    {
      k: "a_plus",
      title: "A+ — Perfect execution only",
      sub: "Every condition met. No tolerance.",
      placeholder:
        "e.g. HTF bias aligned, key level reaction, volume confirmation, news clear, R:R ≥ 2.5",
    },
    {
      k: "b_plus",
      title: "B+ — One tolerated flaw",
      sub: "Strong setup, missing one non-critical item.",
      placeholder:
        "e.g. all A+ except either volume confirmation OR news clear can be missing",
    },
    {
      k: "c",
      title: "C — Minimum acceptable",
      sub: "Bare baseline. Below this you stand down.",
      placeholder:
        "e.g. HTF bias aligned + key level + R:R ≥ 1.5 — anything less = no trade",
    },
  ];

  return (
    <div className="space-y-4">
      <Header
        eyebrow="Step 4"
        title="Define your standards"
        sub="Strictness controls how rigidly each tier is enforced."
      />
      {tiers.map(({ k, title, sub, placeholder }) => (
        <div
          key={k}
          className="rounded-xl bg-background p-3 ring-1 ring-border space-y-2"
        >
          <div>
            <div className="text-sm font-medium text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </div>
          <textarea
            value={r[k] ?? ""}
            onChange={(e) => updateRule(k, e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Strictness</span>
              <span className="font-medium text-foreground/90">{t[k]}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={t[k]}
              onChange={(e) => updateStrict(k, Number(e.target.value))}
              className="mt-1 w-full accent-primary"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------- Step 5: AI parse ------------------------- */
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
  const run = async () => {
    if (!bp.raw_input || bp.raw_input.trim().length < 30) {
      toast.error("Add more detail to Step 3 first.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-strategy", {
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
      if (error) throw error;
      const rules = data.structured_rules as StructuredRules;
      const flags = data.ambiguity_flags as AmbiguityFlag[];
      const questions = data.refinement_questions as string[];
      // Seed refinement_history with new questions (preserve existing answers).
      const prev = bp.refinement_history ?? [];
      const nextHistory: RefinementQA[] = questions.map((q) => {
        const found = prev.find((p) => p.question === q);
        return found ?? { question: q, answer: "", accepted: false };
      });
      await patch({
        structured_rules: rules,
        ambiguity_flags: flags,
        refinement_history: nextHistory,
        status: "parsed",
      });
      toast.success("Parsed your strategy.");
    } catch (err) {
      console.error("parse error", err);
      const msg = err instanceof Error ? err.message : "Parse failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const rules = bp.structured_rules as Partial<StructuredRules>;
  const hasRules = Object.values(rules ?? {}).some(
    (a) => Array.isArray(a) && a.length > 0,
  );

  return (
    <div className="space-y-4">
      <Header
        eyebrow="Step 5"
        title="AI structures your rules"
        sub="The model only restructures what you wrote. It does not predict markets."
      />
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {hasRules ? "Re-parse" : "Parse with AI"}
      </button>

      {hasRules && (
        <div className="space-y-3">
          {(Object.keys(EMPTY_RULES) as Array<keyof StructuredRules>).map(
            (k) => {
              const items = rules[k] ?? [];
              if (!items.length) return null;
              return (
                <div
                  key={k}
                  className="rounded-xl bg-background p-3 ring-1 ring-border"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {k}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {items.map((it, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground/90"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            },
          )}
          {(bp.ambiguity_flags?.length ?? 0) > 0 && (
            <div className="rounded-xl bg-amber-500/5 p-3 ring-1 ring-amber-500/30">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Ambiguities to resolve
              </div>
              <ul className="mt-1 space-y-1 text-sm text-foreground/90">
                {bp.ambiguity_flags.map((f, i) => (
                  <li key={i}>
                    <span className="text-xs uppercase text-amber-700 dark:text-amber-400">
                      [{f.area}]
                    </span>{" "}
                    {f.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------- Step 6: Refinement ----------------------- */
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

  const setAnswer = (i: number, answer: string) => {
    const next = history.map((h, idx) => (idx === i ? { ...h, answer } : h));
    void patch({ refinement_history: next });
  };
  const accept = (i: number) => {
    const item = history[i];
    if (!item) return;
    if (
      !item.answer ||
      item.answer.trim().length < 4 ||
      /^(yes|no|idk|maybe|sure|nope)\.?$/i.test(item.answer.trim())
    ) {
      toast.error("Be specific — vague answers don't count.");
      return;
    }
    const next = history.map((h, idx) =>
      idx === i ? { ...h, accepted: true } : h,
    );
    void patch({ refinement_history: next });
  };

  const reparse = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-strategy", {
        body: {
          rawInput: bp.raw_input,
          accountTypes: bp.account_types,
          riskProfile: {
            risk_per_trade_pct: bp.risk_per_trade_pct,
            daily_loss_limit_pct: bp.daily_loss_limit_pct,
            max_drawdown_pct: bp.max_drawdown_pct,
          },
          refinementHistory: history.filter((h) => h.accepted),
          tierRules: bp.tier_rules,
        },
      });
      if (error) throw error;
      await patch({
        structured_rules: data.structured_rules,
        ambiguity_flags: data.ambiguity_flags,
        status: "refined",
      });
      toast.success("Rules updated with your answers.");
    } catch (err) {
      console.error(err);
      toast.error("Re-parse failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Header
        eyebrow="Step 6"
        title="Refine the gaps"
        sub="Answer precisely. Vague answers will be rejected."
      />
      {history.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No questions yet — run the parse step first.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((h, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 ring-1 ${
                h.accepted
                  ? "bg-primary/5 ring-primary/30"
                  : "bg-background ring-border"
              }`}
            >
              <div className="text-sm font-medium text-foreground">
                {h.question}
              </div>
              <textarea
                value={h.answer}
                onChange={(e) => setAnswer(i, e.target.value)}
                rows={2}
                placeholder="Your precise answer…"
                disabled={h.accepted}
                className="mt-2 w-full rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70 resize-none"
              />
              <div className="mt-2 flex justify-end">
                {h.accepted ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Accepted
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => accept(i)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95"
                  >
                    Accept answer
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={reparse}
            disabled={
              busy || history.filter((h) => h.accepted).length === 0
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-border hover:bg-background disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Apply answers & re-parse
          </button>
        </div>
      )}
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
  const generate = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-strategy-output",
        {
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
        },
      );
      if (error) throw error;
      await patch({
        checklist: data.checklist as ChecklistByTier,
        trading_plan: data.trading_plan as string,
        status: "finalized",
      });
      toast.success("Checklist & plan generated.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const cl = bp.checklist as Partial<ChecklistByTier>;
  const has = bp.trading_plan && (cl?.a_plus?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <Header
        eyebrow="Step 7"
        title="Generate checklist & plan"
        sub="A binary checklist per tier, plus a clean trading plan."
      />
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {has ? "Regenerate" : "Generate"}
      </button>

      {has && (
        <div className="space-y-3">
          {(
            [
              ["a_plus", "A+ — Perfect"],
              ["b_plus", "B+ — Acceptable"],
              ["c", "C — Minimum"],
            ] as const
          ).map(([k, label]) => {
            const items = cl?.[k] ?? [];
            if (!items.length) return null;
            return (
              <div
                key={k}
                className="rounded-xl bg-background p-3 ring-1 ring-border"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <ul className="mt-1 space-y-1">
                  {items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-foreground/90"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div className="rounded-xl bg-background p-3 ring-1 ring-border">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Trading plan
            </div>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
              {bp.trading_plan}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------- Step 8: Export --------------------------- */
function StepExport({ bp }: { bp: StrategyBlueprint }) {
  const [downloading, setDownloading] = useState<"checklist" | "plan" | null>(
    null,
  );
  const download = async (kind: "checklist" | "plan") => {
    setDownloading(kind);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-strategy-pdf`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sess.session?.access_token
            ? { Authorization: `Bearer ${sess.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          kind,
          name: bp.name,
          accountTypes: bp.account_types,
          riskProfile: {
            risk_per_trade_pct: bp.risk_per_trade_pct,
            daily_loss_limit_pct: bp.daily_loss_limit_pct,
            max_drawdown_pct: bp.max_drawdown_pct,
          },
          checklist: bp.checklist,
          trading_plan: bp.trading_plan,
        }),
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${bp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${kind}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error(err);
      toast.error("Could not generate PDF.");
    } finally {
      setDownloading(null);
    }
  };
  const ready = !!bp.trading_plan && (bp.checklist?.a_plus?.length ?? 0) > 0;
  return (
    <div className="space-y-4">
      <Header
        eyebrow="Step 8"
        title="Export"
        sub="Download a clean PDF for your binder or screen-side reference."
      />
      {!ready ? (
        <div className="text-sm text-muted-foreground">
          Generate the checklist & plan first.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              ["checklist", "Download checklist"],
              ["plan", "Download trading plan"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => download(kind)}
              disabled={downloading !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-medium text-foreground ring-1 ring-border hover:bg-background disabled:opacity-50"
            >
              {downloading === kind ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {label}
            </button>
          ))}
        </div>
      )}
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
  const toggle = async () => {
    setBusy(true);
    try {
      const next = bp.locked
        ? await unlockBlueprint(bp.id)
        : await lockBlueprint(bp.id);
      setBp(next);
      toast.success(next.locked ? "Strategy locked." : "Strategy unlocked.");
    } catch (err) {
      console.error(err);
      toast.error("Could not change lock state.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <Header
        eyebrow="Step 9"
        title="Lock the strategy"
        sub="Locked strategies feed your Chart, Trade Check, Journal scoring, and Mentor."
      />
      <div className="rounded-xl bg-background p-4 ring-1 ring-border">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <div className="text-sm text-foreground/90">
            Locking prevents casual edits. You can unlock at any time, but every
            unlock is a deliberate choice.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-soft hover:opacity-95 disabled:opacity-50 ${
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
        {bp.locked ? "Unlock strategy" : "Lock strategy"}
      </button>
    </div>
  );
}

/* -------------------------- Shared ----------------------------------- */
function Header({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
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
