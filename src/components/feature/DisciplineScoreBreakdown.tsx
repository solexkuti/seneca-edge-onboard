// DisciplineScoreBreakdown — Cumulative +10 / -10 model.
//
// Single source of truth: discipline_logs replayed chronologically on top
// of a 100-point baseline. No sub-scores, no recency weighting. Displays:
//   1. Headline score + state
//   2. The simple formula
//   3. Rule adherence (clean / total)
//   4. Recent ledger (newest first)

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
  CLEAN_TRADE_DELTA,
  STARTING_SCORE,
  VIOLATION_DELTA,
  type DisciplineState,
  type ScoreContribution,
} from "@/lib/disciplineScore";
import { metricColorStyle, metricGlowShadow } from "@/lib/metricColor";

const STATE_COPY: Record<
  DisciplineState,
  { label: string; tone: "emerald" | "amber" | "orange" | "red"; icon: typeof Shield }
> = {
  in_control: { label: "In Control", tone: "emerald", icon: ShieldCheck },
  slipping: { label: "Slipping", tone: "amber", icon: Shield },
  at_risk: { label: "At Risk", tone: "orange", icon: ShieldAlert },
  locked: { label: "Critical", tone: "red", icon: AlertTriangle },
};

const TONE_BG: Record<string, string> = {
  emerald: "bg-emerald-500/10 ring-emerald-500/25 text-emerald-400",
  amber: "bg-amber-500/10 ring-amber-500/25 text-amber-400",
  orange: "bg-orange-500/10 ring-orange-500/25 text-orange-400",
  red: "bg-red-600/10 ring-red-600/25 text-red-400",
};

export default function DisciplineScoreBreakdown() {
  const { state } = useTraderState();
  const b = state.discipline.breakdown;
  const copy = STATE_COPY[b.state];
  const Icon = copy.icon;
  const adherencePct = Math.round((b.rule_adherence ?? 1) * 100);

  return (
    <div className="space-y-4">
      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="card-premium p-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Discipline score
            </p>
            <p
              className="mt-1 text-[44px] font-bold leading-none tabular-nums"
              style={{
                ...metricColorStyle(b.score),
                textShadow: metricGlowShadow(b.score),
              }}
            >
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

        {/* Formula */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-[11px] text-foreground/85 ring-1 ring-border">
          <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono tabular-nums">
            start {STARTING_SCORE} · clean {CLEAN_TRADE_DELTA >= 0 ? "+" : ""}
            {CLEAN_TRADE_DELTA} · per violation {VIOLATION_DELTA} · clamp 0–100
          </span>
        </div>
      </motion.div>

      {/* Rule adherence + counts */}
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Rule adherence"
          value={`${adherencePct}%`}
          sub={
            b.total_trades === 0
              ? "No trades logged yet."
              : `Followed your rules in ${b.clean_trades} of ${b.total_trades} trade${b.total_trades === 1 ? "" : "s"}.`
          }
          colorScore={adherencePct}
        />
        <Stat
          label="Violations logged"
          value={`${b.violation_count}`}
          sub={
            b.violation_count === 0
              ? "Clean record."
              : `Across ${b.total_trades} trade${b.total_trades === 1 ? "" : "s"}.`
          }
          colorScore={b.violation_count === 0 ? 100 : Math.max(0, 100 - b.violation_count * 10)}
        />
      </div>

      {/* Ledger */}
      <div className="card-premium p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Recent trades
        </p>
        {b.recent_contributions.length === 0 ? (
          <p className="mt-2 text-[12px] italic text-muted-foreground">
            No trades logged yet. Your discipline score holds at {STARTING_SCORE}/100 until your first trade.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {b.recent_contributions.map((c) => (
              <LedgerRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Score is cumulative across every logged trade. Clean trade adds +10.
        Each rule violation subtracts -10. Behavior score = discipline score —
        no second formula.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  colorScore,
}: {
  label: string;
  value: string;
  sub: string;
  colorScore: number;
}) {
  return (
    <div className="card-premium p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 text-[28px] font-bold leading-none tabular-nums"
        style={metricColorStyle(colorScore)}
      >
        {value}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function LedgerRow({ c }: { c: ScoreContribution }) {
  const positive = c.raw > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <li className="flex items-start gap-2 text-[12px] text-foreground/90">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full ring-1 ${
          positive
            ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25"
            : "bg-red-600/10 text-red-400 ring-red-600/25"
        }`}
      >
        <Icon className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1 truncate">{c.reason}</span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {c.raw > 0 ? "+" : ""}
        {c.raw} → {c.value}
      </span>
    </li>
  );
}
