// Chart Analyzer — production flow:
// 1) Require strategy (redirect to builder if none)
// 2) Strategy + timeframe selection
// 3) Upload exec (required) + higher (optional) chart images
// 4) Pre-validation via AI (is this even a chart?)
// 5) AI feature extraction (observable structure only)
// 6) Deterministic rule check vs strategy
// 7) Display verdict + breakdown + AI insight + actions

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
  ArrowRight,
  Save,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import FeatureShell from "./FeatureShell";
import { listBlueprints, type StrategyBlueprint } from "@/lib/dbStrategyBlueprints";
import {
  uploadChartImage,
  signedUrl,
  saveChartAnalysis,
  type ChartAnalysisRow,
} from "@/lib/dbChartAnalyses";
import {
  evaluateChartAgainstStrategy,
  type ChartFeaturesPair,
  type RuleBreakdown,
  type ChartRegion,
} from "@/lib/chartRuleCheck";
import { supabase } from "@/integrations/supabase/client";

type ChartExplanation = {
  summary: string;
  aligns: string[];
  misaligns: string[];
  final_assessment: string;
};

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"] as const;

type Phase = "setup" | "analyzing" | "result" | "invalid";

const STEP_LABELS = [
  "Validating image",
  "Extracting market structure",
  "Checking against your strategy",
];

export default function ChartAnalyzer() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyBlueprint[] | null>(null);
  const [strategyId, setStrategyId] = useState<string>("");
  const [execTf, setExecTf] = useState<string>("15m");
  const [higherTf, setHigherTf] = useState<string>("");
  const [execFile, setExecFile] = useState<File | null>(null);
  const [higherFile, setHigherFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [step, setStep] = useState(0);
  const [invalidReason, setInvalidReason] = useState<string>("");
  const [invalidDetails, setInvalidDetails] = useState<string[]>([]);
  const [result, setResult] = useState<{
    row: ChartAnalysisRow;
    breakdown: RuleBreakdown;
    insight: string;
    execPreview: string;
    higherPreview: string | null;
    modelUsed: "primary" | "fallback";
    pipelineConfidence: number; // 0–1
    warnings: string[];
    explanation: ChartExplanation | null;
    explanationLoading: boolean;
    explanationError: string | null;
  } | null>(null);

  const execInputRef = useRef<HTMLInputElement>(null);
  const higherInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    listBlueprints()
      .then((list) => {
        if (!alive) return;
        setStrategies(list);
        if (list.length > 0) {
          const locked = list.find((s) => s.locked);
          setStrategyId((locked ?? list[0]).id);
        }
      })
      .catch(() => alive && setStrategies([]));
    return () => {
      alive = false;
    };
  }, []);

  const activeStrategy = useMemo(
    () => strategies?.find((s) => s.id === strategyId) ?? null,
    [strategies, strategyId],
  );

  // Strategy gate
  if (strategies !== null && strategies.length === 0) {
    return (
      <FeatureShell
        eyebrow="Chart Analyzer"
        title="Build a strategy first."
        subtitle="Chart analysis runs against YOUR rules. Define them once."
      >
        <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
              <AlertTriangle className="h-4 w-4" strokeWidth={2.4} />
            </div>
            <p className="text-[13px] leading-snug text-text-primary">
              No strategy found. Create and lock one in the Strategy Builder before analyzing charts.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/hub/strategy" })}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-mix px-4 py-3 text-[13.5px] font-semibold text-white shadow-soft transition hover:shadow-card-premium"
          >
            Open Strategy Builder
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </FeatureShell>
    );
  }

  const canAnalyze = !!activeStrategy && !!execFile && !!execTf;

  async function handleAnalyze() {
    if (!activeStrategy || !execFile) return;
    setPhase("analyzing");
    setStep(0);
    setResult(null);

    const execPreview = URL.createObjectURL(execFile);
    const higherPreview = higherFile ? URL.createObjectURL(higherFile) : null;

    try {
      // Upload images first (in parallel)
      const [execPath, higherPath] = await Promise.all([
        uploadChartImage(execFile, "exec"),
        higherFile ? uploadChartImage(higherFile, "higher") : Promise.resolve<string | null>(null),
      ]);
      setStep(1);

      const [execUrl, higherUrl] = await Promise.all([
        signedUrl(execPath),
        higherPath ? signedUrl(higherPath) : Promise.resolve<string | null>(null),
      ]);

      // Call analyze-chart edge function
      const { data, error } = await supabase.functions.invoke("analyze-chart", {
        body: {
          exec_image_url: execUrl,
          higher_image_url: higherUrl,
        },
      });
      if (error) throw new Error(error.message || "Analysis failed");

      // Pipeline rejected the image — show details from validation stage
      if (data?.status === "rejected" || data?.is_chart === false) {
        setInvalidReason(data?.reason || "This is not a valid chart.");
        setInvalidDetails(Array.isArray(data?.details) ? data.details : []);
        setPhase("invalid");
        return;
      }
      setStep(2);

      const features: ChartFeaturesPair = {
        exec: data.features?.exec ?? {},
        higher: data.features?.higher ?? null,
      };
      // Pipeline confidence is 0–1; rule engine expects 0–100 chart confidence.
      const pipelineConf: number = Number(data?.confidence ?? 0);
      const validationConfPct: number = Number(
        data?.confidence_pct ?? Math.round(pipelineConf * 100),
      );

      const breakdown = evaluateChartAgainstStrategy(
        features,
        activeStrategy.structured_rules as never,
        validationConfPct,
      );

      const warnings: string[] = Array.isArray(data?.warnings)
        ? [...data.warnings]
        : [];
      const modelUsed: "primary" | "fallback" =
        data?.model_used === "fallback" ? "fallback" : "primary";

      // Save to DB (back-compat shape preserved)
      const row = await saveChartAnalysis({
        blueprint_id: activeStrategy.id,
        strategy_name: activeStrategy.name,
        exec_timeframe: execTf,
        higher_timeframe: higherTf || null,
        exec_image_path: execPath,
        higher_image_path: higherPath,
        is_chart: true,
        chart_confidence: validationConfPct,
        chart_reason: data.reason ?? null,
        features,
        rule_breakdown: breakdown,
        verdict: breakdown.overall,
        ai_insight: data.ai_insight ?? null,
        trade_id: null,
      });

      setResult({
        row,
        breakdown,
        insight: data.ai_insight ?? "",
        execPreview,
        higherPreview,
        modelUsed,
        pipelineConfidence: pipelineConf,
        warnings,
        explanation: null,
        explanationLoading: true,
        explanationError: null,
      });
      setPhase("result");

      // Fire-and-update: fetch the structured mentor explanation.
      void (async () => {
        try {
          const { data: exp, error: expErr } = await supabase.functions.invoke(
            "explain-chart",
            {
              body: {
                strategy_name: activeStrategy.name,
                strategy_rules: activeStrategy.structured_rules,
                chart_features: features,
                rule_breakdown: breakdown,
              },
            },
          );
          if (expErr) throw new Error(expErr.message);
          const explanation = (exp as { explanation?: ChartExplanation } | null)
            ?.explanation;
          if (!explanation) throw new Error("No explanation returned");
          setResult((prev) =>
            prev ? { ...prev, explanation, explanationLoading: false } : prev,
          );
        } catch (err) {
          const m = err instanceof Error ? err.message : "Explanation failed";
          console.error("[chart-analyzer] explanation failed:", err);
          setResult((prev) =>
            prev
              ? { ...prev, explanationLoading: false, explanationError: m }
              : prev,
          );
        }
      })();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      console.error("[chart-analyzer] failed:", e);
      toast.error(msg);
      setPhase("setup");
    }
  }

  function reset() {
    setPhase("setup");
    setExecFile(null);
    setHigherFile(null);
    setStep(0);
    setResult(null);
    setInvalidReason("");
    setInvalidDetails([]);
    if (execInputRef.current) execInputRef.current.value = "";
    if (higherInputRef.current) higherInputRef.current.value = "";
  }

  return (
    <FeatureShell
      eyebrow="Chart Analyzer"
      title="Analyze against YOUR strategy."
      subtitle="Validates chart structure, rules, and timeframe alignment."
    >
      <input
        ref={execInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setExecFile(f);
        }}
      />
      <input
        ref={higherInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setHigherFile(f);
        }}
      />

      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            {/* Strategy */}
            <Field label="Strategy">
              <select
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13.5px] font-medium text-text-primary outline-none ring-1 ring-transparent transition focus:ring-brand/40"
              >
                {(strategies ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.locked ? "🔒" : ""}
                  </option>
                ))}
              </select>
            </Field>

            {/* Timeframes */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Execution TF (required)">
                <TfSelect value={execTf} onChange={setExecTf} />
              </Field>
              <Field label="Higher TF (optional)">
                <TfSelect value={higherTf} onChange={setHigherTf} allowEmpty />
              </Field>
            </div>

            {/* Uploads */}
            <UploadCard
              label="Execution chart *"
              file={execFile}
              onPick={() => execInputRef.current?.click()}
              onClear={() => {
                setExecFile(null);
                if (execInputRef.current) execInputRef.current.value = "";
              }}
            />
            <UploadCard
              label="Higher timeframe chart"
              file={higherFile}
              optional
              onPick={() => higherInputRef.current?.click()}
              onClear={() => {
                setHigherFile(null);
                if (higherInputRef.current) higherInputRef.current.value = "";
              }}
            />

            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-mix px-4 py-3.5 text-[14px] font-semibold text-white shadow-soft transition hover:shadow-card-premium disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              Analyze chart
            </button>
          </motion.div>
        )}

        {phase === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-3"
          >
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
                <p className="text-[13.5px] font-semibold text-text-primary">
                  Analyzing your chart…
                </p>
              </div>
            </div>
            {STEP_LABELS.map((label, i) => {
              const done = step > i;
              const active = step === i;
              return (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border shadow-soft"
                  style={{ opacity: done || active ? 1 : 0.45 }}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      done ? "bg-emerald-500" : active ? "bg-gradient-mix animate-pulse" : "bg-text-secondary/15"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={3} />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-[13px] font-medium text-text-primary">{label}</span>
                </div>
              );
            })}
          </motion.div>
        )}

        {phase === "invalid" && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="rounded-2xl bg-card p-5 ring-1 ring-rose-500/30 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20">
                  <XCircle className="h-4 w-4" strokeWidth={2.4} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-text-primary">
                    Upload a valid trading chart
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-secondary">
                    {invalidReason} Candles, price axis, and time axis are required.
                  </p>
                  {invalidDetails.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-4">
                      {invalidDetails.map((d, i) => (
                        <li
                          key={i}
                          className="list-disc text-[12px] leading-snug text-rose-700/90"
                        >
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={reset}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3 text-[13.5px] font-semibold text-text-primary ring-1 ring-border shadow-soft hover:shadow-card-premium"
            >
              <RefreshCw className="h-4 w-4" />
              Upload a different image
            </button>
          </motion.div>
        )}

        {phase === "result" && result && (
          <ResultView result={result} onReset={reset} navigate={navigate} />
        )}
      </AnimatePresence>
    </FeatureShell>
  );
}

// ── subcomponents ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}

function TfSelect({
  value,
  onChange,
  allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13.5px] font-medium text-text-primary outline-none ring-1 ring-transparent transition focus:ring-brand/40"
    >
      {allowEmpty && <option value="">—</option>}
      {TIMEFRAMES.map((tf) => (
        <option key={tf} value={tf}>
          {tf}
        </option>
      ))}
    </select>
  );
}

function UploadCard({
  label,
  file,
  optional,
  onPick,
  onClear,
}: {
  label: string;
  file: File | null;
  optional?: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  return (
    <div className="rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          {label}
        </span>
        {optional && (
          <span className="text-[10px] font-medium text-text-secondary/70">optional</span>
        )}
      </div>
      {preview ? (
        <div className="relative overflow-hidden rounded-xl">
          <img src={preview} alt={label} className="h-40 w-full object-cover" />
          <button
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-text-primary ring-1 ring-border backdrop-blur"
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          onClick={onPick}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand/40 bg-card/70 px-4 py-7 transition hover:border-brand/70"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-mix">
            <Upload className="h-4 w-4 text-white" />
          </div>
          <span className="text-[12px] font-medium text-text-primary">Tap to upload</span>
          <span className="text-[10.5px] text-text-secondary">PNG / JPG · TradingView works best</span>
        </button>
      )}
    </div>
  );
}

const VERDICT_STYLES: Record<
  RuleBreakdown["overall"],
  { label: string; ring: string; bg: string; fg: string; Icon: typeof CheckCircle2 }
> = {
  valid: {
    label: "Valid setup",
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    fg: "text-emerald-700",
    Icon: CheckCircle2,
  },
  weak: {
    label: "Weak — review carefully",
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    fg: "text-amber-700",
    Icon: AlertTriangle,
  },
  invalid: {
    label: "Invalid — does not match strategy",
    ring: "ring-rose-500/30",
    bg: "bg-rose-500/10",
    fg: "text-rose-700",
    Icon: XCircle,
  },
};

// Suggest a concrete next action when a strategy rule fails.
// Keeps language strict: never tells the user to take the trade.
function nextActionFor(
  section: "entry" | "structure" | "risk" | "timing",
  rule: string,
): string {
  const r = rule.toLowerCase();
  if (section === "entry") {
    if (r.includes("liquidity") || r.includes("sweep"))
      return "Wait for a clean liquidity sweep before considering entry.";
    if (r.includes("confirm") || r.includes("close"))
      return "Wait for confirmation candle close in your direction.";
    if (r.includes("retest") || r.includes("pullback"))
      return "Wait for price to retest the level before entering.";
    return "Do not enter. Wait for this entry condition to actually appear.";
  }
  if (section === "structure") {
    if (r.includes("trend"))
      return "Skip until trend direction is unambiguous on this timeframe.";
    if (r.includes("range") || r.includes("consolidat"))
      return "Avoid trading mid-range. Wait for a clean break or reclaim.";
    return "Structure is unclear. Re-check on a higher timeframe before acting.";
  }
  if (section === "risk") {
    if (r.includes("stop") || r.includes("sl"))
      return "Do not widen stop. Skip the trade if invalidation is too far.";
    if (r.includes("rr") || r.includes("reward"))
      return "Skip — reward-to-risk does not meet your minimum.";
    if (r.includes("volatil"))
      return "Volatility is off. Reduce size or wait for conditions to normalize.";
    return "Risk profile does not match your rules. Stand down.";
  }
  // timing
  if (r.includes("higher") || r.includes("htf") || r.includes("alignment"))
    return "Wait for higher-timeframe alignment before taking this setup.";
  if (r.includes("session") || r.includes("hour") || r.includes("time"))
    return "Outside your session window. Wait for your defined trading hours.";
  return "Timing is off. Do not force this trade.";
}

function ResultView({
  result,
  onReset,
  navigate,
}: {
  result: {
    row: ChartAnalysisRow;
    breakdown: RuleBreakdown;
    insight: string;
    execPreview: string;
    higherPreview: string | null;
    modelUsed: "primary" | "fallback";
    pipelineConfidence: number;
    warnings: string[];
    explanation: ChartExplanation | null;
    explanationLoading: boolean;
    explanationError: string | null;
  };
  onReset: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const v = VERDICT_STYLES[result.breakdown.overall];
  const sections: Array<{
    key: "entry" | "structure" | "risk" | "timing";
    title: string;
    subtitle: string;
  }> = [
    { key: "entry", title: "Entry", subtitle: "Your strategy entry rules vs the chart" },
    { key: "structure", title: "Structure alignment", subtitle: "Readable price structure" },
    { key: "risk", title: "Risk alignment", subtitle: "Your strategy risk rules vs current volatility" },
    { key: "timing", title: "Timing alignment", subtitle: "Higher-timeframe alignment" },
  ];

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-4"
    >
      {/* Charts */}
      <div className="overflow-hidden rounded-2xl bg-card p-1 ring-1 ring-border shadow-soft">
        <img src={result.execPreview} alt="Execution chart" className="h-44 w-full rounded-[14px] object-cover" />
      </div>
      {result.higherPreview && (
        <div className="overflow-hidden rounded-2xl bg-card p-1 ring-1 ring-border shadow-soft">
          <img src={result.higherPreview} alt="Higher TF chart" className="h-32 w-full rounded-[14px] object-cover" />
        </div>
      )}

      {/* Pipeline status — model used + confidence */}
      <div className="flex items-center gap-2 rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-border shadow-soft">
        <Sparkles
          className={`h-3.5 w-3.5 ${
            result.modelUsed === "fallback" ? "text-amber-600" : "text-brand"
          }`}
          strokeWidth={2.4}
        />
        <span className="text-[11.5px] font-semibold text-text-primary">
          {result.modelUsed === "fallback"
            ? "Deeper validation used"
            : "Primary model"}
        </span>
        <span className="ml-auto text-[11.5px] text-text-secondary">
          AI confidence {Math.round(result.pipelineConfidence * 100)}%
        </span>
      </div>

      {result.modelUsed === "fallback" && (
        <div className="flex items-start gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-amber-500/30 shadow-soft">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12.5px] leading-snug text-text-primary">
            Analysis required deeper validation. Using advanced model for higher
            accuracy.
          </p>
        </div>
      )}

      {/* Verdict */}
      <div className={`rounded-2xl p-4 ring-1 shadow-soft ${v.bg} ${v.ring}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-card ring-1 ring-border ${v.fg}`}>
            <v.Icon className="h-4 w-4" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
              Verdict
            </p>
            <p className={`text-[14.5px] font-semibold ${v.fg}`}>{v.label}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
              Score
            </p>
            <p className="text-[18px] font-bold text-text-primary">{result.breakdown.score}/100</p>
          </div>
        </div>
      </div>

      {/* Low-confidence warning */}
      {result.breakdown.low_confidence && (
        <div className="flex items-start gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-amber-500/30 shadow-soft">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12.5px] leading-snug text-text-primary">
            {result.breakdown.confidence_note ??
              "Analysis confidence is low due to unclear chart structure."}
          </p>
        </div>
      )}

      {/* Strategy mismatch warning */}
      {result.breakdown.overall !== "valid" && !result.breakdown.low_confidence && (
        <div className="flex items-start gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-amber-500/30 shadow-soft">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12.5px] leading-snug text-text-primary">
            This setup does not fully match your strategy. Do not force it.
          </p>
        </div>
      )}

      {/* Trade Readiness — one-screen checklist with next actions */}
      {(() => {
        const items = sections.flatMap((s) =>
          result.breakdown[s.key].checks.map((c) => ({
            section: s.key,
            sectionLabel: s.title,
            rule: c.rule,
            passed: c.passed,
          })),
        );
        const total = items.length;
        const passedCount = items.filter((i) => i.passed).length;
        const failed = items.filter((i) => !i.passed);
        const allPassed = failed.length === 0 && total > 0;
        const readiness =
          result.breakdown.overall === "valid" && allPassed
            ? { label: "Ready to trade", tone: "emerald" as const }
            : result.breakdown.overall === "invalid"
              ? { label: "Do not trade", tone: "rose" as const }
              : { label: "Not ready — conditions missing", tone: "amber" as const };

        const toneRing =
          readiness.tone === "emerald"
            ? "ring-emerald-500/30"
            : readiness.tone === "rose"
              ? "ring-rose-500/30"
              : "ring-amber-500/30";
        const toneFg =
          readiness.tone === "emerald"
            ? "text-emerald-700"
            : readiness.tone === "rose"
              ? "text-rose-700"
              : "text-amber-700";
        const toneDot =
          readiness.tone === "emerald"
            ? "bg-emerald-500"
            : readiness.tone === "rose"
              ? "bg-rose-500"
              : "bg-amber-500";

        return (
          <div className={`rounded-2xl bg-card p-3.5 ring-1 shadow-soft ${toneRing}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${toneDot}`} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
                Trade readiness
              </span>
              <span className={`ml-auto text-[12.5px] font-semibold ${toneFg}`}>
                {readiness.label}
              </span>
            </div>

            <p className="mt-1 text-[11.5px] text-text-secondary">
              {passedCount}/{total} conditions met
            </p>

            <ul className="mt-3 space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 px-1 py-1">
                  {it.passed ? (
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                      strokeWidth={2.6}
                    />
                  ) : (
                    <XCircle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600"
                      strokeWidth={2.6}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[12.5px] leading-snug ${
                        it.passed ? "text-text-primary" : "font-medium text-text-primary"
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                        {it.sectionLabel}:
                      </span>{" "}
                      {it.rule}
                    </p>
                    {!it.passed && (
                      <p className="mt-0.5 text-[11.5px] leading-snug text-rose-700">
                        → {nextActionFor(it.section, it.rule)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {failed.length > 0 && (
              <p className="mt-3 text-[11px] italic text-text-secondary">
                Address every failed condition before considering this trade.
              </p>
            )}
          </div>
        );
      })()}

      {/* Breakdown */}
      <div className="space-y-2.5">
        {sections.map((s) => {
          const cell = result.breakdown[s.key];
          return (
            <div
              key={s.key}
              className="rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft"
            >
              <div className="flex items-center gap-2">
                {cell.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2.4} />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600" strokeWidth={2.4} />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-text-primary">
                      {s.title}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        cell.passed
                          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
                          : "bg-rose-500/10 text-rose-700 ring-rose-500/20"
                      }`}
                    >
                      {cell.passed ? "PASS" : "FAIL"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-secondary">{s.subtitle}</p>
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {cell.checks.map((c, idx) => (
                  <li
                    key={idx}
                    className={`rounded-xl px-3 py-2 ring-1 ${
                      c.passed
                        ? "bg-emerald-500/[0.06] ring-emerald-500/20"
                        : "bg-rose-500/[0.06] ring-rose-500/20"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {c.passed ? (
                        <CheckCircle2
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                          strokeWidth={2.6}
                        />
                      ) : (
                        <XCircle
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600"
                          strokeWidth={2.6}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium leading-snug text-text-primary">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                            Your rule:
                          </span>{" "}
                          {c.rule}
                        </p>
                        <p className="mt-1 text-[11.5px] leading-snug text-text-secondary">
                          {c.reason}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Structured AI Explanation */}
      <ExplanationCard
        loading={result.explanationLoading}
        error={result.explanationError}
        explanation={result.explanation}
      />

      {/* AI Insight (legacy short observation, only if present) */}
      {result.insight && (
        <div className="rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
              AI Insight · general market analysis
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-text-primary">{result.insight}</p>
          <p className="mt-2 text-[10.5px] italic text-text-secondary/80">
            Observation only. Does not override your rules.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => {
            if (result.breakdown.overall === "invalid") {
              toast.error("Setup is invalid — does not match strategy. Do not trade this.");
              return;
            }
            if (result.breakdown.overall === "weak") {
              toast.warning("Proceeding with a weak setup — review carefully.");
            }
            navigate({ to: "/hub/mind" });
          }}
          disabled={result.breakdown.overall === "invalid"}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-mix px-4 py-3 text-[13.5px] font-semibold text-white shadow-soft hover:shadow-card-premium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {result.breakdown.overall === "invalid" ? "Blocked" : "Trade Gate"}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3 text-[13.5px] font-semibold text-text-primary ring-1 ring-border shadow-soft hover:shadow-card-premium"
        >
          <RefreshCw className="h-4 w-4" />
          Re-analyze
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-xl bg-card/60 px-3 py-2 ring-1 ring-border">
        <Save className="h-3.5 w-3.5 text-text-secondary" />
        <p className="text-[11.5px] text-text-secondary">Saved · ID {result.row.id.slice(0, 8)}</p>
      </div>
    </motion.div>
  );
}

function ExplanationCard({
  loading,
  error,
  explanation,
}: {
  loading: boolean;
  error: string | null;
  explanation: ChartExplanation | null;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            Mentor explanation · generating
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-text-secondary/15" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-text-secondary/15" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-text-secondary/15" />
        </div>
      </div>
    );
  }

  if (error || !explanation) {
    return (
      <div className="rounded-2xl bg-card p-3.5 ring-1 ring-amber-500/30 shadow-soft">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12.5px] leading-snug text-text-primary">
            Mentor explanation unavailable. Rule breakdown above is authoritative.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Summary */}
      <div className="rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            Summary
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-text-primary">
          {explanation.summary}
        </p>
      </div>

      {/* Aligns */}
      <div className="rounded-2xl bg-card p-3.5 ring-1 ring-emerald-500/25 shadow-soft">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2.4} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            What aligns with strategy
          </span>
        </div>
        {explanation.aligns.length === 0 ? (
          <p className="mt-2 text-[12.5px] italic text-text-secondary">
            Nothing in this setup aligns with your strategy.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 pl-6">
            {explanation.aligns.map((a, i) => (
              <li
                key={i}
                className="list-disc text-[12.5px] leading-snug text-text-primary"
              >
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Misaligns */}
      <div className="rounded-2xl bg-card p-3.5 ring-1 ring-rose-500/25 shadow-soft">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-rose-600" strokeWidth={2.4} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            What does NOT align
          </span>
        </div>
        {explanation.misaligns.length === 0 ? (
          <p className="mt-2 text-[12.5px] italic text-text-secondary">
            No misalignments detected against your strategy.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 pl-6">
            {explanation.misaligns.map((m, i) => (
              <li
                key={i}
                className="list-disc text-[12.5px] leading-snug text-text-primary"
              >
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Final Assessment */}
      <div className="rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            Final assessment
          </span>
        </div>
        <p className="mt-2 text-[13px] font-medium leading-snug text-text-primary">
          {explanation.final_assessment}
        </p>
        <p className="mt-2 text-[10.5px] italic text-text-secondary/80">
          Explanation only. Does not override the rule breakdown above.
        </p>
      </div>
    </div>
  );
}
