import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  ShieldCheck,
  Pause,
} from "lucide-react";
import { logCheck } from "@/lib/behaviorLog";

// ---------- Types ----------
type Step =
  | "interrupt"
  | "intention"
  | "rule"
  | "rule_warning"
  | "risk"
  | "control"
  | "control_warning"
  | "emotion"
  | "emotion_warning"
  | "summary";

type Intention =
  | "Enter a trade"
  | "Modify a trade"
  | "Close a trade"
  | "Just analyzing";

type RuleAlignment = "fully" | "partially" | "not_really";
type Emotion =
  | "Calm"
  | "Slightly pressured"
  | "Urgent"
  | "Frustrated"
  | "Trying to recover losses";

type State = {
  intention?: Intention;
  rule?: RuleAlignment;
  risk?: number; // percent
  inControl?: boolean;
  emotion?: Emotion;
};

const EMOTIONAL_BIASES: Emotion[] = [
  "Urgent",
  "Frustrated",
  "Trying to recover losses",
];

// ---------- Root ----------
export default function CheckBeforeTradeFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("interrupt");
  const [data, setData] = useState<State>({});

  // Total ordered steps for progress (warnings count as part of their parent)
  const stepOrder: Step[] = useMemo(
    () => [
      "interrupt",
      "intention",
      "rule",
      "risk",
      "control",
      "emotion",
      "summary",
    ],
    [],
  );

  const progressIndex = useMemo(() => {
    const map: Record<Step, Step> = {
      interrupt: "interrupt",
      intention: "intention",
      rule: "rule",
      rule_warning: "rule",
      risk: "risk",
      control: "control",
      control_warning: "control",
      emotion: "emotion",
      emotion_warning: "emotion",
      summary: "summary",
    };
    return stepOrder.indexOf(map[step]);
  }, [step, stepOrder]);

  const totalSteps = stepOrder.length;

  function go(next: Step) {
    setStep(next);
  }

  function handleProceedFinal() {
    if (
      data.intention &&
      data.rule &&
      data.risk !== undefined &&
      data.inControl !== undefined &&
      data.emotion
    ) {
      logCheck({
        intention: data.intention,
        ruleAlignment: data.rule,
        riskPercent: data.risk,
        inControlIfLoss: data.inControl,
        emotion: data.emotion,
        emotionalBias: EMOTIONAL_BIASES.includes(data.emotion),
        decision: "proceeded",
      });
    }
    navigate({ to: "/hub" });
  }

  function handleReconsider() {
    if (
      data.intention &&
      data.rule &&
      data.risk !== undefined &&
      data.inControl !== undefined &&
      data.emotion
    ) {
      logCheck({
        intention: data.intention,
        ruleAlignment: data.rule,
        riskPercent: data.risk,
        inControlIfLoss: data.inControl,
        emotion: data.emotion,
        emotionalBias: EMOTIONAL_BIASES.includes(data.emotion),
        decision: "reconsidered",
      });
    }
    navigate({ to: "/hub" });
  }

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[420px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(108,92,231,0.22), transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[440px] flex-col px-5 pt-6 pb-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (step === "interrupt") navigate({ to: "/hub" });
              else handleStepBack(step, go);
            }}
            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border shadow-soft transition-all hover:shadow-card-premium"
            aria-label="Back"
          >
            <ArrowLeft
              className="h-4 w-4 text-text-primary transition-transform group-hover:-translate-x-0.5"
              strokeWidth={2.2}
            />
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80">
            Check Before Trade
          </span>
          <span className="h-10 w-10" />
        </div>

        {/* Progress */}
        <div className="mt-5 flex items-center gap-1.5">
          {stepOrder.map((_, i) => {
            const active = i <= progressIndex;
            return (
              <div
                key={i}
                className="h-[3px] flex-1 overflow-hidden rounded-full bg-text-secondary/12"
              >
                <motion.div
                  initial={false}
                  animate={{ width: active ? "100%" : "0%" }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-mix"
                />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10.5px] font-medium uppercase tracking-[0.2em] text-text-secondary/70">
          Step {Math.min(progressIndex + 1, totalSteps)} of {totalSteps}
        </p>

        {/* Step content */}
        <div className="mt-6 flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            {step === "interrupt" && (
              <InterruptStep key="interrupt" onContinue={() => go("intention")} />
            )}
            {step === "intention" && (
              <IntentionStep
                key="intention"
                value={data.intention}
                onSelect={(v) => {
                  setData((d) => ({ ...d, intention: v }));
                  setTimeout(() => go("rule"), 220);
                }}
              />
            )}
            {step === "rule" && (
              <RuleStep
                key="rule"
                value={data.rule}
                onSelect={(v) => {
                  setData((d) => ({ ...d, rule: v }));
                  setTimeout(() => {
                    if (v === "not_really") go("rule_warning");
                    else go("risk");
                  }, 220);
                }}
              />
            )}
            {step === "rule_warning" && (
              <WarningStep
                key="rule_warning"
                title="Then this is not your edge."
                body="You’re about to trade emotion, not structure."
                onContinue={() => go("risk")}
                onBack={() => go("rule")}
              />
            )}
            {step === "risk" && (
              <RiskStep
                key="risk"
                value={data.risk}
                onSelect={(v) => {
                  setData((d) => ({ ...d, risk: v }));
                  setTimeout(() => go("control"), 220);
                }}
              />
            )}
            {step === "control" && (
              <ControlStep
                key="control"
                value={data.inControl}
                onSelect={(v) => {
                  setData((d) => ({ ...d, inControl: v }));
                  setTimeout(() => {
                    if (v === false) go("control_warning");
                    else go("emotion");
                  }, 220);
                }}
              />
            )}
            {step === "control_warning" && (
              <WarningStep
                key="control_warning"
                title="Then the position is too large."
                body="Size it down until a loss does not move you."
                onContinue={() => go("emotion")}
                onBack={() => go("control")}
              />
            )}
            {step === "emotion" && (
              <EmotionStep
                key="emotion"
                value={data.emotion}
                onSelect={(v) => {
                  setData((d) => ({ ...d, emotion: v }));
                  setTimeout(() => {
                    if (EMOTIONAL_BIASES.includes(v)) go("emotion_warning");
                    else go("summary");
                  }, 220);
                }}
              />
            )}
            {step === "emotion_warning" && (
              <WarningStep
                key="emotion_warning"
                title="This is where discipline breaks."
                body="Slow down. The market will still be here in five minutes."
                onContinue={() => go("summary")}
                onBack={() => go("emotion")}
              />
            )}
            {step === "summary" && (
              <SummaryStep
                key="summary"
                data={data}
                onProceed={handleProceedFinal}
                onReconsider={handleReconsider}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function handleStepBack(current: Step, go: (s: Step) => void) {
  const back: Record<Step, Step> = {
    interrupt: "interrupt",
    intention: "interrupt",
    rule: "intention",
    rule_warning: "rule",
    risk: "rule",
    control: "risk",
    control_warning: "control",
    emotion: "control",
    emotion_warning: "emotion",
    summary: "emotion",
  };
  go(back[current]);
}

// ---------- Step components ----------

function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 flex-col"
    >
      {eyebrow && (
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-[24px] font-bold leading-[1.15] tracking-tight text-text-primary">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-[14px] leading-snug text-text-secondary">
          {subtitle}
        </p>
      )}
      <div className="mt-6 flex-1">{children}</div>
    </motion.div>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
  tone = "neutral",
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
  tone?: "neutral" | "warning" | "danger";
}) {
  const ring =
    tone === "danger"
      ? "ring-red-300/70"
      : tone === "warning"
        ? "ring-amber-300/70"
        : "ring-border";
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`group relative flex w-full items-center justify-between rounded-2xl bg-card px-4 py-4 text-left ring-1 transition-all hover:shadow-soft ${ring} ${
        selected
          ? "shadow-[0_18px_40px_-22px_rgba(108,92,231,0.55)] ring-2 ring-[var(--brand)]"
          : ""
      }`}
    >
      <span className="text-[15px] font-medium text-text-primary">{label}</span>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
          selected
            ? "bg-gradient-mix text-white"
            : "bg-text-secondary/8 text-transparent ring-1 ring-border"
        }`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
      </span>
    </motion.button>
  );
}

function InterruptStep({ onContinue }: { onContinue: () => void }) {
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(1.5);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, 1.5 - elapsed);
      setCount(remaining);
      if (remaining <= 0) {
        setReady(true);
        clearInterval(tick);
      }
    }, 80);
    return () => clearInterval(tick);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-mix shadow-glow-primary">
            <Pause className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
            Pause
          </span>
        </div>

        <h2 className="mt-5 text-[28px] font-bold leading-[1.1] tracking-tight text-text-primary">
          Wait.
        </h2>
        <p className="mt-3 text-[16px] leading-snug text-text-primary/85">
          This is where most traders lose control.
        </p>
        <p className="mt-3 text-[15px] leading-snug text-text-secondary">
          You’re not here to react. You’re here to execute.
        </p>

        {/* Subtle breathing dot */}
        <div className="mt-8 flex items-center gap-3">
          <motion.span
            animate={{ scale: [1, 1.35, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="h-2.5 w-2.5 rounded-full bg-gradient-mix"
          />
          <span className="text-[12px] font-medium text-text-secondary">
            Breathe.
          </span>
        </div>
      </div>

      <motion.button
        whileTap={ready ? { scale: 0.985 } : {}}
        onClick={() => ready && onContinue()}
        disabled={!ready}
        className={`relative mt-6 flex w-full items-center justify-between overflow-hidden rounded-2xl px-5 py-4 transition-all ${
          ready
            ? "bg-gradient-mix text-white shadow-glow-primary"
            : "bg-card text-text-secondary ring-1 ring-border"
        }`}
      >
        <span className="text-[15px] font-semibold">
          {ready ? "I’m ready to continue" : "Hold on…"}
        </span>
        {ready ? (
          <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
        ) : (
          <span className="text-[12px] font-semibold tabular-nums">
            {count.toFixed(1)}s
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}

function IntentionStep({
  value,
  onSelect,
}: {
  value?: Intention;
  onSelect: (v: Intention) => void;
}) {
  const options: Intention[] = [
    "Enter a trade",
    "Modify a trade",
    "Close a trade",
    "Just analyzing",
  ];
  return (
    <StepShell
      eyebrow="Intention"
      title="What are you about to do?"
      subtitle="Name the action before you take it."
    >
      <div className="space-y-2.5">
        {options.map((o) => (
          <OptionButton
            key={o}
            label={o}
            selected={value === o}
            onClick={() => onSelect(o)}
          />
        ))}
      </div>
    </StepShell>
  );
}

function RuleStep({
  value,
  onSelect,
}: {
  value?: RuleAlignment;
  onSelect: (v: RuleAlignment) => void;
}) {
  const options: { v: RuleAlignment; label: string; tone?: "warning" | "danger" }[] = [
    { v: "fully", label: "Yes, fully aligned" },
    { v: "partially", label: "Partially", tone: "warning" },
    { v: "not_really", label: "Not really", tone: "danger" },
  ];
  return (
    <StepShell
      eyebrow="Rule alignment"
      title="Does this setup follow your rules?"
      subtitle="Be honest. The system only learns the truth."
    >
      <div className="space-y-2.5">
        {options.map((o) => (
          <OptionButton
            key={o.v}
            label={o.label}
            tone={o.tone}
            selected={value === o.v}
            onClick={() => onSelect(o.v)}
          />
        ))}
      </div>
    </StepShell>
  );
}

function RiskStep({
  value,
  onSelect,
}: {
  value?: number;
  onSelect: (v: number) => void;
}) {
  const presets = [0.5, 1, 2];
  const [custom, setCustom] = useState<string>(
    value !== undefined && !presets.includes(value) ? String(value) : "",
  );

  return (
    <StepShell
      eyebrow="Risk"
      title="What are you risking on this trade?"
      subtitle="Position size is the only variable you fully control."
    >
      <div className="grid grid-cols-3 gap-2.5">
        {presets.map((p) => (
          <motion.button
            key={p}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setCustom("");
              onSelect(p);
            }}
            className={`rounded-2xl bg-card px-3 py-4 text-center ring-1 transition-all hover:shadow-soft ${
              value === p && custom === ""
                ? "shadow-[0_18px_40px_-22px_rgba(108,92,231,0.55)] ring-2 ring-[var(--brand)]"
                : "ring-border"
            }`}
          >
            <span className="block text-[18px] font-bold text-text-primary">
              {p}%
            </span>
            <span className="mt-1 block text-[10.5px] uppercase tracking-[0.18em] text-text-secondary">
              {p === 0.5 ? "Conservative" : p === 1 ? "Standard" : "Aggressive"}
            </span>
          </motion.button>
        ))}
      </div>

      <div className="mt-5">
        <label className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-text-secondary/80">
          Custom
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-border focus-within:ring-2 focus-within:ring-[var(--brand)]">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder="0.0"
            value={custom}
            onChange={(e) => {
              const v = e.target.value;
              setCustom(v);
              const n = parseFloat(v);
              if (!isNaN(n) && n > 0) {
                // tentative — apply on blur via Enter, but also live-update so summary stays accurate
              }
            }}
            className="w-full bg-transparent text-[16px] font-semibold text-text-primary outline-none placeholder:text-text-secondary/50"
          />
          <span className="text-[14px] font-medium text-text-secondary">%</span>
          <button
            onClick={() => {
              const n = parseFloat(custom);
              if (!isNaN(n) && n > 0) onSelect(n);
            }}
            disabled={!custom || isNaN(parseFloat(custom)) || parseFloat(custom) <= 0}
            className="ml-1 rounded-xl bg-gradient-mix px-3 py-1.5 text-[12px] font-semibold text-white shadow-glow-primary transition-opacity disabled:opacity-40"
          >
            Set
          </button>
        </div>
      </div>
    </StepShell>
  );
}

function ControlStep({
  value,
  onSelect,
}: {
  value?: boolean;
  onSelect: (v: boolean) => void;
}) {
  return (
    <StepShell
      eyebrow="Control"
      title="If this trade loses, are you still in control?"
      subtitle="The right size is the one you can lose without flinching."
    >
      <div className="space-y-2.5">
        <OptionButton
          label="Yes"
          selected={value === true}
          onClick={() => onSelect(true)}
        />
        <OptionButton
          label="No"
          tone="danger"
          selected={value === false}
          onClick={() => onSelect(false)}
        />
      </div>
    </StepShell>
  );
}

function EmotionStep({
  value,
  onSelect,
}: {
  value?: Emotion;
  onSelect: (v: Emotion) => void;
}) {
  const options: { v: Emotion; tone?: "warning" | "danger" }[] = [
    { v: "Calm" },
    { v: "Slightly pressured", tone: "warning" },
    { v: "Urgent", tone: "danger" },
    { v: "Frustrated", tone: "danger" },
    { v: "Trying to recover losses", tone: "danger" },
  ];
  return (
    <StepShell
      eyebrow="Emotional state"
      title="What are you feeling right now?"
      subtitle="Name it. Naming it weakens its grip."
    >
      <div className="space-y-2.5">
        {options.map((o) => (
          <OptionButton
            key={o.v}
            label={o.v}
            tone={o.tone}
            selected={value === o.v}
            onClick={() => onSelect(o.v)}
          />
        ))}
      </div>
    </StepShell>
  );
}

function WarningStep({
  title,
  body,
  onContinue,
  onBack,
}: {
  title: string;
  body: string;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col justify-center">
        <div className="relative overflow-hidden rounded-2xl p-[1.5px]"
          style={{
            backgroundImage: "linear-gradient(135deg,#F59E0B 0%,#FF7AF5 100%)",
          }}
        >
          <div className="rounded-[14px] bg-card p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={2.4} />
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-amber-600">
                Pattern detected
              </span>
            </div>
            <h2 className="mt-4 text-[22px] font-bold leading-[1.15] tracking-tight text-text-primary">
              {title}
            </h2>
            <p className="mt-3 text-[14.5px] leading-snug text-text-secondary">
              {body}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <button
          onClick={onBack}
          className="rounded-2xl bg-card px-4 py-3.5 text-[13.5px] font-semibold text-text-primary ring-1 ring-border transition-all hover:shadow-soft"
        >
          Step back
        </button>
        <button
          onClick={onContinue}
          className="rounded-2xl bg-gradient-mix px-4 py-3.5 text-[13.5px] font-semibold text-white shadow-glow-primary transition-transform active:scale-[0.99]"
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
}

function SummaryStep({
  data,
  onProceed,
  onReconsider,
}: {
  data: State;
  onProceed: () => void;
  onReconsider: () => void;
}) {
  const ruleLabel: Record<RuleAlignment, string> = {
    fully: "Fully aligned",
    partially: "Partially aligned",
    not_really: "Not aligned",
  };
  const emotionalBias = data.emotion
    ? EMOTIONAL_BIASES.includes(data.emotion)
    : false;

  const rows = [
    { k: "Action", v: data.intention ?? "—" },
    {
      k: "Rule alignment",
      v: data.rule ? ruleLabel[data.rule] : "—",
      flag: data.rule === "not_really" || data.rule === "partially",
    },
    {
      k: "Risk",
      v: data.risk !== undefined ? `${data.risk}%` : "—",
      flag: data.risk !== undefined && data.risk > 1,
    },
    {
      k: "Control if loss",
      v: data.inControl === undefined ? "—" : data.inControl ? "Yes" : "No",
      flag: data.inControl === false,
    },
    { k: "Emotional state", v: data.emotion ?? "—", flag: emotionalBias },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 flex-col"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-text-secondary/80">
        Summary
      </p>
      <h2 className="mt-2 text-[24px] font-bold leading-[1.15] tracking-tight text-text-primary">
        This is your decision.
      </h2>
      <p className="mt-2 text-[14px] leading-snug text-text-secondary">
        Not the market’s.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        {rows.map((r, i) => (
          <div
            key={r.k}
            className={`flex items-center justify-between px-4 py-3.5 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {r.k}
            </span>
            <span
              className={`flex items-center gap-2 text-[14px] font-semibold ${
                r.flag ? "text-amber-600" : "text-text-primary"
              }`}
            >
              {r.flag && (
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
              )}
              {r.v}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-card/70 px-4 py-3.5 ring-1 ring-border">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" strokeWidth={2.2} />
        <p className="text-[12.5px] leading-snug text-text-secondary">
          Your answers are saved to refine your behavior pattern in the Control Hub.
        </p>
      </div>

      <div className="mt-auto pt-6 space-y-2.5">
        <button
          onClick={onReconsider}
          className="relative w-full overflow-hidden rounded-2xl bg-gradient-mix px-5 py-4 text-[15px] font-semibold text-white shadow-glow-primary transition-transform active:scale-[0.99]"
        >
          Adjust / Reconsider
        </button>
        <button
          onClick={onProceed}
          className="w-full rounded-2xl bg-card px-5 py-3.5 text-[13px] font-medium text-text-secondary ring-1 ring-border transition-all hover:text-text-primary"
        >
          Proceed anyway
        </button>
      </div>
    </motion.div>
  );
}
