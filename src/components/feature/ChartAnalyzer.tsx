// Chart Analyzer — high-intelligence market analysis & strategy validation.
//
// Design principles (do NOT regress):
//   1. Understand and explain the market FIRST (strategy-agnostic).
//   2. THEN validate against the user's canonical strategy rules.
//   3. NEVER enforce or block user actions — the analyzer is informational.
//   4. Always neutral, professional tone with mandatory disclaimer.
//
// Pipeline: validate image → market interpretation + feature extraction →
// per-rule alignment → grade & verdict → premium card layout.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
  ArrowRight,
  Save,
  ChevronDown,
  ChevronUp,
  Info,
  CircleDashed,
} from "lucide-react";
import { toast } from "sonner";
import FeatureShell from "./FeatureShell";
import {
  listBlueprints,
  type StrategyBlueprint,
} from "@/lib/dbStrategyBlueprints";
import {
  uploadChartImage,
  signedUrl,
  saveChartAnalysis,
  type ChartAnalysisRow,
} from "@/lib/dbChartAnalyses";
import {
  evaluateChartAgainstStrategy,
  type ChartFeaturesPair,
} from "@/lib/chartRuleCheck";
import {
  evaluateAlignment,
  VERDICT_LABEL,
  ANALYZER_DISCLAIMER,
  type StrategyAlignment,
  type RuleAlignment,
} from "@/lib/strategyAlignment";
import { buildCanonicalStrategy } from "@/lib/strategySchema";
import { supabase } from "@/integrations/supabase/client";
import { logAnalyzerEvent, type AnalyzerVerdict } from "@/lib/analyzerEvents";
import { useTraderState } from "@/hooks/useTraderState";

type MarketInterpretation = {
  summary: string;
  market_condition: "trending" | "consolidating" | "choppy";
  directional_bias: "bullish" | "bearish" | "neutral";
  clarity: "high" | "medium" | "low";
  key_observations: string[];
  structure_notes: string;
};

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"] as const;

type Phase = "setup" | "analyzing" | "result" | "invalid";

const STEP_LABELS = [
  "Validating image",
  "Reading the market",
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
    alignment: StrategyAlignment;
    marketInterp: MarketInterpretation | null;
    execPreview: string;
    higherPreview: string | null;
    pipelineConfidence: number; // 0–1
  } | null>(null);

  const execInputRef = useRef<HTMLInputElement>(null);
  const higherInputRef = useRef<HTMLInputElement>(null);
  const { refresh: refreshTraderState } = useTraderState();

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

  // Strategy gate — analyzer is meaningless without a strategy to validate against.
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
              No strategy found. Create and lock one in the Strategy Builder
              before analyzing charts.
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
      const [execPath, higherPath] = await Promise.all([
        uploadChartImage(execFile, "exec"),
        higherFile
          ? uploadChartImage(higherFile, "higher")
          : Promise.resolve<string | null>(null),
      ]);
      setStep(1);

      const [execUrl, higherUrl] = await Promise.all([
        signedUrl(execPath),
        higherPath ? signedUrl(higherPath) : Promise.resolve<string | null>(null),
      ]);

      const { data, error } = await supabase.functions.invoke("analyze-chart", {
        body: { exec_image_url: execUrl, higher_image_url: higherUrl },
      });
      if (error) throw new Error(error.message || "Analysis failed");

      if (data?.status === "locked") {
        toast.error(data?.reason || "Analyzer is locked.");
        void refreshTraderState();
        setPhase("setup");
        return;
      }

      // SECTION 1 — input validation. Non-charts get a clear, calm rejection.
      if (data?.status === "rejected" || data?.is_chart === false) {
        setInvalidReason(
          data?.reason ||
            "This does not appear to be a valid trading chart. Please upload a chart showing price data.",
        );
        setInvalidDetails(Array.isArray(data?.details) ? data.details : []);
        setPhase("invalid");
        return;
      }
      setStep(2);

      const features: ChartFeaturesPair = {
        exec: data.features?.exec ?? {},
        higher: data.features?.higher ?? null,
      };
      const pipelineConf: number = Number(data?.confidence ?? 0);
      const validationConfPct: number = Number(
        data?.confidence_pct ?? Math.round(pipelineConf * 100),
      );
      const marketInterp = (data?.market_interpretation ??
        null) as MarketInterpretation | null;

      // New alignment layer (canonical rules → per-rule pass/fail/NA + grade).
      const canonical = buildCanonicalStrategy(activeStrategy);
      const alignment = evaluateAlignment(canonical, features);

      // Legacy breakdown — kept ONLY for the chart_analyses storage shape and
      // the discipline engine, which still consumes the 4-section format.
      const legacy = evaluateChartAgainstStrategy(
        features,
        activeStrategy.structured_rules as never,
        validationConfPct,
      );

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
        rule_breakdown: legacy,
        verdict: legacy.overall,
        ai_insight: alignment.insight,
        trade_id: null,
      });

      // TRADER_STATE event — analyzer remains a *signal*, not an enforcer.
      const verdictForState: AnalyzerVerdict = legacy.overall;
      const violations = alignment.failed.map(
        (r) => `${r.category}: ${r.condition}`,
      );
      void logAnalyzerEvent({
        analysis_id: row.id,
        blueprint_id: activeStrategy.id,
        verdict: verdictForState,
        violations,
        reason: alignment.insight,
      }).then(() => void refreshTraderState());

      setResult({
        row,
        alignment,
        marketInterp,
        execPreview,
        higherPreview,
        pipelineConfidence: pipelineConf,
      });
      setPhase("result");
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
      title="Read the market. Validate your system."
      subtitle="Neutral chart interpretation, then a check against your strategy."
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Execution TF (required)">
                <TfSelect value={execTf} onChange={setExecTf} />
              </Field>
              <Field label="Higher TF (optional)">
                <TfSelect value={higherTf} onChange={setHigherTf} allowEmpty />
              </Field>
            </div>

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
                  Reading your chart…
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
                      done
                        ? "bg-emerald-500"
                        : active
                          ? "bg-gradient-mix animate-pulse"
                          : "bg-text-secondary/15"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2
                        className="h-4 w-4 text-white"
                        strokeWidth={3}
                      />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-[13px] font-medium text-text-primary">
                    {label}
                  </span>
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
            <div className="rounded-2xl bg-card p-5 ring-1 ring-amber-500/30 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
                  <AlertTriangle className="h-4 w-4" strokeWidth={2.4} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-text-primary">
                    This does not appear to be a valid trading chart
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-secondary">
                    Please upload a chart showing price data — candles, a price
                    axis, and a time axis. {invalidReason}
                  </p>
                  {invalidDetails.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-4">
                      {invalidDetails.map((d, i) => (
                        <li
                          key={i}
                          className="list-disc text-[12px] leading-snug text-text-secondary"
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
          <ResultView result={result} onReset={reset} />
        )}
      </AnimatePresence>
    </FeatureShell>
  );
}

// ── shared subcomponents ─────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  return (
    <div className="rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          {label}
        </span>
        {optional && (
          <span className="text-[10px] font-medium text-text-secondary/70">
            optional
          </span>
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
          <span className="text-[12px] font-medium text-text-primary">
            Tap to upload
          </span>
          <span className="text-[10.5px] text-text-secondary">
            PNG / JPG · TradingView works best
          </span>
        </button>
      )}
    </div>
  );
}

// ── result view ──────────────────────────────────────────────────────────────

function ResultView({
  result,
  onReset,
}: {
  result: {
    row: ChartAnalysisRow;
    alignment: StrategyAlignment;
    marketInterp: MarketInterpretation | null;
    execPreview: string;
    higherPreview: string | null;
    pipelineConfidence: number;
  };
  onReset: () => void;
}) {
  const { alignment, marketInterp } = result;

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-4"
    >
      {/* Charts (preview only — no enforcement overlays) */}
      <ChartPreview
        src={result.execPreview}
        label="Execution chart"
        heightClass="h-44"
      />
      {result.higherPreview && (
        <ChartPreview
          src={result.higherPreview}
          label="Higher timeframe"
          heightClass="h-32"
        />
      )}

      {/* SECTION 1 — Market Summary (top card, no strategy reference) */}
      <MarketSummaryCard
        marketInterp={marketInterp}
        pipelineConfidence={result.pipelineConfidence}
      />

      {/* SECTION 2 — Trade Grade (prominent) + Verdict */}
      <TradeGradeCard alignment={alignment} />

      {/* SECTION 3 — Strategy Alignment (expandable) */}
      <StrategyAlignmentCard alignment={alignment} />

      {/* SECTION 4 — Detailed Breakdown (collapsible) */}
      <DetailedBreakdownCard alignment={alignment} />

      {/* SECTION 5 — Insight Feedback */}
      <InsightCard alignment={alignment} />

      {/* SECTION 6 — Behavioral Note (optional) */}
      {alignment.behavioral_note && (
        <BehavioralNoteCard note={alignment.behavioral_note} />
      )}

      {/* Disclaimer (mandatory) */}
      <DisclaimerCard />

      {/* Actions — never block. "Outside your defined system" is just a tag. */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3 text-[13.5px] font-semibold text-text-primary ring-1 ring-border shadow-soft hover:shadow-card-premium"
        >
          <RefreshCw className="h-4 w-4" />
          New analysis
        </button>
        <button
          onClick={() => {
            if (alignment.verdict === "not_aligned") {
              toast.message("Outside your defined system", {
                description:
                  "Logged for your records. The analyzer evaluates — it never restricts your decision.",
              });
            }
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-mix px-4 py-3 text-[13.5px] font-semibold text-white shadow-soft hover:shadow-card-premium"
        >
          <Save className="h-4 w-4" />
          Saved
        </button>
      </div>
      <p className="text-center text-[10.5px] text-text-secondary">
        Saved · ID {result.row.id.slice(0, 8)}
      </p>
    </motion.div>
  );
}

// ── result subcomponents ─────────────────────────────────────────────────────

function ChartPreview({
  src,
  label,
  heightClass,
}: {
  src: string;
  label: string;
  heightClass: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card p-1 ring-1 ring-border shadow-soft">
      <div className="relative">
        <img
          src={src}
          alt={label}
          className={`${heightClass} w-full rounded-[14px] object-cover`}
        />
        <div className="absolute right-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary ring-1 ring-border">
          {label}
        </div>
      </div>
    </div>
  );
}

const CONDITION_LABEL: Record<MarketInterpretation["market_condition"], string> = {
  trending: "Trending",
  consolidating: "Consolidating",
  choppy: "Choppy",
};
const BIAS_LABEL: Record<MarketInterpretation["directional_bias"], string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};
const CLARITY_LABEL: Record<MarketInterpretation["clarity"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function MarketSummaryCard({
  marketInterp,
  pipelineConfidence,
}: {
  marketInterp: MarketInterpretation | null;
  pipelineConfidence: number;
}) {
  if (!marketInterp) {
    return (
      <div className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            Market summary
          </span>
        </div>
        <p className="mt-2 text-[12.5px] text-text-secondary">
          Market reading unavailable for this image. Strategy alignment below is
          authoritative.
        </p>
      </div>
    );
  }

  const condition = CONDITION_LABEL[marketInterp.market_condition];
  const bias = BIAS_LABEL[marketInterp.directional_bias];
  const clarity = CLARITY_LABEL[marketInterp.clarity];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-card to-card/60 p-4 ring-1 ring-border shadow-card-premium">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          Market summary
        </span>
        <span className="ml-auto text-[10.5px] text-text-secondary">
          AI confidence {Math.round(pipelineConfidence * 100)}%
        </span>
      </div>

      <p className="mt-3 text-[13.5px] leading-snug text-text-primary">
        {marketInterp.summary}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Condition" value={condition} />
        <Stat label="Bias" value={bias} />
        <Stat label="Clarity" value={clarity} />
      </div>

      {marketInterp.key_observations.length > 0 && (
        <div className="mt-3 rounded-xl bg-card/60 p-3 ring-1 ring-border">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Key observations
          </p>
          <ul className="mt-2 space-y-1">
            {marketInterp.key_observations.slice(0, 5).map((obs, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[12.5px] leading-snug text-text-primary"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/80 px-2.5 py-2 ring-1 ring-border">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold text-text-primary">
        {value}
      </p>
    </div>
  );
}

const GRADE_STYLES: Record<
  StrategyAlignment["grade"],
  { ring: string; bg: string; fg: string }
> = {
  "A+": {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    fg: "text-emerald-700",
  },
  "B+": {
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    fg: "text-amber-700",
  },
  "C+": {
    ring: "ring-rose-500/30",
    bg: "bg-rose-500/10",
    fg: "text-rose-700",
  },
};

function TradeGradeCard({ alignment }: { alignment: StrategyAlignment }) {
  const s = GRADE_STYLES[alignment.grade];
  return (
    <div className={`rounded-2xl p-4 ring-1 shadow-card-premium ${s.bg} ${s.ring}`}>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-card ring-1 ring-border ${s.fg}`}
        >
          <span className="text-[22px] font-bold tracking-tight">
            {alignment.grade}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
            Trade grade
          </p>
          <p className={`text-[15px] font-semibold ${s.fg}`}>
            {VERDICT_LABEL[alignment.verdict]}
          </p>
          <p className="mt-0.5 text-[11.5px] text-text-secondary">
            {alignment.match_pct}% match · {alignment.weighted_score}/100 weighted
          </p>
          <p className="mt-1 text-[10.5px] italic text-text-secondary">
            Evaluation against your system — not a recommendation.
          </p>
        </div>
      </div>
    </div>
  );
}

function StrategyAlignmentCard({
  alignment,
}: {
  alignment: StrategyAlignment;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3.5"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          Strategy alignment
        </span>
        <span className="ml-auto text-[11.5px] text-text-secondary">
          {alignment.passed.length} pass · {alignment.failed.length} fail ·{" "}
          {alignment.not_applicable.length} N/A
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-text-secondary" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-secondary" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <ProgressBar pct={alignment.match_pct} />
          <AlignmentGroup
            tone="emerald"
            label="Passed"
            rules={alignment.passed}
          />
          <AlignmentGroup tone="rose" label="Failed" rules={alignment.failed} />
          <AlignmentGroup
            tone="muted"
            label="Not applicable"
            rules={alignment.not_applicable}
          />
        </div>
      )}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
        <span>Match</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-text-secondary/10">
        <div
          className="h-full rounded-full bg-gradient-mix transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AlignmentGroup({
  tone,
  label,
  rules,
}: {
  tone: "emerald" | "rose" | "muted";
  label: string;
  rules: RuleAlignment[];
}) {
  if (rules.length === 0) return null;
  const ring =
    tone === "emerald"
      ? "ring-emerald-500/20"
      : tone === "rose"
        ? "ring-rose-500/20"
        : "ring-border";
  const bg =
    tone === "emerald"
      ? "bg-emerald-500/[0.05]"
      : tone === "rose"
        ? "bg-rose-500/[0.05]"
        : "bg-card/40";
  const Icon =
    tone === "emerald"
      ? CheckCircle2
      : tone === "rose"
        ? XCircle
        : CircleDashed;
  const iconColor =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : "text-text-secondary";

  return (
    <div className={`rounded-xl p-3 ring-1 ${ring} ${bg}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
        {label} · {rules.length}
      </p>
      <ul className="mt-2 space-y-1.5">
        {rules.map((r) => (
          <li key={r.rule_id} className="flex items-start gap-2">
            <Icon
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconColor}`}
              strokeWidth={2.6}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-snug text-text-primary">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  {r.category}:
                </span>{" "}
                {r.condition}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-text-secondary">
                {r.reason}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailedBreakdownCard({
  alignment,
}: {
  alignment: StrategyAlignment;
}) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    const map = new Map<RuleAlignment["category"], RuleAlignment[]>();
    for (const r of alignment.rules) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }
    return Array.from(map.entries());
  }, [alignment]);

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3.5"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          Detailed breakdown
        </span>
        <span className="ml-auto text-[11.5px] text-text-secondary">
          {alignment.rules.length} rule{alignment.rules.length === 1 ? "" : "s"}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-text-secondary" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-secondary" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {grouped.map(([cat, rules]) => (
            <div key={cat} className="rounded-xl bg-card/60 p-3 ring-1 ring-border">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                {cat}
              </p>
              <ul className="mt-2 space-y-1.5">
                {rules.map((r) => {
                  const Icon =
                    r.status === "passed"
                      ? CheckCircle2
                      : r.status === "failed"
                        ? XCircle
                        : CircleDashed;
                  const color =
                    r.status === "passed"
                      ? "text-emerald-600"
                      : r.status === "failed"
                        ? "text-rose-600"
                        : "text-text-secondary";
                  return (
                    <li key={r.rule_id} className="flex items-start gap-2">
                      <Icon
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`}
                        strokeWidth={2.6}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] leading-snug text-text-primary">
                          {r.condition}
                        </p>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-text-secondary">
                          {r.reason}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ alignment }: { alignment: StrategyAlignment }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
          Insight
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-text-primary">
        {alignment.insight}
      </p>
    </div>
  );
}

function BehavioralNoteCard({ note }: { note: string }) {
  return (
    <div className="rounded-2xl bg-card p-3.5 ring-1 ring-amber-500/25 shadow-soft">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[12.5px] leading-snug text-text-primary">{note}</p>
      </div>
    </div>
  );
}

function DisclaimerCard() {
  return (
    <p className="rounded-xl bg-card/60 px-3 py-2.5 text-center text-[10.5px] italic leading-snug text-text-secondary ring-1 ring-border">
      {ANALYZER_DISCLAIMER}
    </p>
  );
}
