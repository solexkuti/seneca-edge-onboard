// Chart Analyzer UI
// -----------------------------------------------------------------------------
// Strict pipeline:
//   1. Pick locked strategy
//   2. Upload BOTH execution + higher timeframe charts (required)
//   3. AI validates each image → reject if not a chart
//   4. AI extracts structured observations (no opinions)
//   5. Deterministic matcher scores against the strategy
//   6. AI explains the deterministic result (cannot change it)
// Failsafes block at every step.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  listBlueprints,
  type StrategyBlueprint,
} from "@/lib/dbStrategyBlueprints";
import {
  buildAnalyzerStrategy,
  type AnalyzerStrategy,
} from "@/lib/chartAnalyzer/schema";
import {
  passesChartGate,
  CHART_REJECTION_MESSAGE,
  type ChartValidation,
  type StructuredExtraction,
  type DualExtraction,
} from "@/lib/chartAnalyzer/extraction";
import {
  analyzeAgainstStrategy,
  type AnalyzerOutput,
} from "@/lib/chartAnalyzer/matcher";

type SlotKey = "execution" | "higher";

type Slot = {
  file: File | null;
  dataUrl: string | null;
  validation: ChartValidation | null;
  extraction: StructuredExtraction | null;
  validating: boolean;
  extracting: boolean;
  error: string | null;
};

const EMPTY_SLOT: Slot = {
  file: null,
  dataUrl: null,
  validation: null,
  extraction: null,
  validating: false,
  extracting: false,
  error: null,
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function ChartAnalyzer() {
  const [blueprints, setBlueprints] = useState<StrategyBlueprint[] | null>(null);
  const [strategyId, setStrategyId] = useState<string>("");
  const [execTf, setExecTf] = useState("5m");
  const [higherTf, setHigherTf] = useState("1h");
  const [riskPct, setRiskPct] = useState(1);

  const [exec, setExec] = useState<Slot>(EMPTY_SLOT);
  const [higher, setHigher] = useState<Slot>(EMPTY_SLOT);
  const [behaviorChecks, setBehaviorChecks] = useState<Record<string, boolean>>({});

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzerOutput | null>(null);
  const [explanation, setExplanation] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const list = await listBlueprints();
        setBlueprints(list);
        const locked = list.find((b) => b.locked) ?? list[0];
        if (locked) setStrategyId(locked.id);
      } catch (err) {
        console.error(err);
        toast.error("Could not load strategies.");
        setBlueprints([]);
      }
    })();
  }, []);

  const blueprint = useMemo(
    () => blueprints?.find((b) => b.id === strategyId) ?? null,
    [blueprints, strategyId],
  );

  // Build the strict AnalyzerStrategy from the blueprint each render. Cheap.
  const strategy: AnalyzerStrategy | null = useMemo(() => {
    if (!blueprint) return null;
    const r = blueprint.structured_rules ?? {};
    return buildAnalyzerStrategy({
      strategyId: blueprint.id,
      name: blueprint.name,
      timeframes: { execution: execTf, higher: higherTf },
      entry: [...(r.entry ?? []), ...(r.context ?? [])],
      confirmation: r.confirmation ?? [],
      risk: r.risk ?? [],
      behavior: r.behavior ?? [],
      maxRiskPercent: blueprint.risk_per_trade_pct ?? 1,
    });
  }, [blueprint, execTf, higherTf]);

  // Initialise behavior checkboxes whenever strategy changes
  useEffect(() => {
    if (!strategy) return;
    const next: Record<string, boolean> = {};
    for (const r of strategy.rules.behavior) next[r.id] = false;
    setBehaviorChecks(next);
  }, [strategy?.strategy_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSlot = (k: SlotKey, patch: Partial<Slot>) => {
    if (k === "execution") setExec((s) => ({ ...s, ...patch }));
    else setHigher((s) => ({ ...s, ...patch }));
  };

  const handleUpload = async (k: SlotKey, file: File) => {
    setSlot(k, { ...EMPTY_SLOT, file, validating: true });
    setResult(null);
    setExplanation("");
    try {
      const dataUrl = await fileToDataUrl(file);
      setSlot(k, { dataUrl });
      const { data, error } = await supabase.functions.invoke("validate-chart", {
        body: { image_url: dataUrl },
      });
      if (error) throw error;
      const v = data as ChartValidation;
      setSlot(k, { validation: v, validating: false });
      if (!passesChartGate(v)) {
        setSlot(k, { error: CHART_REJECTION_MESSAGE });
        toast.error(CHART_REJECTION_MESSAGE);
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Validation failed.";
      setSlot(k, { validating: false, error: msg });
      toast.error(msg);
    }
  };

  const reset = (k: SlotKey) => setSlot(k, EMPTY_SLOT);

  const canAnalyze =
    !!strategy &&
    !!exec.dataUrl &&
    !!higher.dataUrl &&
    !!exec.validation &&
    !!higher.validation &&
    passesChartGate(exec.validation) &&
    passesChartGate(higher.validation) &&
    !analyzing;

  const runAnalysis = async () => {
    if (!strategy || !exec.dataUrl || !higher.dataUrl) return;
    setAnalyzing(true);
    setResult(null);
    setExplanation("");
    try {
      // Step 4: structured extraction (AI, no opinions)
      const [execExt, higherExt] = await Promise.all([
        invokeExtract(exec.dataUrl, execTf),
        invokeExtract(higher.dataUrl, higherTf),
      ]);
      setSlot("execution", { extraction: execExt });
      setSlot("higher", { extraction: higherExt });

      const dual: DualExtraction = { execution: execExt, higher: higherExt };

      // Step 5+6: deterministic scoring + tier (no AI involvement)
      const out = analyzeAgainstStrategy(strategy, dual, {
        risk_percent: riskPct,
        behavior: behaviorChecks,
      });
      setResult(out);

      // Step 7: AI explanation (cannot change result)
      try {
        const { data, error } = await supabase.functions.invoke("explain-analysis", {
          body: { result: out, extraction: dual },
        });
        if (!error && data?.explanation) setExplanation(String(data.explanation));
      } catch {
        /* fallback: deterministic summary already on screen */
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div className="relative z-10 mx-auto w-full max-w-[720px] px-5 pt-6 pb-24">
        <div className="flex items-center justify-between">
          <Link
            to="/hub"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-card px-3 text-sm ring-1 ring-border shadow-soft hover:shadow-card-premium"
          >
            ← Hub
          </Link>
          <span className="inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground ring-1 ring-border">
            <ShieldCheck className="h-3.5 w-3.5" /> Deterministic engine
          </span>
        </div>

        <header className="mt-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Chart Analyzer
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Score this setup against your strategy.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload both timeframes. The engine — not the AI — decides if it qualifies.
          </p>
        </header>

        {/* STEP 1 — strategy + risk */}
        <Section title="1 · Strategy">
          {blueprints === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading strategies…
            </div>
          ) : blueprints.length === 0 ? (
            <EmptyStrategy />
          ) : (
            <div className="space-y-3">
              <select
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
                className="w-full rounded-xl bg-card px-3 py-2.5 text-sm ring-1 ring-border shadow-soft focus:outline-none"
              >
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.locked ? "· locked" : `· ${b.status}`}
                  </option>
                ))}
              </select>
              {blueprint && !blueprint.locked && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This strategy is not locked. Lock it before analyzing live trades.
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <LabeledField label="Execution TF">
                  <select
                    value={execTf}
                    onChange={(e) => setExecTf(e.target.value)}
                    className="w-full rounded-lg bg-background px-2 py-2 text-sm ring-1 ring-border"
                  >
                    {["1m", "3m", "5m", "15m", "30m"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </LabeledField>
                <LabeledField label="Higher TF">
                  <select
                    value={higherTf}
                    onChange={(e) => setHigherTf(e.target.value)}
                    className="w-full rounded-lg bg-background px-2 py-2 text-sm ring-1 ring-border"
                  >
                    {["30m", "1h", "2h", "4h", "1d"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </LabeledField>
                <LabeledField label="Risk %">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={riskPct}
                    onChange={(e) => setRiskPct(Number(e.target.value) || 0)}
                    className="w-full rounded-lg bg-background px-2 py-2 text-sm ring-1 ring-border"
                  />
                </LabeledField>
              </div>
            </div>
          )}
        </Section>

        {/* STEP 2 — uploads */}
        <Section title="2 · Charts (both required)">
          <div className="grid gap-3 sm:grid-cols-2">
            <UploadSlot
              label={`Execution chart · ${execTf}`}
              slot={exec}
              onPick={(f) => handleUpload("execution", f)}
              onReset={() => reset("execution")}
            />
            <UploadSlot
              label={`Higher TF chart · ${higherTf}`}
              slot={higher}
              onPick={(f) => handleUpload("higher", f)}
              onReset={() => reset("higher")}
            />
          </div>
        </Section>

        {/* STEP 3 — behavior confirmations */}
        {strategy && strategy.rules.behavior.length > 0 && (
          <Section title="3 · Behavior confirmations">
            <ul className="space-y-2">
              {strategy.rules.behavior.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
                >
                  <input
                    id={r.id}
                    type="checkbox"
                    checked={!!behaviorChecks[r.id]}
                    onChange={(e) =>
                      setBehaviorChecks((m) => ({ ...m, [r.id]: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <label htmlFor={r.id} className="text-sm text-foreground">
                    {r.label}
                  </label>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* STEP 4 — analyze */}
        <div className="mt-6">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={!canAnalyze}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Analyze setup
              </>
            )}
          </button>
          {!canAnalyze && !analyzing && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {!strategy
                ? "Pick a strategy."
                : !exec.dataUrl || !higher.dataUrl
                  ? "Upload both timeframe charts."
                  : "Both charts must pass validation before analysis."}
            </p>
          )}
        </div>

        {/* RESULT */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-border shadow-card-premium"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Result
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">
                    Tier {result.tier} · {result.score}/100
                  </h2>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    result.tier === "A"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : result.tier === "B"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {result.tier === "A" ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : result.tier === "C" ? (
                    <XCircle className="h-6 w-6" />
                  ) : (
                    <ShieldAlert className="h-6 w-6" />
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{result.summary}</p>

              {result.warnings.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {result.warnings.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 space-y-1.5">
                {result.breakdown.map((b) => (
                  <div
                    key={b.rule_id}
                    className="flex items-start gap-2 rounded-lg bg-background/60 p-2.5 ring-1 ring-border"
                  >
                    {b.result === "pass" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    )}
                    <div className="text-sm text-foreground">{b.explanation}</div>
                  </div>
                ))}
              </div>

              {explanation && (
                <div className="mt-4 rounded-xl bg-background/60 p-3 ring-1 ring-border">
                  <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    AI explanation
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-foreground">
                    {explanation}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- helpers ----------

async function invokeExtract(
  dataUrl: string,
  timeframe: string,
): Promise<StructuredExtraction> {
  const { data, error } = await supabase.functions.invoke("extract-chart", {
    body: { image_url: dataUrl, timeframe_label: timeframe },
  });
  if (error) throw error;
  return data as StructuredExtraction;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function UploadSlot({
  label,
  slot,
  onPick,
  onReset,
}: {
  label: string;
  slot: Slot;
  onPick: (f: File) => void;
  onReset: () => void;
}) {
  const blocked = slot.validation && !passesChartGate(slot.validation);
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-border shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {slot.dataUrl && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Replace
          </button>
        )}
      </div>

      {!slot.dataUrl ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 p-6 text-center text-xs text-muted-foreground hover:bg-background">
          <Upload className="h-5 w-5" />
          <span>Click to upload</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
            }}
          />
        </label>
      ) : (
        <div className="space-y-2">
          <img
            src={slot.dataUrl}
            alt={label}
            className="aspect-video w-full rounded-lg object-cover ring-1 ring-border"
          />
          {slot.validating && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validating image…
            </div>
          )}
          {slot.validation && passesChartGate(slot.validation) && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Chart validated · confidence {(slot.validation.confidence * 100).toFixed(0)}%
            </div>
          )}
          {blocked && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-700 dark:text-rose-300">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {slot.validation?.reason || CHART_REJECTION_MESSAGE}
            </div>
          )}
          {slot.error && !slot.validation && (
            <div className="text-xs text-rose-600">{slot.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyStrategy() {
  return (
    <div className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">
      You need a strategy before analyzing.{" "}
      <Link to="/hub/strategy/new" className="font-medium text-primary hover:underline">
        Build one →
      </Link>
    </div>
  );
}
