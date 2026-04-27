import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Target,
  Shield,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import FeatureShell from "./FeatureShell";

type Phase = "idle" | "analyzing" | "result";

const checks = [
  "Reading price structure",
  "Cross-checking with your strategy",
  "Scoring trade quality",
];

const insights = [
  {
    Icon: CheckCircle2,
    label: "Setup",
    value: "Trend continuation",
    tone: "good",
  },
  {
    Icon: Target,
    label: "Entry",
    value: "Wait for retest of 1.0842",
    tone: "neutral",
  },
  {
    Icon: Shield,
    label: "Invalidation",
    value: "Below 1.0820",
    tone: "warn",
  },
  {
    Icon: TrendingUp,
    label: "Target",
    value: "1.0905 (1:2.5 R:R)",
    tone: "good",
  },
];

const toneClass: Record<string, string> = {
  good: "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20",
  warn: "text-amber-600 bg-amber-500/10 ring-amber-500/20",
  neutral: "text-text-primary bg-text-primary/5 ring-border",
};

export default function ChartAnalyzer() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setPhase("analyzing");
    setStepIdx(0);
    // Simulated analysis pipeline
    const t1 = window.setTimeout(() => setStepIdx(1), 900);
    const t2 = window.setTimeout(() => setStepIdx(2), 1800);
    const t3 = window.setTimeout(() => setPhase("result"), 2900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  };

  const reset = () => {
    setPhase("idle");
    setPreview(null);
    setStepIdx(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <FeatureShell
      eyebrow="Chart Analyzer"
      title="Drop your chart."
      subtitle="Get instant insight based on how YOU trade."
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <AnimatePresence mode="wait">
        {phase === "idle" ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <DropZone onPick={() => inputRef.current?.click()} />
            <StrategyChips />
          </motion.div>
        ) : phase === "analyzing" ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <ChartPreview src={preview} analyzing />
            <div className="mt-5 space-y-2.5">
              {checks.map((label, i) => {
                const done = stepIdx > i;
                const active = stepIdx === i;
                return (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: active || done ? 1 : 0.45, x: 0 }}
                    className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border shadow-soft"
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                        done
                          ? "bg-gradient-primary"
                          : active
                            ? "bg-gradient-mix animate-pulse-glow"
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
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <ChartPreview src={preview} />

            {/* Score */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mt-5 overflow-hidden rounded-2xl p-[1.5px]"
              style={{ backgroundImage: "var(--gradient-mix)" }}
            >
              <div className="rounded-[14px] bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
                      Trade Quality
                    </p>
                    <p className="mt-1 text-[26px] font-bold leading-none text-gradient-mix">
                      82<span className="text-[16px]">/100</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 ring-1 ring-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[11px] font-semibold text-emerald-700">
                      A-grade setup
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-text-secondary/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "82%" }}
                    transition={{ delay: 0.3, duration: 0.9, ease: "easeOut" }}
                    className="h-full bg-gradient-mix"
                  />
                </div>
              </div>
            </motion.div>

            {/* Insights */}
            <div className="mt-4 space-y-2.5">
              {insights.map((ins, i) => (
                <motion.div
                  key={ins.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.07, duration: 0.45 }}
                  className="flex items-start gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClass[ins.tone]}`}
                  >
                    <ins.Icon className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
                      {ins.label}
                    </p>
                    <p className="mt-0.5 text-[13.5px] font-medium text-text-primary">
                      {ins.value}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Mentor note */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-4 flex items-start gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-mix shadow-glow-primary">
                <Sparkles className="h-4 w-4 text-white" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
                  Mentor note
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-text-primary">
                  Don't chase. Wait for confirmation at the retest. Skip if
                  candle closes below 1.0830.
                </p>
              </div>
            </motion.div>

            {/* Reset */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              whileTap={{ scale: 0.98 }}
              onClick={reset}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3 text-[13.5px] font-semibold text-text-primary ring-1 ring-border shadow-soft transition-all hover:shadow-card-premium"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
              Analyze another chart
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </FeatureShell>
  );
}

function DropZone({ onPick }: { onPick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={onPick}
      className="group relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-brand/40 bg-card/70 px-6 py-12 text-center backdrop-blur transition-all hover:border-brand/70 hover:shadow-card-premium"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ background: "var(--gradient-bg-glow)" }}
      />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-mix shadow-glow-primary">
        <Upload className="h-6 w-6 text-white" strokeWidth={2.2} />
      </div>
      <div className="relative">
        <p className="text-[15px] font-semibold text-text-primary">
          Upload your chart
        </p>
        <p className="mt-1 text-[12px] text-text-secondary">
          PNG or JPG · TradingView screenshot works best
        </p>
      </div>
      <div className="relative mt-1 flex items-center gap-1.5 rounded-full bg-text-primary/5 px-3 py-1 text-[11px] font-semibold text-text-primary ring-1 ring-border">
        <ImageIcon className="h-3 w-3" strokeWidth={2.4} />
        Tap to choose image
      </div>
    </motion.button>
  );
}

function StrategyChips() {
  const tags = ["Trend following", "Smart money", "1:2 R:R minimum"];
  return (
    <div className="mt-4 rounded-2xl bg-card p-3.5 ring-1 ring-border shadow-soft">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Analyzing through your strategy
        </p>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-text-primary/5 px-2.5 py-1 text-[11px] font-medium text-text-primary ring-1 ring-border"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartPreview({
  src,
  analyzing,
}: {
  src: string | null;
  analyzing?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card p-1 ring-1 ring-border shadow-soft">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-gradient-to-br from-text-primary/5 to-text-primary/10">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Chart" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-text-secondary/40" />
          </div>
        )}
        {analyzing ? (
          <>
            <motion.div
              className="absolute inset-x-0 h-[2px] bg-gradient-mix shadow-glow-cyan"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/40 via-transparent to-card/20" />
          </>
        ) : (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-text-primary ring-1 ring-border backdrop-blur">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Wait for retest
          </div>
        )}
      </div>
    </div>
  );
}
