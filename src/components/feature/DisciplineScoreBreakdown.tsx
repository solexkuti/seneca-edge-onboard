// DisciplineScoreBreakdown — transparent, deterministic display of the
// discipline score. Shows the final number, the two sub-scores, the
// formula, and every penalty so the user can always answer:
// "I know exactly why my score moved."

import { motion } from "framer-motion";
import {
  Activity,
  Calculator,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { useTraderState } from "@/hooks/useTraderState";
import {
  DECISION_WEIGHT,
  EXECUTION_WEIGHT,
  WINDOW_SIZE,
  type DisciplineState,
  type ScoreContribution,
} from "@/lib/disciplineScore";

const STATE_COPY: Record<
  DisciplineState,
  { label: string; tone: "emerald" | "amber" | "orange" | "red"; icon: typeof Shield }
> = {
  in_control: { label: "In Control", tone: "emerald", icon: ShieldCheck },
  slipping: { label: "Slipping", tone: "amber", icon: Shield },
  at_risk: { label: "At Risk", tone: "orange", icon: ShieldAlert },
  locked: { label: "Locked", tone: "red", icon: AlertTriangle },
};

const TONE_BG: Record<string, string> = {
  emerald: "bg-emerald-500/10 ring-emerald-500/25 text-emerald-800",
  amber: "bg-amber-500/10 ring-amber-500/25 text-amber-800",
  orange: "bg-orange-500/10 ring-orange-500/25 text-orange-800",
  red: "bg-red-600/10 ring-red-600/25 text-red-800",
};

export default function DisciplineScoreBreakdown() {
  const { state } = useTraderState();
  const b = state.discipline.breakdown;
  const copy = STATE_COPY[b.state];
  const Icon = copy.icon;

  return (
    <div className="space-y-4">
      {/* Headline score */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Discipline score
            </p>
            <p className="mt-1 text-[44px] font-bold leading-none tabular-nums text-foreground">
              {b.score}
              <span className="ml-1 text-[18px] text-muted-foreground">/100</span>
            </p>
            <div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ring-1 ${TONE_BG[copy.tone]}`}
            >
              <Activity className="h-3 w-3" strokeWidth={2.6} />
              {copy.label}
            </div>
          </div>
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${TONE_BG[copy.tone]}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.3} />
          </div>
        </div>

        {/* Formula bar */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-[11px] text-foreground/85 ring-1 ring-border">
          <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono tabular-nums">
            {b.score} = {b.decision_score}×{DECISION_WEIGHT} + {b.execution_score}×{EXECUTION_WEIGHT}
          </span>
        </div>
      </motion.div>

      {/* Sub-scores */}
      <div className="grid grid-cols-2 gap-3">
        <SubScore
          title="Decision Quality"
          score={b.decision_score}
          weight={DECISION_WEIGHT}
          sample={b.decision_sample}
          source="analyzer events"
        />
        <SubScore
          title="Execution Quality"
          score={b.execution_score}
          weight={EXECUTION_WEIGHT}
          sample={b.execution_sample}
          source="trades logged"
          neutral={b.execution_neutral}
        />
      </div>

      {/* Penalties */}
      {b.penalties.length > 0 && (
        <div className="rounded-2xl bg-red-600/[0.04] p-4 ring-1 ring-red-600/20">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-700">
            Penalties applied
          </p>
          <ul className="mt-2 space-y-1.5">
            {b.penalties.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[12.5px] text-red-900/85"
              >
                <TrendingDown className="mt-0.5 h-3.5 w-3.5 flex-none text-red-700" />
                <span>
                  <span className="font-mono font-semibold">{p.impact}</span>{" "}
                  {p.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Contributions ledger */}
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border shadow-soft">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Recent contributions (last {WINDOW_SIZE})
        </p>
        <div className="mt-3 space-y-3">
          <ContributionGroup
            label="Decision layer"
            items={b.decision_contributions}
            empty="No analyzer events yet — decision quality defaults to 50."
          />
          <ContributionGroup
            label="Execution layer"
            items={b.execution_contributions}
            empty="No trades yet — execution quality defaults to 50."
          />
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        The score is a mirror. Every event is weighted by recency (newest = 1.0,
        oldest in window = 0.2). No hidden logic, no AI overrides. Improve →
        score rises immediately. Slip → score drops immediately.
      </p>
    </div>
  );
}

function SubScore({
  title,
  score,
  weight,
  sample,
  source,
  neutral,
}: {
  title: string;
  score: number;
  weight: number;
  sample: number;
  source: string;
  neutral?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </p>
        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {Math.round(weight * 100)}%
        </span>
      </div>
      <p className="mt-1 text-[28px] font-bold leading-none tabular-nums text-foreground">
        {score}
        <span className="ml-1 text-[12px] text-muted-foreground">/100</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5 }}
          className="h-full bg-primary"
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {neutral
          ? `Neutral — 0 ${source}.`
          : `${sample} ${source} in window.`}
      </p>
    </div>
  );
}

function ContributionGroup({
  label,
  items,
  empty,
}: {
  label: string;
  items: ScoreContribution[];
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-[11px] font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-[11px] italic text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-semibold text-foreground">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((c) => {
          const positive = c.value >= 50;
          return (
            <li
              key={c.id}
              className="flex items-start gap-2 text-[11.5px] text-foreground/85"
            >
              <span
                className={`mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full ring-1 ${
                  positive
                    ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25"
                    : "bg-red-600/10 text-red-700 ring-red-600/25"
                }`}
              >
                {positive ? (
                  <TrendingUp className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" strokeWidth={3} />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{c.reason}</span>
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {Math.round(c.value)} · w{c.weight.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
